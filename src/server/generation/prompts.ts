import type { DomainCandidate } from "@/core/candidates";
import type { AnalysisResult } from "@/core/analysis";
import type { RepositoryFile } from "@/core/repository";
import type { StagePlan } from "@/core/stages";
import { delimitUntrustedSource } from "@/server/ai/provider";

function domainSlug(candidate: DomainCandidate): string {
  return (
    candidate.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || candidate.id
  );
}

function pickRelevantFiles(
  files: readonly RepositoryFile[],
  candidate: DomainCandidate,
  analysis: AnalysisResult,
  maxFiles = 12,
  maxBytes = 48_000,
): string {
  const wanted = new Set<string>([
    ...candidate.files,
    analysis.entryPath,
    "package.json",
    ...candidate.routes.map((r) => r.file),
  ]);
  if (candidate.primaryModel) wanted.add(candidate.primaryModel.file);

  const selected: RepositoryFile[] = [];
  for (const f of files) {
    if (wanted.has(f.path) || f.path.startsWith("tests/") || f.path.startsWith("test/")) {
      selected.push(f);
    }
  }
  // Prefer candidate files first
  selected.sort((a, b) => {
    const aC = candidate.files.includes(a.path) ? 0 : 1;
    const bC = candidate.files.includes(b.path) ? 0 : 1;
    return aC - bC || a.path.localeCompare(b.path);
  });

  const parts: string[] = [];
  let bytes = 0;
  for (const f of selected.slice(0, maxFiles)) {
    const chunk = `// FILE: ${f.path}\n${f.content}`;
    if (bytes + chunk.length > maxBytes) break;
    parts.push(chunk);
    bytes += chunk.length;
  }
  return parts.join("\n\n");
}

export function buildStageInstructions(input: {
  stage: StagePlan;
  candidate: DomainCandidate;
  analysis: AnalysisResult;
}): string {
  const slug = domainSlug(input.candidate);
  const routes = input.candidate.routes
    .map((r) => `${r.method.toUpperCase()} ${r.mountPrefix ?? ""}${r.path} @ ${r.file}:${r.line}`)
    .join("\n");

  const common = [
    `Domain candidate: ${input.candidate.name} (${input.candidate.id})`,
    `Module slug: ${slug}`,
    `Application entry: ${input.analysis.entryPath}`,
    `Routes:\n${routes || "(none listed)"}`,
    `Stage purpose (do not change): ${input.stage.purpose}`,
    `Expected files: ${input.stage.expectedFiles.join(", ")}`,
  ].join("\n");

  switch (input.stage.kind) {
    case "behavior_capture":
      return [
        common,
        "Create EXACTLY one new characterization test file under the existing test root.",
        "Use Jest + Supertest patterns already present in the repository.",
        "Do not modify production files or existing tests.",
        "Do not claim tests were executed.",
        'Return JSON {"operations":[...]} only.',
      ].join("\n");
    case "domain_module":
      return [
        common,
        `Create Domain Module under src/modules/${slug}/ with:`,
        `  index.js, ${slug}.routes.js, ${slug}.controller.js, ${slug}.service.js, ${slug}.repository.js, ${slug}.model.js`,
        "Public index.js must be the only external entry (module.exports facade).",
        "Dependency direction: routes → controller → service → repository → model.",
        "Update route registration in the app entry to use the new module public entry.",
        "Do not delete legacy files in this stage.",
        "Preserve HTTP methods, paths, Mongoose schemas and collection names.",
        'Return JSON {"operations":[...]} only.',
      ].join("\n");
    case "cycle_repair":
      return [
        common,
        "Remove the supported circular CommonJS dependency for this domain.",
        "Export a factory from the module public index.js.",
        "Inject the dependency from the application composition root (entry).",
        "Update only evidenced cycle files, public module entry, and composition root.",
        "No file creation or deletion.",
        'Return JSON {"operations":[...]} only.',
      ].join("\n");
    case "integration_cleanup":
      return [
        common,
        "Rewire remaining supported consumers to the Domain Module public facade (index.js only).",
        "Delete only selected-domain legacy files that are superseded and unreferenced.",
        "Preserve routes, methods, schemas and collections.",
        'Return JSON {"operations":[...]} only.',
      ].join("\n");
    default:
      return common;
  }
}

export function buildUntrustedBlock(input: {
  files: readonly RepositoryFile[];
  candidate: DomainCandidate;
  analysis: AnalysisResult;
}): string {
  return delimitUntrustedSource(pickRelevantFiles(input.files, input.candidate, input.analysis));
}
