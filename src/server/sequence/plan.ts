import type { AnalysisResult, DependencyCycle } from "@/core/analysis";
import type { DomainCandidate } from "@/core/candidates";
import type { Evidence } from "@/core/evidence";
import { assertNormalizedPath, type NormalizedPath } from "@/core/paths";
import {
  DEFAULT_STAGE_BUDGETS,
  type ModernizationSequencePlan,
  type PendingConditionalMarker,
  type StagePlan,
} from "@/core/stages";
import { buildDependencyGraph } from "@/server/analysis/graph";
import type { RepositoryFile } from "@/core/repository";

function ev(
  ruleId: string,
  message: string,
  file: string,
  line: number,
  snippet: string,
  severity: Evidence["severity"] = "info",
): Evidence {
  return {
    ruleId,
    message,
    severity,
    file: assertNormalizedPath(file),
    line,
    snippet: snippet.slice(0, 200),
  };
}

function domainSlug(candidate: DomainCandidate): string {
  return (
    candidate.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || candidate.id
  );
}

function testRoot(files: readonly RepositoryFile[]): string {
  if (files.some((f) => f.path.startsWith("tests/"))) return "tests";
  if (files.some((f) => f.path.startsWith("test/"))) return "test";
  if (files.some((f) => f.path.startsWith("__tests__/"))) return "__tests__";
  return "tests";
}

function cycleEvidence(cycles: readonly DependencyCycle[]): Evidence[] {
  return cycles.flatMap((cycle) =>
    cycle.edges.map((edge) =>
      ev(
        "pending-cycle",
        `Cycle edge ${edge.from} → ${edge.to}`,
        edge.from,
        edge.line,
        cycle.files.join(" → "),
        "warning",
      ),
    ),
  );
}

function candidateCycle(analysis: AnalysisResult, candidate: DomainCandidate): DependencyCycle[] {
  const files = new Set(candidate.files);
  return analysis.graph.cycles.filter((c) => c.files.some((f) => files.has(f)));
}

function behaviorCapturePlan(
  candidate: DomainCandidate,
  _analysis: AnalysisResult,
  files: readonly RepositoryFile[],
): StagePlan & { kind: "behavior_capture" } {
  const root = testRoot(files);
  const testFile = assertNormalizedPath(
    `${root}/${domainSlug(candidate)}.characterization.test.js`,
  );
  return {
    id: "stage-behavior-capture",
    kind: "behavior_capture",
    title: "Capture existing behaviour",
    purpose:
      "Generate characterization tests for the selected domain's existing HTTP routes using the repository's Jest/Supertest harness. Do not change production code.",
    conditional: false as const,
    evidence: candidate.routes
      .slice(0, 6)
      .map((r) =>
        ev("behavior-route", `${r.method.toUpperCase()} ${r.path}`, r.file, r.line, r.path),
      ),
    expectedFiles: [testFile],
    pathEnvelope: {
      create: [`${root}/*.test.js`, `${root}/**/*.test.js`],
      update: [],
      delete: [],
    },
    mutableRegions: [],
    protectedFingerprints: [
      {
        file: assertNormalizedPath("package.json"),
        fingerprint: "manifest-locked",
        description: "package.json must not change",
      },
    ],
    validationCriteria: [
      {
        id: "one-new-test-file",
        description: "Exactly one new test file under the existing test root",
        kind: "static",
      },
      {
        id: "no-production-edits",
        description: "No production file creates, updates, or deletes",
        kind: "static",
      },
      {
        id: "parse-js",
        description: "Generated JavaScript parses",
        kind: "static",
      },
    ],
    budgets: { ...DEFAULT_STAGE_BUDGETS },
  };
}

