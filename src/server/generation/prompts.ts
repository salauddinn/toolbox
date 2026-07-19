import type { DomainCandidate } from "@/core/candidates";
import type { AnalysisResult } from "@/core/analysis";
import type { RepositoryFile } from "@/core/repository";
import type { StagePlan } from "@/core/stages";
import { delimitUntrustedSource } from "@/server/ai/provider";
import { cycleInjectionContract } from "@/server/validation/static";

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
    const chunkBytes = Buffer.byteLength(chunk, "utf8");
    if (bytes + chunkBytes > maxBytes) break;
    parts.push(chunk);
    bytes += chunkBytes;
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
    case "cycle_repair": {
      const contract = cycleInjectionContract(input.analysis, input.candidate);
      const factoryName = contract?.factoryName ?? `create${input.candidate.name}Module`;
      const depKey = contract?.dependencyKey ?? "<dependency>Api";
      const depPath = contract?.dependencyPath ?? "<dependency file>";
      const moduleIndexPath = `src/modules/${slug}/index.js`;
      const moduleDirDepth = moduleIndexPath.split("/").length - 1;
      const rootPrefix = "../".repeat(moduleDirDepth);
      return [
        common,
        "Break the supported circular CommonJS dependency using constructor injection.",
        `In the module public index.js, export a factory named EXACTLY "${factoryName}".`,
        `The factory must take EXACTLY one object-pattern parameter with EXACTLY one property: function ${factoryName}({ ${depKey} }) { ... }`,
        `Inside the factory you MUST both use "${depKey}" (call a method on it) AND return it as a property named "${depKey}".`,
        `Export it publicly, for example module.exports = { ${factoryName} } or module.exports.${factoryName} = ${factoryName}.`,
        `In the composition root (${input.analysis.entryPath}), require the module and "${depPath}", then call: <moduleBinding>.${factoryName}({ ${depKey}: <requireBinding> }).`,
        `The dependency "${depPath}" MUST arrive only through the factory parameter "${depKey}". The module must contain NO require of "${depPath}" — re-importing it re-creates the cycle and fails validation.`,
        `Relative requires inside the module must resolve correctly: the public index.js sits ${moduleDirDepth} directories below the repository root, so a require targeting any repository-root file needs exactly ${moduleDirDepth} ascending segments ("${rootPrefix}<path-from-repository-root>"). Do not use fewer segments.`,
        "Preserve all existing route registrations and HTTP methods.",
        "Update only evidenced cycle files, public module entry, and composition root.",
        "No file creation or deletion.",
        'Return JSON {"operations":[...]} only.',
      ].join("\n");
    }
    case "integration_cleanup":
      return [
        common,
        "Rewire remaining supported consumers to import the Domain Module through its public index.js facade only.",
        'For any file that already exists, emit an "update" operation; use "create" only for files that do not yet exist.',
        "Every route listed above (each HTTP method and path) must remain registered after rewiring; do not remove or rename existing route registrations.",
        "Delete only selected-domain legacy files that are superseded and provably unreferenced.",
        "Preserve HTTP methods, paths, Mongoose schemas, and collection names.",
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
