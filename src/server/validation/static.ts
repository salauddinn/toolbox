import type { FileOperation } from "@/core/changes";
import type { AnalysisResult } from "@/core/analysis";
import type { DomainCandidate } from "@/core/candidates";
import type { SourceSnapshot } from "@/core/repository";
import type { StagePlan } from "@/core/stages";
import type { ValidationCheck } from "@/core/validation";
import type { NodePath } from "@babel/traverse";
import * as t from "@babel/types";
import { parseJavaScript } from "@/server/analysis/parse";
import { traverse } from "@/server/analysis/babel-traverse";
import { buildDependencyGraph, resolveRelativeRequire } from "@/server/analysis/graph";
import { isForbiddenProtectedPath, pathAllowedInEnvelope } from "./envelope";
import {
  extractRouteTable,
  extractSchemaTable,
  routeTableFingerprint,
  schemaTableFingerprint,
} from "./fingerprints";
import { validateMutableRegions } from "./mutable-regions";

export type StaticValidationResult = {
  passed: boolean;
  checks: ValidationCheck[];
  structuredErrors: string[];
};

function fail(id: string, title: string, detail: string): ValidationCheck {
  return { id, kind: "static", title, outcome: "failed", detail };
}

function pass(id: string, title: string, detail?: string): ValidationCheck {
  return { id, kind: "static", title, outcome: "passed", detail };
}

function domainSlug(candidate: DomainCandidate): string {
  return (
    candidate.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || candidate.id
  );
}

type CycleInjectionContract = {
  factoryName: string;
  dependencyKey: string;
  dependencyPath: string;
};

type InjectionValidation = {
  check: ValidationCheck;
  structuredError?: string;
};

function pathStem(path: string): string {
  const basename =
    path
      .split("/")
      .at(-1)
      ?.replace(/\.[^.]+$/, "") ?? "dependency";
  const words = basename.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return words
    .map((word, index) =>
      index === 0 ? word.toLowerCase() : word.slice(0, 1).toUpperCase() + word.slice(1),
    )
    .join("");
}

function cycleInjectionContract(
  analysis: AnalysisResult,
  candidate: DomainCandidate,
): CycleInjectionContract | null {
  const candidateFiles = new Set(candidate.files);
  const cycle = analysis.graph.cycles.find((item) =>
    item.files.some((file) => candidateFiles.has(file)),
  );
  if (!cycle) return null;

  const edge = cycle.edges
    .filter((item) => candidateFiles.has(item.from) && !candidateFiles.has(item.to))
    .sort((left, right) => `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`))[0];
  if (!edge) return null;

  const stem = pathStem(edge.to);
  if (!stem) return null;
  return {
    factoryName: `create${candidate.name}Module`,
    dependencyKey: `${stem}Api`,
    dependencyPath: edge.to,
  };
}

function isRequireCall(node: t.Node | null | undefined): node is t.CallExpression {
  return Boolean(
    node &&
    t.isCallExpression(node) &&
    t.isIdentifier(node.callee, { name: "require" }) &&
    node.arguments.length === 1 &&
    t.isStringLiteral(node.arguments[0]),
  );
}

function isModuleExports(node: t.Node): boolean {
  return (
    t.isMemberExpression(node) &&
    !node.computed &&
    t.isIdentifier(node.object, { name: "module" }) &&
    t.isIdentifier(node.property, { name: "exports" })
  );
}

function isModuleExportsProperty(node: t.Node, propertyName: string): boolean {
  return (
    t.isMemberExpression(node) &&
    !node.computed &&
    isModuleExports(node.object) &&
    t.isIdentifier(node.property, { name: propertyName })
  );
}

function objectExportsFactory(object: t.ObjectExpression, factoryName: string): boolean {
  return object.properties.some(
    (property) =>
      t.isObjectProperty(property) &&
      !property.computed &&
      ((t.isIdentifier(property.key) && property.key.name === factoryName) ||
        (t.isStringLiteral(property.key) && property.key.value === factoryName)) &&
      t.isIdentifier(property.value, { name: factoryName }),
  );
}

/**
 * Evaluate supported CommonJS assignment shapes in source order. A whole-object
 * assignment replaces the effective export object, while an assignment to the
 * expected property updates only that property. Ambiguous nested assignments
 * are treated conservatively in their source order rather than ignored.
 */
