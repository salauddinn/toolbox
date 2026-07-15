import type { FileOperation } from "@/core/changes";
import type { AnalysisResult } from "@/core/analysis";
import type { DomainCandidate } from "@/core/candidates";
import type { SourceSnapshot } from "@/core/repository";
import type { StagePlan } from "@/core/stages";
import type { ValidationCheck } from "@/core/validation";
import { parseJavaScript } from "@/server/analysis/parse";
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
  } else if (input.stage.mutableRegions.length > 0 || input.stage.protectedFingerprints.length > 0) {
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
    const candidateFileSet = new Set(input.candidate.files);
    const remaining = graph.cycles.filter((c) => c.files.some((f) => candidateFileSet.has(f)));
    if (remaining.length > 0) {
      checks.push(
        fail(
          "cycle-absent",
          "Supported circular dependency must be removed",
          remaining.map((c) => c.files.join("→")).join("; "),
        ),
      );
      structuredErrors.push("cycle_still_present");
    } else {
      checks.push(pass("cycle-absent", "Entry-reachable cycle no longer present"));
    }
    const index = input.candidateSnapshot.files.get(`${moduleRoot}/index.js` as typeof entryPath);
    const hasFactory =
      index &&
      (/create\w*|factory|inject/i.test(index.content) ||
        /module\.exports\.create/.test(index.content));
    if (!hasFactory) {
      checks.push(
        fail(
          "factory-injection",
          "Public module factory required for cycle repair",
          `${moduleRoot}/index.js`,
        ),
      );
      structuredErrors.push("missing_factory_export");
    } else {
      checks.push(pass("factory-injection", "Public factory present on module index"));
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

  // 6. Route/schema preservation for non-behavior stages that touch production
  if (input.stage.kind !== "behavior_capture") {
    const beforeRoutes = routeTableFingerprint(
      extractRouteTable(baseFiles, entryPath).length
        ? extractRouteTable(baseFiles, entryPath)
        : input.analysis.routes.map((r) => ({
            method: r.method,
            path: `${r.mountPrefix ?? ""}${r.path}`,
          })),
    );
    const afterRoutes = routeTableFingerprint(extractRouteTable(candidateFiles, entryPath));
    // Soft check: if we could extract routes both sides, compare
    const beforeCount = extractRouteTable(baseFiles, entryPath).length;
    const afterCount = extractRouteTable(candidateFiles, entryPath).length;
    if (beforeCount > 0 && afterCount > 0 && beforeRoutes !== afterRoutes) {
      // Allow path-equivalent rewrites if methods+paths multiset same — already hashed
      checks.push(
        fail(
          "preserve-routes",
          "Public route methods and paths must be preserved",
          "route_table_fingerprint_mismatch",
        ),
      );
      structuredErrors.push("route_table_fingerprint_mismatch");
    } else {
      checks.push(pass("preserve-routes", "Route table fingerprint preserved or not comparable"));
    }

    const beforeSchemas = schemaTableFingerprint(extractSchemaTable(baseFiles));
    const afterSchemas = schemaTableFingerprint(extractSchemaTable(candidateFiles));
    if (
      extractSchemaTable(baseFiles).length > 0 &&
      extractSchemaTable(candidateFiles).length > 0 &&
      beforeSchemas !== afterSchemas
    ) {
      checks.push(
        fail(
          "preserve-schemas",
          "Mongoose schemas and collections must be preserved",
          "schema_fingerprint_mismatch",
        ),
      );
      structuredErrors.push("schema_fingerprint_mismatch");
    } else {
      checks.push(pass("preserve-schemas", "Schema/collection fingerprints preserved"));
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
