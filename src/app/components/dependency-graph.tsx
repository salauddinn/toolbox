"use client";

import { useMemo } from "react";
import { Background, Controls, MarkerType, ReactFlow, type Edge, type Node } from "@xyflow/react";
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

function shortLabel(path: string): string {
  const parts = path.split("/");
  return parts.length > 2 ? `…/${parts.slice(-2).join("/")}` : path;
}

type Props = {
  graph: GraphPayload;
  onSelectFile?: (file: string) => void;
};

export function DependencyGraph({ graph, onSelectFile }: Props) {
  const cycleEdgeKeys = useMemo(() => {
    const set = new Set<string>();
    for (const cycle of graph.cycles) {
      for (const e of cycle.edges) {
        set.add(`${e.from}->${e.to}`);
      }
    }
    return set;
  }, [graph.cycles]);

  const { nodes, edges } = useMemo(() => {
    const list = [...graph.nodes];
    const cols = Math.max(1, Math.ceil(Math.sqrt(list.length)));
    const flowNodes: Node[] = list.map((path, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const isEntry = path === graph.entryPath;
      return {
        id: path,
        position: { x: col * 220, y: row * 100 },
        data: { label: shortLabel(path) },
        style: {
          fontSize: 11,
          padding: 8,
          borderRadius: 8,
          border: isEntry ? "2px solid var(--accent)" : "1px solid var(--border)",
          background: "var(--surface)",
          color: "var(--foreground)",
          width: 180,
        },
      };
    });

    const flowEdges: Edge[] = graph.edges.map((e, i) => {
      const key = `${e.from}->${e.to}`;
      const inCycle = cycleEdgeKeys.has(key);
      return {
        id: `e-${i}-${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        label: `L${e.line}`,
        markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
        style: { stroke: inCycle ? "#dc2626" : "var(--muted)" },
        labelStyle: { fontSize: 10, fill: "var(--muted)" },
        animated: inCycle,
      };
    });

    return { nodes: flowNodes, edges: flowEdges };
  }, [graph, cycleEdgeKeys]);

  if (graph.nodes.length === 0) {
    return <p className="text-sm text-muted">No entry-reachable dependency edges detected.</p>;
  }

  return (
    <div className="h-80 w-full overflow-hidden rounded-lg border border-border bg-background">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        onNodeClick={(_event, node) => onSelectFile?.(node.id)}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable
      >
        <Background gap={16} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
