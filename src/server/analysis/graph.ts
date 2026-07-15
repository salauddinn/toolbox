import type { CallExpression, StringLiteral } from "@babel/types";
import type { DependencyCycle, DependencyEdge, DependencyGraph } from "@/core/analysis";
import type { NormalizedPath } from "@/core/paths";
import { normalizeRepositoryPath } from "@/core/paths";
import type { RepositoryFile } from "@/core/repository";
import { traverse, type NodePath } from "./babel-traverse";
import { parseJavaScript } from "./parse";

function dirnamePosix(filePath: string): string {
  const idx = filePath.lastIndexOf("/");
  return idx === -1 ? "" : filePath.slice(0, idx);
}

function joinPosix(dir: string, rel: string): string {
  const base = dir ? dir.split("/") : [];
  for (const part of rel.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      base.pop();
      continue;
    }
    base.push(part);
  }
  return base.join("/");
}

/**
 * Resolve a relative CommonJS require string against the importer path.
 * Only relative string literals are supported.
 */
export function resolveRelativeRequire(
  fromFile: NormalizedPath,
  request: string,
  fileSet: ReadonlySet<string>,
): NormalizedPath | null {
  if (!request.startsWith("./") && !request.startsWith("../")) {
    return null;
  }
  const dir = dirnamePosix(fromFile);
  const joined = joinPosix(dir, request);
  const candidates = [joined, `${joined}.js`, `${joined}/index.js`];
  for (const candidate of candidates) {
    const normalized = normalizeRepositoryPath(candidate);
    if (normalized.ok && fileSet.has(normalized.path)) {
      return normalized.path;
    }
  }
  return null;
}

function isRequireCall(path: NodePath<CallExpression>): path is NodePath<CallExpression> {
  const callee = path.node.callee;
  return callee.type === "Identifier" && callee.name === "require";
}

export function extractRequireEdges(
  file: RepositoryFile,
  fileSet: ReadonlySet<string>,
): DependencyEdge[] {
  const parsed = parseJavaScript(file.content, file.path);
  if (!parsed.ok) {
    return [];
  }
  const edges: DependencyEdge[] = [];
  traverse(parsed.ast, {
    CallExpression(path) {
      if (!isRequireCall(path)) return;
      const arg = path.node.arguments[0];
      if (!arg || arg.type !== "StringLiteral") return;
      const request = (arg as StringLiteral).value;
      const to = resolveRelativeRequire(file.path, request, fileSet);
      if (!to) return;
      edges.push({
        from: file.path,
        to,
        line: path.node.loc?.start.line ?? 1,
      });
    },
  });
  return edges;
}

function reachableFrom(
  entry: NormalizedPath,
  adjacency: Map<string, NormalizedPath[]>,
): Set<NormalizedPath> {
  const seen = new Set<NormalizedPath>();
  const stack: NormalizedPath[] = [entry];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (seen.has(node)) continue;
    seen.add(node);
    for (const next of adjacency.get(node) ?? []) {
      if (!seen.has(next)) stack.push(next);
    }
  }
  return seen;
}

/**
 * Tarjan SCC to list cycles with at least two nodes (or a self-loop).
 */
export function findCycles(edges: readonly DependencyEdge[]): DependencyCycle[] {
  const nodes = new Set<string>();
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    nodes.add(edge.from);
    nodes.add(edge.to);
    const list = adj.get(edge.from) ?? [];
    list.push(edge.to);
    adj.set(edge.from, list);
  }

  let index = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const sccs: string[][] = [];

  function strongconnect(v: string): void {
    indices.set(v, index);
    lowlink.set(v, index);
    index += 1;
    stack.push(v);
    onStack.add(v);

    for (const w of adj.get(v) ?? []) {
      if (!indices.has(w)) {
        strongconnect(w);
        lowlink.set(v, Math.min(lowlink.get(v)!, lowlink.get(w)!));
      } else if (onStack.has(w)) {
        lowlink.set(v, Math.min(lowlink.get(v)!, indices.get(w)!));
      }
    }

    if (lowlink.get(v) === indices.get(v)) {
      const comp: string[] = [];
      while (true) {
        const w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
        if (w === v) break;
      }
      sccs.push(comp);
    }
  }

  for (const node of nodes) {
    if (!indices.has(node)) strongconnect(node);
  }

  const cycles: DependencyCycle[] = [];
  for (const comp of sccs) {
    if (comp.length > 1) {
      const set = new Set(comp);
      const cycleEdges = edges.filter((e) => set.has(e.from) && set.has(e.to));
      cycles.push({
        files: comp as NormalizedPath[],
        edges: cycleEdges,
      });
    } else if (comp.length === 1) {
      const self = edges.filter((e) => e.from === comp[0] && e.to === comp[0]);
      if (self.length > 0) {
        cycles.push({ files: [comp[0] as NormalizedPath], edges: self });
      }
    }
  }
  return cycles;
}

export function buildDependencyGraph(
  files: readonly RepositoryFile[],
  entryPath: NormalizedPath,
): DependencyGraph {
  const jsFiles = files.filter((f) => f.path.endsWith(".js"));
  const fileSet = new Set(jsFiles.map((f) => f.path));
  const edges: DependencyEdge[] = [];
  for (const file of jsFiles) {
    edges.push(...extractRequireEdges(file, fileSet));
  }

  const adjacency = new Map<string, NormalizedPath[]>();
  for (const edge of edges) {
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  }

  const entryReachable = fileSet.has(entryPath)
    ? reachableFrom(entryPath, adjacency)
    : new Set<NormalizedPath>();

  const cycles = findCycles(edges).filter((cycle) =>
    cycle.files.some((f) => entryReachable.has(f)),
  );

  return {
    nodes: [...fileSet].sort() as NormalizedPath[],
    edges,
    entryReachable,
    cycles,
  };
}
