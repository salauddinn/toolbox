// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@xyflow/react/dist/style.css", () => ({}));

import { DependencyGraph, type GraphPayload } from "./dependency-graph";

const graph: GraphPayload = {
  entryPath: "app.js",
  nodes: ["app.js", "routes/orders.js", "services/orders.js"],
  edges: [
    { from: "app.js", to: "routes/orders.js", line: 10 },
    { from: "routes/orders.js", to: "services/orders.js", line: 4 },
    { from: "services/orders.js", to: "routes/orders.js", line: 22 },
  ],
  cycles: [
    {
      files: ["routes/orders.js", "services/orders.js"],
      edges: [
        { from: "routes/orders.js", to: "services/orders.js", line: 4 },
        { from: "services/orders.js", to: "routes/orders.js", line: 22 },
      ],
    },
  ],
};

type FlowNode = {
  id: string;
  data: { label: string };
  ariaLabel?: string;
  style?: Record<string, unknown>;
};

type FlowEdge = {
  id: string;
  source: string;
  target: string;
  label?: ReactNode;
  animated?: boolean;
  ariaLabel?: string;
};

let lastFlowProps: {
  nodes: FlowNode[];
  edges: FlowEdge[];
  onNodeClick?: (event: unknown, node: FlowNode) => void;
  onEdgeClick?: (event: unknown, edge: FlowEdge) => void;
  minZoom?: number;
} | null = null;

vi.mock("@xyflow/react", () => ({
  MarkerType: { ArrowClosed: "arrowclosed" },
  Background: () => null,
  Controls: () => null,
  ReactFlow: (props: {
    nodes: FlowNode[];
    edges: FlowEdge[];
    onNodeClick?: (event: unknown, node: FlowNode) => void;
    onEdgeClick?: (event: unknown, edge: FlowEdge) => void;
    minZoom?: number;
    children?: ReactNode;
  }) => {
    lastFlowProps = {
      nodes: props.nodes,
      edges: props.edges,
      onNodeClick: props.onNodeClick,
      onEdgeClick: props.onEdgeClick,
      minZoom: props.minZoom,
    };
    return (
      <div data-testid="mock-react-flow">
        {props.nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            data-testid={`graph-node-${node.id}`}
            aria-label={node.ariaLabel ?? String(node.data.label)}
            onClick={() => props.onNodeClick?.({}, node)}
          >
            {String(node.data.label)}
          </button>
        ))}
        {props.edges.map((edge) => (
          <button
            key={edge.id}
            type="button"
            data-testid={`graph-edge-${edge.id}`}
            aria-label={edge.ariaLabel ?? String(edge.label ?? edge.id)}
            data-animated={edge.animated ? "true" : "false"}
            onClick={() => props.onEdgeClick?.({}, edge)}
          >
            {String(edge.label ?? edge.id)}
          </button>
        ))}
        {props.children}
      </div>
    );
  },
}));

function renderGraph(overrides: Partial<ComponentProps<typeof DependencyGraph>> = {}) {
  const onSelectFileContext = vi.fn();
  const view = render(
    <DependencyGraph graph={graph} onSelectFileContext={onSelectFileContext} {...overrides} />,
  );
  return { ...view, onSelectFileContext };
}

describe("DependencyGraph file context", () => {
  beforeEach(() => {
    lastFlowProps = null;
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("labels entry and cycle participation with text, not color alone", () => {
    renderGraph();

    expect(screen.getByTestId("graph-node-app.js")).toHaveTextContent(/\[entry\]/);
    expect(screen.getByTestId("graph-node-routes/orders.js")).toHaveTextContent(/\[cycle\]/);
    expect(
      screen.getAllByLabelText(/participates in a dependency cycle/i).length,
    ).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/1 cycle · dashed \+ text label/i)).toBeInTheDocument();

    const cycleEdge = screen.getByTestId("graph-edge-e-2-services/orders.js-routes/orders.js");
    expect(cycleEdge).toHaveTextContent(/L22 · cycle/);
  });

  it("opens path-only context for node selection", async () => {
    const user = userEvent.setup();
    const { onSelectFileContext } = renderGraph();

    await user.click(screen.getByTestId("graph-node-app.js"));
    expect(onSelectFileContext).toHaveBeenCalledWith({ file: "app.js" });
    expect(onSelectFileContext.mock.calls[0]![0]).not.toHaveProperty("line");
  });

  it("opens importer path and require line for edge selection", async () => {
    const user = userEvent.setup();
    const { onSelectFileContext } = renderGraph();

    await user.click(screen.getByTestId("graph-edge-e-2-services/orders.js-routes/orders.js"));
    expect(onSelectFileContext).toHaveBeenCalledWith({
      file: "services/orders.js",
      line: 22,
    });
  });

  it("disables cycle edge animation when prefers-reduced-motion is set", () => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      configurable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    renderGraph();

    expect(screen.getByTestId("graph-reduced-motion")).toHaveTextContent(
      /reduced motion: cycle animation off/i,
    );
    const cycleEdge = screen.getByTestId("graph-edge-e-2-services/orders.js-routes/orders.js");
    expect(cycleEdge).toHaveAttribute("data-animated", "false");
    expect(cycleEdge).toHaveTextContent(/cycle/);
  });

  it("keeps a readable minimum zoom", () => {
    renderGraph();
    expect(lastFlowProps?.minZoom).toBe(0.35);
  });
});
