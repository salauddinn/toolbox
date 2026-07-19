"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type EdgeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

export type GraphPayload = {
  nodes: readonly string[];
  edges: readonly { from: string; to: string; line: number }[];
  cycles: readonly {
    files: readonly string[];
    edges: readonly { from: string; to: string; line: number }[];
  }[];
  entryPath: string;
};

export type GraphFileContextSelection = {
  file: string;
  line?: number;
};

type Props = {
  graph: GraphPayload;
  /** Opens path/line file context only — never fabricates evidence fields. */
  onSelectFileContext?: (selection: GraphFileContextSelection) => void;
};

function shortLabel(path: string): string {
  const parts = path.split("/");
  return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : path;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

export function DependencyGraph({ graph, onSelectFileContext }: Props) {
  const prefersReducedMotion = usePrefersReducedMotion();

  const cycleNodeIds = useMemo(() => {
    const set = new Set<string>();
    for (const cycle of graph.cycles) {
      for (const file of cycle.files) {
        set.add(file);
      }
    }
    return set;
  }, [graph.cycles]);

  const cycleEdgeKeys = useMemo(() => {
    const set = new Set<string>();
    for (const cycle of graph.cycles) {
      for (const e of cycle.edges) {
        set.add(`${e.from}->${e.to}`);
      }
    }
    return set;
  }, [graph.cycles]);

  const edgeMeta = useMemo(() => {
    const map = new Map<string, { from: string; to: string; line: number; inCycle: boolean }>();
    graph.edges.forEach((e, i) => {
      const key = `${e.from}->${e.to}`;
      const id = `e-${i}-${e.from}-${e.to}`;
      map.set(id, {
        from: e.from,
        to: e.to,
        line: e.line,
        inCycle: cycleEdgeKeys.has(key),
      });
    });
    return map;
  }, [graph.edges, cycleEdgeKeys]);

  const { nodes, edges } = useMemo(() => {
    const list = [...graph.nodes];
    const cols = Math.max(1, Math.ceil(Math.sqrt(list.length)));
    const flowNodes: Node[] = list.map((path, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const isEntry = path === graph.entryPath;
      const inCycle = cycleNodeIds.has(path);
      const badges: string[] = [];
      if (isEntry) badges.push("entry");
      if (inCycle) badges.push("cycle");
      const badgeText = badges.length > 0 ? ` [${badges.join(", ")}]` : "";
      const label = `${shortLabel(path)}${badgeText}`;

      return {
        id: path,
        position: { x: col * 220, y: row * 110 },
        data: { label },
        ariaLabel: `${path}${isEntry ? ", entry point" : ""}${inCycle ? ", participates in a dependency cycle" : ""}`,
        style: {
          fontSize: 11,
          padding: 8,
          borderRadius: 8,
          border: isEntry
            ? "2px solid var(--accent)"
            : inCycle
              ? "2px dashed var(--danger, #b42318)"
              : "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--foreground)",
          width: 190,
          boxShadow: inCycle
            ? "inset 0 0 0 1px color-mix(in srgb, #b42318 35%, transparent)"
            : undefined,
        },
      };
    });

    const flowEdges: Edge[] = graph.edges.map((e, i) => {
      const key = `${e.from}->${e.to}`;
      const inCycle = cycleEdgeKeys.has(key);
      const lineLabel = `L${e.line}`;
      const label = inCycle ? `${lineLabel} · cycle` : lineLabel;
      return {
        id: `e-${i}-${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        label,
        ariaLabel: inCycle
          ? `Dependency from ${e.from} to ${e.to} at line ${e.line}, cycle edge`
          : `Dependency from ${e.from} to ${e.to} at line ${e.line}`,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: {
          stroke: inCycle ? "#b42318" : "var(--muted)",
          strokeWidth: inCycle ? 2 : 1.25,
        },
        labelStyle: {
          fontSize: 10,
          fill: inCycle ? "#b42318" : "var(--muted)",
          fontWeight: inCycle ? 600 : 400,
        },
        // Labels carry cycle meaning; animation is supplemental and disabled for reduced motion.
        animated: inCycle && !prefersReducedMotion,
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [graph, cycleEdgeKeys, cycleNodeIds, prefersReducedMotion]);

  const onNodeClick: NodeMouseHandler = (_event, node) => {
    onSelectFileContext?.({ file: node.id });
  };

  const onEdgeClick: EdgeMouseHandler = (_event, edge) => {
    const meta = edgeMeta.get(edge.id);
    if (!meta) return;
    // Require site lives in the importer (`from`) at `line`.
    onSelectFileContext?.({ file: meta.from, line: meta.line });
  };

  if (graph.nodes.length === 0) {
    return <p className="text-sm text-muted">No entry-reachable dependency edges detected.</p>;
  }

  const cycleCount = graph.cycles.length;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 text-[11px] text-text-secondary">
        <span className="tb-chip">entry labeled</span>
        <span className="tb-chip tb-chip-warn">
          {cycleCount === 0
            ? "no cycles"
            : cycleCount === 1
              ? "1 cycle · dashed + text label"
              : `${cycleCount} cycles · dashed + text label`}
        </span>
        {prefersReducedMotion ? (
          <span className="tb-chip" data-testid="graph-reduced-motion">
            reduced motion: cycle animation off
          </span>
        ) : null}
      </div>
      <div
        className="h-80 w-full overflow-hidden rounded-lg border border-border bg-background"
        data-testid="dependency-graph"
        role="group"
        aria-label="Entry-reachable dependency graph. Cycle participation uses text labels and dashed borders, not color alone."
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          minZoom={0.35}
          proOptions={{ hideAttribution: true }}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
        >
          <Background gap={16} size={1} />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
      <p className="text-[11px] text-text-quiet">
        Node selection opens file path context. Edge selection opens the importer path and require
        line. Neither invents evidence rule, severity, message, or snippet.
      </p>
    </div>
  );
}