function hasPublicFactoryExport(ast: t.File, factoryName: string): boolean {
  const assignments: t.AssignmentExpression[] = [];
  traverse(ast, {
    AssignmentExpression(path) {
      if (path.node.operator !== "=") return;
      if (isModuleExports(path.node.left) || isModuleExportsProperty(path.node.left, factoryName)) {
        assignments.push(path.node);
      }
    },
  });
  assignments.sort((left, right) => (left.start ?? 0) - (right.start ?? 0));

  let exported = false;
  for (const { left, right } of assignments) {
    if (isModuleExports(left)) {
      exported = t.isObjectExpression(right) && objectExportsFactory(right, factoryName);
    } else {
      exported = t.isIdentifier(right, { name: factoryName });
    }
  }
  return exported;
}

function isDependencyInvocation(
  node: t.Node | null | undefined,
  dependencyKey: string,
): node is t.CallExpression {
  if (!node || !t.isCallExpression(node)) return false;
  const callee = node.callee;
  return (
    t.isMemberExpression(callee) &&
    !callee.computed &&
    t.isIdentifier(callee.object, { name: dependencyKey }) &&
    t.isIdentifier(callee.property)
  );
}

function returnedValueUsesDependency(
  node: t.Expression | null | undefined,
  dependencyKey: string,
  invocationResults: ReadonlyMap<string, number>,
  returnStart: number,
): boolean {
  const isPriorInvocationResult = (candidate: t.Node): boolean =>
    t.isIdentifier(candidate) &&
    (invocationResults.get(candidate.name) ?? Number.POSITIVE_INFINITY) < returnStart;

  if (!node) return false;
  if (isDependencyInvocation(node, dependencyKey)) return true;
  if (isPriorInvocationResult(node)) return true;
  if (!t.isObjectExpression(node)) return false;

  return node.properties.some((property) => {
    if (!t.isObjectProperty(property) || property.computed) return false;
    const keyMatches =
      (t.isIdentifier(property.key) && property.key.name === dependencyKey) ||
      (t.isStringLiteral(property.key) && property.key.value === dependencyKey);
    if (keyMatches && t.isIdentifier(property.value, { name: dependencyKey })) return true;
    if (t.isExpression(property.value)) {
      return (
        isDependencyInvocation(property.value, dependencyKey) ||
        isPriorInvocationResult(property.value)
      );
    }
    return false;
  });
}

function hasObservableFactoryUse(
  factoryPath: NodePath<t.FunctionDeclaration>,
  dependencyKey: string,
): boolean {
  const invocationResults = new Map<string, number>();
  factoryPath.traverse({
    VariableDeclarator(path) {
      if (path.getFunctionParent()?.node !== factoryPath.node) return;
      if (!t.isIdentifier(path.node.id) || !isDependencyInvocation(path.node.init, dependencyKey)) {
        return;
      }
      const binding = path.scope.getBinding(path.node.id.name);
      if (binding?.constant) invocationResults.set(path.node.id.name, path.node.start ?? 0);
    },
  });

  let observable = false;
  factoryPath.traverse({
    ReturnStatement(path) {
      if (observable || path.getFunctionParent()?.node !== factoryPath.node) return;
      const argument = path.node.argument;
      if (
        argument &&
        t.isExpression(argument) &&
        returnedValueUsesDependency(
          argument,
          dependencyKey,
          invocationResults,
          path.node.start ?? Number.POSITIVE_INFINITY,
        )
      ) {
        observable = true;
      }
    },
  });
  return observable;
}

