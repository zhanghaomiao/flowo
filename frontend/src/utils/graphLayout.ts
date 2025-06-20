import type { Edge, Node } from "@xyflow/react";
import dagre from "dagre";

export type LayoutDirection = "TB" | "LR" | "BT" | "RL";

export interface LayoutOptions {
  direction: LayoutDirection;
  nodeWidth: number;
  nodeHeight: number;
  nodeSpacing: number;
  rankSpacing: number;
  margin: number;
}

export const defaultLayoutOptions: LayoutOptions = {
  direction: "TB",
  nodeWidth: 150,
  nodeHeight: 60,
  nodeSpacing: 50,
  rankSpacing: 100,
  margin: 20,
};

export const getLayoutedElements = (
  nodes: Node[],
  edges: Edge[],
  options: Partial<LayoutOptions> = {},
): { nodes: Node[]; edges: Edge[] } => {
  const opts = { ...defaultLayoutOptions, ...options };

  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Set graph properties
  dagreGraph.setGraph({
    rankdir: opts.direction,
    align: "UL",
    nodesep: opts.nodeSpacing,
    ranksep: opts.rankSpacing,
    marginx: opts.margin,
    marginy: opts.margin,
  });

  // Add nodes to dagre graph
  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: opts.nodeWidth,
      height: opts.nodeHeight,
    });
  });

  // Add edges to dagre graph
  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  // Calculate layout
  dagre.layout(dagreGraph);

  // Apply calculated positions to nodes
  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - opts.nodeWidth / 2,
        y: nodeWithPosition.y - opts.nodeHeight / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

export const getLayoutInfo = (
  direction: LayoutDirection,
): { name: string; icon: string } => {
  switch (direction) {
    case "TB":
      return { name: "Top-Down", icon: "↓" };
    case "LR":
      return { name: "Left-Right", icon: "→" };
    case "BT":
      return { name: "Bottom-Up", icon: "↑" };
    case "RL":
      return { name: "Right-Left", icon: "←" };
    default:
      return { name: "Unknown", icon: "?" };
  }
};
