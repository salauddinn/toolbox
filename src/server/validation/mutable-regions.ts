import type { FileOperation } from "@/core/changes";
import type { MutableAstRegion, ProtectedRegionFingerprint } from "@/core/stages";
import type { SourceSnapshot } from "@/core/repository";
import { parseJavaScript } from "@/server/analysis/parse";
import { traverse } from "@/server/analysis/babel-traverse";
import { createHash } from "node:crypto";

/**
 * Collect top-level binding names from a JavaScript source file.
 */
export function topLevelBindingNames(source: string, filename: string): Set<string> | null {
  const parsed = parseJavaScript(source, filename);
  if (!parsed.ok) return null;
  const names = new Set<string>();
  for (const node of parsed.ast.program.body) {
    if (node.type === "FunctionDeclaration" && node.id) names.add(node.id.name);
    if (node.type === "VariableDeclaration") {
      for (const d of node.declarations) {
        if (d.id.type === "Identifier") names.add(d.id.name);
      }
    }
    if (node.type === "ClassDeclaration" && node.id) names.add(node.id.name);
    if (node.type === "ExpressionStatement" && node.expression.type === "AssignmentExpression") {
      const left = node.expression.left;
      if (left.type === "MemberExpression" && left.object.type === "Identifier") {
        if (left.object.name === "module" || left.object.name === "exports") {
          names.add("module.exports");
        }
      }
    }
  }
  // Also walk for module.exports / exports assignments
  traverse(parsed.ast, {
    AssignmentExpression(path) {
      const left = path.node.left;
      if (left.type === "MemberExpression") {
        if (
          left.object.type === "Identifier" &&
          (left.object.name === "module" || left.object.name === "exports")
        ) {
          names.add("module.exports");
        }
        if (
          left.object.type === "MemberExpression" &&
          left.object.object.type === "Identifier" &&
          left.object.object.name === "module" &&
          left.object.property.type === "Identifier" &&
          left.object.property.name === "exports" &&
          left.property.type === "Identifier"
        ) {
          names.add(left.property.name);
          names.add("module.exports");
        }
      }
    },
  });
  return names;
}

export function fingerprintTopLevel(source: string, filename: string): string {
  const names = topLevelBindingNames(source, filename);
  const key = names ? [...names].sort().join(",") : "unparseable";
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

/**
 * When StagePlan lists mutable regions, reject updates that change top-level
 * bindings outside the allowed symbol set (unless symbols includes "*").
 */
export function validateMutableRegions(input: {
  operations: readonly FileOperation[];
  baseSnapshot: SourceSnapshot;
  candidateSnapshot: SourceSnapshot;
  mutableRegions: readonly MutableAstRegion[];
  protectedFingerprints: readonly ProtectedRegionFingerprint[];
}): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  if (input.mutableRegions.length === 0 && input.protectedFingerprints.length === 0) {
    return { ok: true };
  }

  const regionsByFile = new Map<string, MutableAstRegion[]>();
  for (const region of input.mutableRegions) {
    const list = regionsByFile.get(region.file) ?? [];
    list.push(region);
    regionsByFile.set(region.file, list);
  }

  for (const op of input.operations) {
    if (op.type !== "update") continue;
    const regions = regionsByFile.get(op.path);
    if (!regions || regions.length === 0) {
      // Update outside declared mutable regions when regions are specified
      if (input.mutableRegions.length > 0) {
        errors.push(`update_outside_mutable_regions:${op.path}`);
      }
      continue;
    }
    if (regions.some((r) => r.symbols.includes("*"))) {
      continue;
    }
    const allowed = new Set(regions.flatMap((r) => r.symbols));
    // Always allow module.exports surface when any export-related symbol listed
    if ([...allowed].some((s) => s.includes("export") || s === "router" || s === "app")) {
      allowed.add("module.exports");
    }

    const base = input.baseSnapshot.files.get(op.path as never)?.content ?? "";
    const next = input.candidateSnapshot.files.get(op.path as never)?.content ?? op.content;
    const before = topLevelBindingNames(base, op.path);
    const after = topLevelBindingNames(next, op.path);
    if (!before || !after) continue;

    for (const name of after) {
      if (!before.has(name) && !allowed.has(name) && !allowed.has("*")) {
        // new top-level binding not in allowed set
        errors.push(`protected_region_mutated:${op.path}:${name}`);
      }
    }
    for (const name of before) {
      if (!after.has(name) && !allowed.has(name) && !allowed.has("*")) {
        errors.push(`protected_region_removed:${op.path}:${name}`);
      }
    }
  }

  // Protected fingerprints: when present with real hashes, compare
  for (const pf of input.protectedFingerprints) {
    if (pf.fingerprint === "manifest-locked") {
      // handled by forbidden path checks
      continue;
    }
    const base = input.baseSnapshot.files.get(pf.file as never);
    const next = input.candidateSnapshot.files.get(pf.file as never);
    if (!base || !next) continue;
    if (base.content === next.content) continue;
    const actual = fingerprintTopLevel(next.content, pf.file);
    if (actual !== pf.fingerprint) {
      errors.push(`protected_fingerprint_mismatch:${pf.file}`);
    }
  }

  if (errors.length > 0) return { ok: false, errors };
  return { ok: true };
}