function domainModulePlan(
  candidate: DomainCandidate,
  analysis: AnalysisResult,
): StagePlan & { kind: "domain_module" } {
  const slug = domainSlug(candidate);
  const moduleRoot = `src/modules/${slug}`;
  const moduleFiles = [
    `${moduleRoot}/index.js`,
    `${moduleRoot}/${slug}.routes.js`,
    `${moduleRoot}/${slug}.controller.js`,
    `${moduleRoot}/${slug}.service.js`,
    `${moduleRoot}/${slug}.repository.js`,
    `${moduleRoot}/${slug}.model.js`,
  ].map((p) => assertNormalizedPath(p));

  const routeRegistration = candidate.routes[0]?.file ?? analysis.entryPath;

  return {
    id: "stage-domain-module",
    kind: "domain_module",
    title: "Create the Domain Module",
    purpose:
      "Create the standard Domain Module shape with one public index.js and switch selected HTTP route registration to the module entry without deleting legacy files.",
    conditional: false as const,
    evidence: [
      ...candidate.signals.slice(0, 4),
      ...candidate.routes
        .slice(0, 3)
        .map((r) =>
          ev("module-route", `${r.method.toUpperCase()} ${r.path}`, r.file, r.line, r.path),
        ),
    ],
    expectedFiles: [...moduleFiles, routeRegistration],
    pathEnvelope: {
      create: [`${moduleRoot}/**`],
      // Entry (composition root) is the evidenced mount site for MVP controlled wiring.
      update: [...new Set([routeRegistration, analysis.entryPath])],
      delete: [],
    },
    mutableRegions: [
      {
        // Composition-root rewiring may introduce a module binding identifier.
        file: analysis.entryPath,
        symbols: ["*"],
      },
      ...(routeRegistration !== analysis.entryPath
        ? [
            {
              file: routeRegistration,
              symbols: ["*"] as const,
            },
          ]
        : []),
    ],
    protectedFingerprints: [
      {
        file: assertNormalizedPath("package.json"),
        fingerprint: "manifest-locked",
        description: "package.json must not change",
      },
    ],
    validationCriteria: [
      {
        id: "module-shape",
        description: "Required module files and public index.js exist",
        kind: "static",
      },
      {
        id: "dependency-direction",
        description: "routes → controller → service → repository → model",
        kind: "static",
      },
      {
        id: "no-deletes",
        description: "No file deletions in this stage",
        kind: "static",
      },
      {
        id: "preserve-routes",
        description: "Public route paths and methods preserved",
        kind: "static",
      },
    ],
    budgets: { ...DEFAULT_STAGE_BUDGETS },
  };
}

function integrationPlan(
  candidate: DomainCandidate,
  analysis: AnalysisResult,
): StagePlan & { kind: "integration_cleanup" } {
  const slug = domainSlug(candidate);
  const candidateSet = new Set(candidate.files.map((f) => f as string));
  // Files that depend on the selected domain (evidenced consumers) may be rewired.
  const consumers = [
    ...new Set(
      analysis.graph.edges
        .filter((e) => candidateSet.has(e.to as string) && !candidateSet.has(e.from as string))
        .map((e) => e.from as string),
    ),
  ];
  const updateAllow = [
    ...new Set([
      analysis.entryPath as string,
      `src/modules/${slug}/index.js`,
      ...candidate.files.map((f) => f as string),
      ...consumers,
    ]),
  ];
  return {
    id: "stage-integration-cleanup",
    kind: "integration_cleanup",
    title: "Integrate and clean up",
    purpose:
      "Rewire remaining supported consumers to the Domain Module public facade and remove superseded selected-domain legacy files that are unreferenced.",
    conditional: false as const,
    evidence: candidate.files
      .slice(0, 6)
      .map((file) => ev("integration-file", "Candidate file in cleanup scope", file, 1, file)),
    expectedFiles: [assertNormalizedPath(`src/modules/${slug}/index.js`), analysis.entryPath],
    pathEnvelope: {
      create: [],
      update: updateAllow,
      delete: candidate.files.map((f) => f as string),
    },
    mutableRegions: updateAllow.map((file) => ({
      file: assertNormalizedPath(file),
      symbols: ["*"] as const,
    })),
    protectedFingerprints: [
      {
        file: assertNormalizedPath("package.json"),
        fingerprint: "manifest-locked",
        description: "package.json must not change",
      },
    ],
    validationCriteria: [
      {
        id: "public-facade",
        description: "External imports use module index.js only",
        kind: "static",
      },
      {
        id: "no-stale-wiring",
        description: "Superseded legacy domain wiring removed when unreferenced",
        kind: "static",
      },
      {
        id: "preserve-schemas",
        description: "Mongoose schemas and collection names unchanged",
        kind: "static",
      },
    ],
    budgets: { ...DEFAULT_STAGE_BUDGETS },
  };
}

