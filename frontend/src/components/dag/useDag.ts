import type { Edge, Node } from "@xyflow/react";
import { MarkerType, Position } from "@xyflow/react";
import { useMemo } from "react";

import type { RuleStatusResponse } from "../../api/api";
import { useWorkflowRuleGraph } from "../../hooks/useQueries";
import { useRuleStatusWithSSE } from "../../hooks/useQueriesWithSSE";
import {
  getLayoutedElements,
  type LayoutDirection,
} from "../../utils/graphLayout";

interface GraphData {
  nodes: Array<{
    rule: string;
  }>;
  links: Array<{
    source: number;
    target: number;
    sourcerule: string;
    targetrule: string;
  }>;
}

const NODE_WIDTH = 150;
const NODE_HEIGHT = 60;

const STATUS_COLORS: Record<string, string> = {
  unscheduled: "#E0E0E0",
  SUCCESS: "#C8E6C9",
  RUNNING: "#BBDEFB",
  ERROR: "#FFCDD2",
  WAITING: "#FFECB3",
};

interface UseWorkflowGraphProps {
  workflowId: string;
  layoutDirection: LayoutDirection;
  selectedRule?: string | null;
  highlightedRule?: string | null;
  forceLayoutRecalc?: number;
}

export const useWorkflowGraph = ({
  workflowId,
  layoutDirection,
  selectedRule,
  highlightedRule,
  forceLayoutRecalc = 0,
}: UseWorkflowGraphProps) => {
  const {
    data: graphData,
    isLoading: isGraphLoading,
    error: graphError,
  } = useWorkflowRuleGraph(workflowId);

  const {
    data: ruleStatus,
    isLoading: isRuleStatusLoading,
    error: ruleStatusError,
  } = useRuleStatusWithSSE(workflowId);

  // Memoize the rule status to prevent unnecessary re-renders
  const memoizedRuleStatus = useMemo(
    () => ruleStatus,
    [ruleStatus ? JSON.stringify(ruleStatus) : null],
  );

  // Memoize graphData to prevent unnecessary layout recalculations
  const memoizedGraphData = useMemo(() => {
    if (!graphData) return null;
    return graphData;
  }, [graphData ? JSON.stringify(graphData) : null]);

  // Create base nodes and edges (layout only, no styling)
  const { baseNodes, baseEdges } = useMemo(() => {
    if (!memoizedGraphData) {
      return { baseNodes: [], baseEdges: [] };
    }

    const parsedData: GraphData =
      typeof memoizedGraphData === "string"
        ? JSON.parse(memoizedGraphData)
        : memoizedGraphData;

    // Create base nodes with only position and layout data (no styling)
    const nodes: Node[] = parsedData.nodes.map((nodeData, index) => ({
      id: index.toString(),
      type: "progressNode",
      position: { x: 0, y: 0 }, // Will be set by layout algorithm
      data: {
        rule: nodeData.rule,
        value: nodeData.rule,
        layoutDirection,
        // Styling will be handled separately
      },
      sourcePosition:
        layoutDirection === "LR" ? Position.Right : Position.Bottom,
      targetPosition: layoutDirection === "LR" ? Position.Left : Position.Top,
    }));

    // Create edges
    const edges: Edge[] = parsedData.links.map((link, index) => ({
      id: `edge-${index}`,
      source: link.source.toString(),
      target: link.target.toString(),
      type: "smoothstep",
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: "#1890ff",
      },
      style: {
        stroke: "#1890ff",
        strokeWidth: 2,
      },
    }));

    // Apply layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodes,
      edges,
      {
        direction: layoutDirection,
        nodeWidth: NODE_WIDTH,
        nodeHeight: NODE_HEIGHT,
      },
    );

    return {
      baseNodes: layoutedNodes,
      baseEdges: layoutedEdges,
    };
  }, [memoizedGraphData, layoutDirection, forceLayoutRecalc]);

  // Create nodes with stable references - only change when layout changes
  const { nodes, edges } = useMemo(() => {
    return {
      nodes: baseNodes,
      edges: baseEdges,
    };
  }, [baseNodes, baseEdges]);

  // Create a separate styling context that can be passed to nodes
  const nodeStyling = useMemo(() => {
    const styling: Record<
      string,
      {
        statusInfo: RuleStatusResponse | null;
        isSelected: boolean;
        isHighlighted: boolean;
        isUnscheduled: boolean;
        backgroundColor: string;
        textColor: string;
        borderColor: string;
        boxShadow: string;
      }
    > = {};

    baseNodes.forEach((node) => {
      const ruleName = node.data.rule as string;
      const isSelected = selectedRule === ruleName;
      const isHighlighted = highlightedRule === ruleName;
      const isUnscheduled =
        !memoizedRuleStatus || !(ruleName in memoizedRuleStatus);

      // Calculate styling based on status and selection
      let backgroundColor = STATUS_COLORS.unscheduled;
      let statusInfo = null;

      if (memoizedRuleStatus && ruleName in memoizedRuleStatus) {
        const status = memoizedRuleStatus[ruleName].status;
        backgroundColor = STATUS_COLORS[status];
        statusInfo = memoizedRuleStatus[ruleName];
      }

      let textColor = "#000000";
      let borderColor = "#1890ff";
      let boxShadow = "none";

      if (isSelected) {
        backgroundColor = "#1890ff";
        textColor = "#ffffff";
      } else if (isHighlighted) {
        backgroundColor = "#fff7e6";
        borderColor = "#faad14";
        boxShadow = "0 0 10px rgba(250, 173, 20, 0.5)";
      }

      styling[ruleName] = {
        statusInfo,
        isSelected,
        isHighlighted,
        isUnscheduled,
        backgroundColor,
        textColor,
        borderColor,
        boxShadow,
      };
    });

    return styling;
  }, [baseNodes, selectedRule, highlightedRule, memoizedRuleStatus]);

  const isLoading = isGraphLoading || isRuleStatusLoading;
  const error = graphError || ruleStatusError;

  return {
    nodes,
    edges,
    nodeStyling,
    isLoading,
    error,
    ruleStatus: memoizedRuleStatus,
  };
};