function validatePublicFactory(input: {
  indexPath: string;
  content: string;
  contract: CycleInjectionContract;
}): InjectionValidation {
  const parsed = parseJavaScript(input.content, input.indexPath);
  if (!parsed.ok) {
    return {
      check: fail(
        "factory-injection",
        "Public module factory has the supported injection shape",
        `unsupported_factory_shape:${input.indexPath}:${input.contract.factoryName}`,
      ),
      structuredError: "unsupported_factory_shape",
    };
  }

  let parameterShapeValid = false;
  let injectedDependencyUsed = false;
  traverse(parsed.ast, {
    FunctionDeclaration(path) {
      if (!path.node.id || path.node.id.name !== input.contract.factoryName) return;
      const [parameter] = path.node.params;
      if (
        path.node.params.length !== 1 ||
        !t.isObjectPattern(parameter) ||
        parameter.properties.length !== 1
      ) {
        return;
      }
      const [property] = parameter.properties;
      if (
        !t.isObjectProperty(property) ||
        property.computed ||
        !t.isIdentifier(property.key, { name: input.contract.dependencyKey }) ||
        !t.isIdentifier(property.value, { name: input.contract.dependencyKey })
      ) {
        return;
      }
      parameterShapeValid = true;
      injectedDependencyUsed = hasObservableFactoryUse(path, input.contract.dependencyKey);
    },
  });

  if (!parameterShapeValid) {
    return {
      check: fail(
        "factory-injection",
        "Public module factory has the supported injection shape",
        `unsupported_factory_shape:${input.indexPath}:${input.contract.factoryName}({ ${input.contract.dependencyKey} })`,
      ),
      structuredError: "unsupported_factory_shape",
    };
  }
  if (!hasPublicFactoryExport(parsed.ast, input.contract.factoryName)) {
    return {
      check: fail(
        "factory-injection",
        "Public module factory has the supported injection shape",
        `factory_not_public_export:${input.indexPath}:${input.contract.factoryName}`,
      ),
      structuredError: "factory_not_public_export",
    };
  }
  if (!injectedDependencyUsed) {
    return {
      check: fail(
        "factory-injection",
        "Public module factory has the supported injection shape",
        `unused_injected_dependency:${input.indexPath}:${input.contract.dependencyKey}`,
      ),
      structuredError: "unused_injected_dependency",
    };
  }
  return {
    check: pass(
      "factory-injection",
      "Public module factory has the supported injection shape",
      `factory:${input.contract.factoryName}; dependency:${input.contract.dependencyKey}`,
    ),
  };
}

function validateCompositionRootInjection(input: {
  entryPath: string;
  content: string;
  fileSet: ReadonlySet<string>;
  moduleIndexPath: string;
  contract: CycleInjectionContract;
}): InjectionValidation {
  const parsed = parseJavaScript(input.content, input.entryPath);
  if (!parsed.ok) {
    return {
      check: fail(
        "composition-root-injection",
        "Recognized composition root supplies the factory dependency",
        `missing_composition_root_factory_call:${input.entryPath}:${input.contract.factoryName}`,
      ),
      structuredError: "missing_composition_root_factory_call",
    };
  }

  const moduleBindings = new Set<string>();
  const dependencyBindings = new Set<string>();
  traverse(parsed.ast, {
    VariableDeclarator(path) {
      if (!t.isIdentifier(path.node.id) || !isRequireCall(path.node.init)) return;
      const request = path.node.init.arguments[0];
      if (!t.isStringLiteral(request)) return;
      const resolved = resolveRelativeRequire(
        input.entryPath as never,
        request.value,
        input.fileSet,
      );
      if (resolved === input.moduleIndexPath) moduleBindings.add(path.node.id.name);
      if (resolved === input.contract.dependencyPath) dependencyBindings.add(path.node.id.name);
    },
  });

  let foundFactoryCall = false;
  let suppliedDependency = false;
  traverse(parsed.ast, {
    CallExpression(path) {
      const { callee, arguments: args } = path.node;
      if (
        !t.isMemberExpression(callee) ||
        callee.computed ||
        !t.isIdentifier(callee.object) ||
        !moduleBindings.has(callee.object.name) ||
        !t.isIdentifier(callee.property, { name: input.contract.factoryName })
      ) {
        return;
      }
      foundFactoryCall = true;
      if (args.length !== 1 || !t.isObjectExpression(args[0])) return;
      const properties = args[0].properties;
      if (properties.length !== 1) return;
      const [property] = properties;
      if (
        t.isObjectProperty(property) &&
        !property.computed &&
        t.isIdentifier(property.key, { name: input.contract.dependencyKey }) &&
        t.isIdentifier(property.value) &&
        dependencyBindings.has(property.value.name)
      ) {
        suppliedDependency = true;
      }
    },
  });

  if (!foundFactoryCall) {
    return {
      check: fail(
        "composition-root-injection",
        "Recognized composition root supplies the factory dependency",
        `missing_composition_root_factory_call:${input.entryPath}:${input.contract.factoryName}`,
      ),
      structuredError: "missing_composition_root_factory_call",
    };
  }
  if (!suppliedDependency) {
    return {
      check: fail(
        "composition-root-injection",
        "Recognized composition root supplies the factory dependency",
        `wrong_composition_root_factory_argument:${input.entryPath}:${input.contract.factoryName}({ ${input.contract.dependencyKey}: <${input.contract.dependencyPath}> })`,
      ),
      structuredError: "wrong_composition_root_factory_argument",
    };
  }
  return {
    check: pass(
      "composition-root-injection",
      "Recognized composition root supplies the factory dependency",
      `root:${input.entryPath}; ${input.contract.dependencyKey}:${input.contract.dependencyPath}`,
    ),
  };
}