function cycleRepairPlan(
  candidate: DomainCandidate,
  cycles: readonly DependencyCycle[],
  analysis: AnalysisResult,
): StagePlan & { kind: "cycle_repair"; conditional: true } {
  const slug = domainSlug(candidate);
  const cycleFiles = [...new Set(cycles.flatMap((c) => c.files))];
  return {
    id: "stage-cycle-repair",
    kind: "cycle_repair",
    conditional: true,
    title: "Resolve circular dependency",
    purpose:
      "Replace the selected domain's direct cyclic import with a factory exported from index.js and supplied by the application composition root.",
    evidence: cycleEvidence(cycles),
    expectedFiles: [
      ...new Set([
        assertNormalizedPath(`src/modules/${slug}/index.js`),
        analysis.entryPath,
        ...cycleFiles,
      ]),
    ],
    pathEnvelope: {
      create: [],
      update: [
        ...new Set([
          `src/modules/${slug}/index.js`,
          analysis.entryPath as string,
          ...cycleFiles.map((f) => f as string),
        ]),
      ],
      delete: [],
    },
    mutableRegions: [
      {
        file: analysis.entryPath,
        symbols: ["*"],
      },
      {
        file: assertNormalizedPath(`src/modules/${slug}/index.js`),
        symbols: ["*"],
      },
      ...cycleFiles.map((file) => ({
        file,
        symbols: ["*"] as const,
      })),
    ],
    protectedFingerprints: [],
    validationCriteria: [
      {
        id: "cycle-absent",
        description: "Original entry-reachable cycle is absent after repair",
        kind: "static",
      },
      {
        id: "factory-injection",
        description: "Public module factory has the supported injected dependency shape",
        kind: "static",
      },
      {
        id: "composition-root-injection",
        description: "Recognized composition root supplies that dependency to the public factory",
        kind: "static",
      },
      {
        id: "no-create-delete",
        description: "No file creation or deletion in cycle repair",
        kind: "static",
      },
    ],
    budgets: { ...DEFAULT_STAGE_BUDGETS },
  };
}

/**
 * Build the deterministic three required Stage Plans.
 * Pending conditional marker is set from initial graph; final cycle stage is inserted only after module acceptance.
 * AI cannot change stage count, trigger, or purpose.
 */
export function planModernizationSequence(input: {
  candidate: DomainCandidate;
  analysis: AnalysisResult;
  files: readonly RepositoryFile[];
}): ModernizationSequencePlan {
  const cycles = candidateCycle(input.analysis, input.candidate);
  const requiredStages = [
    behaviorCapturePlan(input.candidate, input.analysis, input.files),
    domainModulePlan(input.candidate, input.analysis),
    integrationPlan(input.candidate, input.analysis),
  ] as const;

  let pendingConditional: PendingConditionalMarker | undefined;
  if (cycles.length > 0) {
    pendingConditional = {
      kind: "cycle_repair",
      reason:
        "Supported circular CommonJS dependency is entry-reachable; will re-check after Domain Module acceptance",
      evidence: cycleEvidence(cycles),
      status: "pending_post_module_recalc",
    };
  }

  return {
    requiredStages: requiredStages as ModernizationSequencePlan["requiredStages"],
    pendingConditional,
  };
}

/**
 * After Domain Module acceptance, recalculate the entry-reachable graph.
 * Insert the conditional cycle-repair Stage Plan only if the supported cycle remains.
 */
export function resolveConditionalStage(input: {
  candidate: DomainCandidate;
  analysis: AnalysisResult;
  files: readonly RepositoryFile[];
  sequence: ModernizationSequencePlan;
  entryPath: NormalizedPath;
}): ModernizationSequencePlan {
  if (!input.sequence.pendingConditional) {
    return input.sequence;
  }

  const graph = buildDependencyGraph(input.files, input.entryPath);
  const candidateFiles = new Set(input.candidate.files);
  const remaining = graph.cycles.filter((c) => c.files.some((f) => candidateFiles.has(f)));

  if (remaining.length === 0) {
    return {
      requiredStages: input.sequence.requiredStages,
      // Marker resolved — no conditional stage
    };
  }

  return {
    requiredStages: input.sequence.requiredStages,
    pendingConditional: input.sequence.pendingConditional,
    conditionalStage: cycleRepairPlan(input.candidate, remaining, {
      ...input.analysis,
      graph,
    }),
  };
}

/** Ordered stages for UI and execution (3 or 4). */
export function listSequenceStages(sequence: ModernizationSequencePlan): StagePlan[] {
  const [capture, module, integration] = sequence.requiredStages;
  if (sequence.conditionalStage) {
    return [capture, module, sequence.conditionalStage, integration];
  }
  return [capture, module, integration];
}
