import { createHash } from "node:crypto";
import type { AnalysisResult } from "@/core/analysis";
import type { RepositoryFile } from "@/core/repository";
import { extractModels } from "@/server/analysis/models";
import { applyMountPrefixes, collectNamedRequires, extractRoutes } from "@/server/analysis/routes";
import { resolveRelativeRequire } from "@/server/analysis/graph";
import type { NormalizedPath } from "@/core/paths";

export type RouteFingerprint = {
  method: string;
  path: string;
};

export type SchemaFingerprint = {
  modelName: string;
  collectionName?: string;
  schemaFingerprint?: string;
};

export function routeTableFingerprint(routes: readonly RouteFingerprint[]): string {
  const lines = routes.map((r) => `${r.method.toUpperCase()} ${r.path}`).sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

export function schemaTableFingerprint(schemas: readonly SchemaFingerprint[]): string {
  const lines = schemas
    .map((s) => `${s.modelName}|${s.collectionName ?? ""}|${s.schemaFingerprint ?? ""}`)
    .sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex");
}

export function extractRouteTable(
  files: readonly RepositoryFile[],
  entryPath: NormalizedPath,
): RouteFingerprint[] {
  const fileSet = new Set(files.filter((f) => f.path.endsWith(".js")).map((f) => f.path));
  const extraction = extractRoutes(files);
  const entryFile = files.find((f) => f.path === entryPath);
  const requireMap = entryFile
    ? collectNamedRequires(entryFile, (from, request) =>
        resolveRelativeRequire(from, request, fileSet),
      )
    : new Map<string, string>();
  const routes = applyMountPrefixes(extraction.routes, extraction.mounts, requireMap);
  // applyMountPrefixes already joins mount into path; do not prefix again.
  return routes.map((r) => ({
    method: r.method,
    path: r.path.replace(/\/+/g, "/") || "/",
  }));
}

export function extractSchemaTable(files: readonly RepositoryFile[]): SchemaFingerprint[] {
  const models = extractModels(files).models;
  return models.map((m) => ({
    modelName: m.modelName,
    collectionName: m.collectionName,
    schemaFingerprint: m.schemaFingerprint,
  }));
}

export function analysisRouteFingerprints(analysis: AnalysisResult): RouteFingerprint[] {
  return analysis.routes.map((r) => ({
    method: r.method,
    // path already includes mount when produced by ExpressAnalyzer
    path: r.path.replace(/\/+/g, "/") || "/",
  }));
}

export function analysisSchemaFingerprints(analysis: AnalysisResult): SchemaFingerprint[] {
  return analysis.models.map((m) => ({
    modelName: m.modelName,
    collectionName: m.collectionName,
    schemaFingerprint: m.schemaFingerprint,
  }));
}