/**
 * Full static validation of a Change Set against the Stage Plan and base snapshot.
 */
export function validateChangeSetStatic(input: {
  stage: StagePlan;
  operations: readonly FileOperation[];
  baseSnapshot: SourceSnapshot;
  candidateSnapshot: SourceSnapshot;
  analysis: AnalysisResult;
  candidate: DomainCandidate;
}): StaticValidationResult {
  const checks: ValidationCheck[] = [];
  const structuredErrors: string[] = [];
  const baseFiles = [...input.baseSnapshot.files.values()];
  const candidateFiles = [...input.candidateSnapshot.files.values()];
  const entryPath = input.analysis.entryPath;

  // 1. Forbidden protected paths
  for (const op of input.operations) {
    const forbidden = isForbiddenProtectedPath(op.path);
    if (forbidden) {
      checks.push(
        fail("protected-path", "Protected path change rejected", `${forbidden}: ${op.path}`),
      );
      structuredErrors.push(forbidden);
    }
  }
  if (!structuredErrors.some((e) => e.startsWith("disallowed_"))) {
    checks.push(pass("protected-path", "No protected manifest/lockfile/env changes"));
  }

  // 2. Path envelope + repository-root paths
  let envelopeOk = true;
  for (const op of input.operations) {
    const allowed = pathAllowedInEnvelope(op, input.stage.pathEnvelope);
    if (!allowed.ok) {
      envelopeOk = false;
      checks.push(
        fail("path-envelope", "Operation outside Stage Plan path envelope", allowed.reason),
      );
      structuredErrors.push(allowed.reason);
    }
  }
  // behavior_capture: no production edits
  if (input.stage.kind === "behavior_capture") {
    const prodEdit = input.operations.find(
      (op) =>
        op.type !== "create" ||
        !(
          op.path.startsWith("tests/") ||
          op.path.startsWith("test/") ||
          op.path.startsWith("__tests__/")
        ),
    );
    // allow only creates under test roots
    for (const op of input.operations) {
      if (op.type !== "create") {
        envelopeOk = false;
        checks.push(
          fail("behavior-no-prod", "Behaviour capture must not update or delete files", op.path),
        );
        structuredErrors.push(`behavior_capture_non_create:${op.path}`);
      }
    }
    void prodEdit;
  }
  if (input.stage.kind === "domain_module" || input.stage.kind === "cycle_repair") {
    const deletes = input.operations.filter((o) => o.type === "delete");
    if (deletes.length > 0) {
      envelopeOk = false;
      for (const d of deletes) {
        checks.push(fail("no-delete", "Stage forbids deletion", d.path));
        structuredErrors.push(`disallowed_delete_outside_envelope:${d.path}`);
      }
    }
  }
  if (envelopeOk && !checks.some((c) => c.id === "path-envelope" && c.outcome === "failed")) {
    checks.push(pass("path-envelope", "All operations within path envelope"));
  }

  // 2b. Mutable AST regions / protected fingerprints (Task 12)
  const mutable = validateMutableRegions({
    operations: input.operations,
    baseSnapshot: input.baseSnapshot,
    candidateSnapshot: input.candidateSnapshot,
    mutableRegions: input.stage.mutableRegions,
    protectedFingerprints: input.stage.protectedFingerprints,
  });
  if (!mutable.ok) {
    for (const err of mutable.errors) {
      checks.push(
        fail("mutable-regions", "Protected top-level AST region altered outside Stage Plan", err),
      );
      structuredErrors.push(err);
    }
  } else if (
    input.stage.mutableRegions.length > 0 ||
    input.stage.protectedFingerprints.length > 0
  ) {
    checks.push(pass("mutable-regions", "Mutable regions respected"));
  }

  // 3. Parse every changed JS file in candidate
  let parseOk = true;
  for (const op of input.operations) {
    if (op.type === "delete") continue;
    if (!op.path.endsWith(".js") && !op.path.endsWith(".cjs") && !op.path.endsWith(".mjs")) {
      continue;
    }
    const file = input.candidateSnapshot.files.get(op.path as typeof entryPath);
    const content = file?.content ?? op.content;
    const parsed = parseJavaScript(content, op.path);
    if (!parsed.ok) {
      parseOk = false;
      checks.push(
        fail(
          "javascript-parse",
          "Changed JavaScript must parse",
          `javascript_parse_error:${op.path}`,
        ),
      );
      structuredErrors.push(`javascript_parse_error:${op.path}`);
    }
  }
  // Also parse all JS in candidate that was created/updated
  for (const file of candidateFiles) {
    if (!file.path.endsWith(".js")) continue;
    const base = input.baseSnapshot.files.get(file.path);
    if (base && base.content === file.content) continue;
    const parsed = parseJavaScript(file.content, file.path);
    if (!parsed.ok) {
      parseOk = false;
      if (!structuredErrors.some((e) => e.includes(file.path))) {
        checks.push(
          fail(
            "javascript-parse",
            "Changed JavaScript must parse",
            `javascript_parse_error:${file.path}`,
          ),
        );
        structuredErrors.push(`javascript_parse_error:${file.path}`);
      }
    }
  }
  if (parseOk) {
    checks.push(pass("javascript-parse", "All changed JavaScript files parse"));
  }

  // 4. Resolve relative requires for changed files
  const fileSet = new Set(candidateFiles.filter((f) => f.path.endsWith(".js")).map((f) => f.path));
  let resolveOk = true;
  for (const file of candidateFiles) {
    if (!file.path.endsWith(".js")) continue;
    const base = input.baseSnapshot.files.get(file.path);
    if (base && base.content === file.content) continue;
    const requireRe = /require\s*\(\s*['"](\.[^'"]+)['"]\s*\)/g;
    let match: RegExpExecArray | null;
    while ((match = requireRe.exec(file.content))) {
      const request = match[1]!;
      const resolved = resolveRelativeRequire(file.path, request, fileSet);
      if (!resolved) {
        resolveOk = false;
        checks.push(
          fail(
            "resolve-requires",
            "Relative requires must resolve inside the repository",
            `${file.path} require('${request}')`,
          ),
        );
        structuredErrors.push(`unresolved_require:${file.path}:${request}`);
      }
    }
  }
  if (resolveOk) {
    checks.push(pass("resolve-requires", "Relative requires resolve inside repository"));
  }

  // 5. Stage-specific checks
  const slug = domainSlug(input.candidate);
  const moduleRoot = `src/modules/${slug}`;

  if (input.stage.kind === "behavior_capture") {
    const creates = input.operations.filter((o) => o.type === "create");
    if (creates.length !== 1) {
      checks.push(
        fail(
          "one-new-test-file",
          "Behaviour capture creates exactly one new test file",
          `got ${creates.length}`,
        ),
      );
      structuredErrors.push(`behavior_capture_file_count:${creates.length}`);
    } else {
      const path = creates[0]!.path;
      const underTest =
        path.startsWith("tests/") || path.startsWith("test/") || path.startsWith("__tests__/");
      if (!underTest || !path.includes(".test.")) {
        checks.push(
          fail("one-new-test-file", "Test file must live under existing test root", path),
        );
        structuredErrors.push(`behavior_capture_bad_path:${path}`);
      } else {
        checks.push(pass("one-new-test-file", "Exactly one new characterization test file"));
      }
    }
    checks.push({
      id: "external-tests-not-executed",
      kind: "runtime",
      title: "External generated tests",
      outcome: "not_executed",
      detail: "not_executed",
    });
  }

  if (input.stage.kind === "domain_module") {
    const required = [
      `${moduleRoot}/index.js`,
      `${moduleRoot}/${slug}.routes.js`,
      `${moduleRoot}/${slug}.controller.js`,
      `${moduleRoot}/${slug}.service.js`,
      `${moduleRoot}/${slug}.repository.js`,
      `${moduleRoot}/${slug}.model.js`,
    ];
    let shapeOk = true;
    for (const path of required) {
      if (!input.candidateSnapshot.files.has(path as typeof entryPath)) {
        shapeOk = false;
        checks.push(fail("module-shape", "Required Domain Module file missing", path));
        structuredErrors.push(`missing_module_file:${path}`);
      }
    }
    const index = input.candidateSnapshot.files.get(`${moduleRoot}/index.js` as typeof entryPath);
    if (index && !/module\.exports/.test(index.content)) {
      shapeOk = false;
      checks.push(
        fail("module-shape", "Public index.js must export the module facade", moduleRoot),
      );
      structuredErrors.push("missing_public_exports");
    }
    // dependency direction: routes should require controller, not repository directly ideally
    const routesFile = input.candidateSnapshot.files.get(
      `${moduleRoot}/${slug}.routes.js` as typeof entryPath,
    );
    if (routesFile && /require\(['"]\.\/.*repository/.test(routesFile.content)) {
      shapeOk = false;
      checks.push(
        fail(
          "dependency-direction",
          "Routes must not require repository directly",
          `${slug}.routes.js`,
        ),
      );
      structuredErrors.push("dependency_direction_routes_repository");
    }
    if (shapeOk) {
      checks.push(pass("module-shape", "Domain Module shape and public index present"));
      checks.push(pass("dependency-direction", "Module dependency direction acceptable"));
    }
  }

  if (input.stage.kind === "cycle_repair") {
    const graph = buildDependencyGraph(candidateFiles, entryPath);
    const contract = cycleInjectionContract(input.analysis, input.candidate);
    const originalCycleFiles = new Set(
      input.analysis.graph.cycles
        .filter((cycle) => cycle.files.some((file) => input.candidate.files.includes(file)))
        .flatMap((cycle) => cycle.files),
    );
    const remaining = graph.cycles.filter((cycle) =>
      cycle.files.some((file) => originalCycleFiles.has(file)),
    );
    if (remaining.length > 0) {
      checks.push(
        fail(
          "cycle-absent",
          "Original entry-reachable circular dependency must be removed",
          `entry_reachable_cycle:${remaining.map((cycle) => cycle.files.join("→")).join("; ")}`,
        ),
      );
      structuredErrors.push("cycle_still_present");
    } else {
      checks.push(
        pass(
          "cycle-absent",
          "Original entry-reachable circular dependency must be removed",
          "entry_reachable_cycle_absent",
        ),
      );
    }

    const indexPath = `${moduleRoot}/index.js`;
    const index = input.candidateSnapshot.files.get(indexPath as typeof entryPath);
    if (!contract || !index) {
      checks.push(
        fail(
          "factory-injection",
          "Public module factory has the supported injection shape",
          `unsupported_factory_shape:${indexPath}:missing_cycle_dependency_contract`,
        ),
      );
      structuredErrors.push("unsupported_factory_shape");
      checks.push(
        fail(
          "composition-root-injection",
          "Recognized composition root supplies the factory dependency",
          `missing_composition_root_factory_call:${entryPath}:missing_cycle_dependency_contract`,
        ),
      );
      structuredErrors.push("missing_composition_root_factory_call");
    } else {
      const factory = validatePublicFactory({
        indexPath,
        content: index.content,
        contract,
      });
      checks.push(factory.check);
      if (factory.structuredError) structuredErrors.push(factory.structuredError);

      const root = input.candidateSnapshot.files.get(entryPath);
      const compositionRoot = validateCompositionRootInjection({
        entryPath,
        content: root?.content ?? "",
        fileSet: new Set(
          candidateFiles.filter((file) => file.path.endsWith(".js")).map((file) => file.path),
        ),
        moduleIndexPath: indexPath,
        contract,
      });
      checks.push(compositionRoot.check);
      if (compositionRoot.structuredError) structuredErrors.push(compositionRoot.structuredError);
    }
  }

  if (input.stage.kind === "integration_cleanup") {
    // external requires of module internals should use index
    const internalImport = new RegExp(
      `require\\(['"](?:\\.\\./)*${moduleRoot.replace(/\//g, "\\/")}/(?!index)`,
    );
    let facadeOk = true;
    for (const file of candidateFiles) {
      if (file.path.startsWith(`${moduleRoot}/`)) continue;
      if (!file.path.endsWith(".js")) continue;
      if (internalImport.test(file.content)) {
        facadeOk = false;
        checks.push(
          fail("public-facade", "External imports must use module index.js only", file.path),
        );
        structuredErrors.push(`internal_module_import:${file.path}`);
      }
    }
    if (facadeOk) {
      checks.push(pass("public-facade", "External readers use public module facade"));
    }
  }

  // 6. Route/schema preservation for production-touching stages
  if (input.stage.kind !== "behavior_capture") {
    const beforeRouteTable =
      extractRouteTable(baseFiles, entryPath).length > 0
        ? extractRouteTable(baseFiles, entryPath)
        : input.analysis.routes.map((r) => ({
            method: r.method,
            path: r.path,
          }));
    const afterRouteTable = extractRouteTable(candidateFiles, entryPath);
    const beforeRoutes = routeTableFingerprint(beforeRouteTable);
    const afterRoutes = routeTableFingerprint(afterRouteTable);

    // Domain module may re-home handlers; require every pre-existing method+path still present.
    if (beforeRouteTable.length > 0 && afterRouteTable.length > 0) {
      const afterSet = new Set(afterRouteTable.map((r) => `${r.method}|${r.path}`));
      const missing = beforeRouteTable.filter((r) => !afterSet.has(`${r.method}|${r.path}`));
      if (missing.length > 0 && beforeRoutes !== afterRoutes) {
        checks.push(
          fail(
            "preserve-routes",
            "Public route methods and paths must be preserved",
            `missing:${missing.map((m) => `${m.method} ${m.path}`).join(",")}`,
          ),
        );
        structuredErrors.push("route_table_fingerprint_mismatch");
      } else {
        checks.push(pass("preserve-routes", "Public route methods and paths preserved"));
      }
    } else {
      checks.push(pass("preserve-routes", "Route table not comparable on both sides"));
    }

    const beforeSchemaTable = extractSchemaTable(baseFiles);
    const afterSchemaTable = extractSchemaTable(candidateFiles);
    if (beforeSchemaTable.length > 0 && afterSchemaTable.length > 0) {
      const afterModels = new Set(afterSchemaTable.map((s) => s.modelName));
      const missingModels = beforeSchemaTable.filter((s) => !afterModels.has(s.modelName));
      const beforeSchemas = schemaTableFingerprint(beforeSchemaTable);
      const afterSchemas = schemaTableFingerprint(afterSchemaTable);
      if (missingModels.length > 0 || beforeSchemas !== afterSchemas) {
        // Allow added models (domain module may re-declare); fail only if a prior model vanishes
        // or collection fingerprint for shared names changes.
        const beforeByName = new Map(beforeSchemaTable.map((s) => [s.modelName, s]));
        let collectionDrift = false;
        for (const after of afterSchemaTable) {
          const prev = beforeByName.get(after.modelName);
          if (
            prev &&
            prev.collectionName &&
            after.collectionName &&
            prev.collectionName !== after.collectionName
          ) {
            collectionDrift = true;
          }
        }
        if (missingModels.length > 0 || collectionDrift) {
          checks.push(
            fail(
              "preserve-schemas",
              "Mongoose schemas and collections must be preserved",
              missingModels.length
                ? `missing_models:${missingModels.map((m) => m.modelName).join(",")}`
                : "schema_fingerprint_mismatch",
            ),
          );
          structuredErrors.push("schema_fingerprint_mismatch");
        } else {
          checks.push(pass("preserve-schemas", "Prior models and collections preserved"));
        }
      } else {
        checks.push(pass("preserve-schemas", "Schema/collection fingerprints preserved"));
      }
    } else {
      checks.push(pass("preserve-schemas", "Schema table not comparable on both sides"));
    }
  }

  // budgets already enforced by provider; re-check operation count
  if (input.operations.length > input.stage.budgets.maxOperations) {
    checks.push(
      fail("budget", "Too many operations for stage budget", String(input.operations.length)),
    );
    structuredErrors.push("budget_operations");
  } else {
    checks.push(pass("budget", "Operation count within stage budget"));
  }

  const failed = checks.some((c) => c.outcome === "failed");
  return {
    passed: !failed,
    checks,
    structuredErrors: [...new Set(structuredErrors)],
  };
}
