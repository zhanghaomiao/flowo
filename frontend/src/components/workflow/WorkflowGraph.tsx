import "@xyflow/react/dist/style.css";

import { ClearOutlined, DownOutlined, RightOutlined } from "@ant-design/icons";
import type { Edge, Node } from "@xyflow/react";
import {
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import { Button, Card, Radio, Space, Tooltip } from "antd";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useWorkflowRuleGraph } from "../../hooks/useQueries";
import { useRuleStatusWithSSE } from "../../hooks/useQueriesWithSSE";
import {
  getLayoutedElements,
  getLayoutInfo,
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

interface WorkflowGraphProps {
  workflowId: string;
  onNodeClick?: (ruleName: string) => void;
  selectedRule?: string | null;
  onClearRule?: () => void;
  highlightedRule?: string | null;
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

const STATUS_LABELS: Record<string, string> = {
  unscheduled: "Unscheduled",
  SUCCESS: "Success",
  RUNNING: "Running",
  ERROR: "Error",
  WAITING: "Waiting",
};

// Inner component that uses useReactFlow
const WorkflowGraphInner: React.FC<WorkflowGraphProps> = ({
  workflowId,
  onNodeClick,
  selectedRule,
  onClearRule,
  highlightedRule,
}) => {
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>("TB");
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

  // Wait for both requests to complete
  const isLoading = isGraphLoading || isRuleStatusLoading;
  const error = graphError || ruleStatusError;

  const reactFlowInstance = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeTimeoutRef = useRef<number | undefined>(undefined);

  // Function to fit view with debouncing
  const fitViewDebounced = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current);
    }
    resizeTimeoutRef.current = window.setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView();
      }
    }, 100);
  }, [reactFlowInstance]);

  const { nodes, edges } = useMemo(() => {
    if (!graphData) {
      return { nodes: [], edges: [] };
    }

    const parsedData: GraphData =
      typeof graphData === "string" ? JSON.parse(graphData) : graphData;

    // Create nodes with proper handle positions based on layout direction
    const flowNodes: Node[] = parsedData.nodes.map((nodeData, index) => {
      const isSelected = selectedRule === nodeData.rule;
      const isHighlighted = highlightedRule === nodeData.rule;

      // Determine node styling based on selection and highlighting states
      let backgroundColor = STATUS_COLORS.unscheduled;
      const data = {
        label: nodeData.rule,
        value: nodeData.rule,
      };
      if (ruleStatus && nodeData.rule in ruleStatus) {
        const status = ruleStatus[nodeData.rule].status;
        backgroundColor = STATUS_COLORS[status];
        data.label =
          nodeData.rule +
          ` (${ruleStatus[nodeData.rule].success}/${ruleStatus[nodeData.rule].total})`;
      }
      let textColor = "#000000";
      let borderColor = "#1890ff";
      let boxShadow = "none";
      const isUnscheduled = !ruleStatus || !(nodeData.rule in ruleStatus);

      if (isSelected) {
        backgroundColor = "#1890ff";
        textColor = "#ffffff";
      } else if (isHighlighted) {
        backgroundColor = "#fff7e6";
        borderColor = "#faad14";
        boxShadow = "0 0 10px rgba(250, 173, 20, 0.5)";
      }

      return {
        id: index.toString(),
        type: "default",
        position: { x: 0, y: 0 }, // Will be set by layout algorithm
        data: data,
        sourcePosition:
          layoutDirection === "LR" ? Position.Right : Position.Bottom,
        targetPosition: layoutDirection === "LR" ? Position.Left : Position.Top,
        style: {
          background: backgroundColor,
          color: textColor,
          borderColor: borderColor,
          borderRadius: "8px",
          padding: "10px",
          fontSize: "16px",
          fontWeight: "500",
          cursor: isUnscheduled ? "default" : "pointer",
          width: NODE_WIDTH,
          height: NODE_HEIGHT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          boxShadow: boxShadow,
          transition: "all 0.3s ease",
        },
      };
    });

    // Create edges with appropriate connection points based on layout direction
    const flowEdges: Edge[] = parsedData.links.map((link, index) => ({
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

    // Apply layout using utility function
    return getLayoutedElements(flowNodes, flowEdges, {
      direction: layoutDirection,
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
    });
  }, [graphData, selectedRule, highlightedRule, layoutDirection, ruleStatus]);

  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  // Update nodes when dependencies change
  useEffect(() => {
    setNodes(nodes);
  }, [nodes, setNodes]);

  useEffect(() => {
    setEdges(edges);
  }, [edges, setEdges]);

  // Fit view when nodes change (initial load or layout change)
  useEffect(() => {
    if (flowNodes.length > 0) {
      fitViewDebounced();
    }
  }, [flowNodes, fitViewDebounced]);

  // Set up ResizeObserver for container size changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver(() => {
      fitViewDebounced();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current);
      }
    };
  }, [fitViewDebounced]);

  // Window resize listener as fallback
  useEffect(() => {
    const handleWindowResize = () => {
      fitViewDebounced();
    };

    window.addEventListener("resize", handleWindowResize);
    return () => window.removeEventListener("resize", handleWindowResize);
  }, [fitViewDebounced]);

  // Handle node click
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const ruleName = node.data.value as string;

      // Check if the node is unscheduled and disable click
      const isUnscheduled = !ruleStatus || !(ruleName in ruleStatus);
      if (isUnscheduled) {
        return; // Don't handle click for unscheduled nodes
      }

      onNodeClick?.(ruleName);
    },
    [onNodeClick, ruleStatus],
  );

  // Handle layout direction change
  const handleLayoutChange = (value: LayoutDirection) => {
    setLayoutDirection(value);
  };

  const layoutInfo = getLayoutInfo(layoutDirection);

  if (isLoading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
          border: "1px dashed #d9d9d9",
          borderRadius: "6px",
        }}
      >
        <div>Loading workflow graph...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fff2f0",
          border: "1px solid #ffccc7",
          borderRadius: "6px",
          color: "#ff4d4f",
        }}
      >
        <div>
          Error loading graph:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      </div>
    );
  }

  if (!graphData || flowNodes.length === 0) {
    return (
      <div
        style={{
          height: "400px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
          border: "1px dashed #d9d9d9",
          borderRadius: "6px",
        }}
      >
        <div>No workflow graph data available</div>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ height: "100%" }}>
      <div
        style={{
          height: "96%",
          border: "1px solid #d9d9d9",
          borderRadius: "6px",
        }}
      >
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          connectionMode={ConnectionMode.Loose}
          fitView
          fitViewOptions={{
            padding: 0.1,
            includeHiddenNodes: false,
          }}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          minZoom={0.2}
          maxZoom={2}
        >
          <Background />
          <Controls />
          <MiniMap
            style={{
              height: 80,
              width: 120,
            }}
            zoomable
            pannable
          />
          <Panel position="top-right" style={{ paddingTop: "50px" }}>
            <Card
              size="small"
              style={{
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                border: "1px solid #d9d9d9",
              }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span style={{ fontSize: "12px", fontWeight: "500" }}>
                    Layout:
                  </span>
                  <Radio.Group
                    value={layoutDirection}
                    onChange={(e) => handleLayoutChange(e.target.value)}
                    size="small"
                  >
                    <Tooltip title="Top to Bottom">
                      <Radio.Button value="TB">
                        <Space>
                          <DownOutlined />
                          TB
                        </Space>
                      </Radio.Button>
                    </Tooltip>
                    <Tooltip title="Left to Right">
                      <Radio.Button value="LR">
                        <Space>
                          <RightOutlined />
                          LR
                        </Space>
                      </Radio.Button>
                    </Tooltip>
                  </Radio.Group>
                </div>
                {selectedRule && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span style={{ fontSize: "12px", fontWeight: "500" }}>
                        Filter:
                      </span>
                      <span
                        style={{
                          fontSize: "11px",
                          color: "#1890ff",
                          fontWeight: "500",
                          backgroundColor: "#f0f8ff",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          border: "1px solid #d4e8fc",
                        }}
                      >
                        {selectedRule}
                      </span>
                      <Button
                        size="small"
                        icon={<ClearOutlined />}
                        onClick={onClearRule}
                        type="text"
                        style={{ alignSelf: "flex-start" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          </Panel>
          <Panel position="top-right">
            <Card
              size="small"
              style={{
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                border: "1px solid #d9d9d9",
              }}
            >
              <div
                style={{ display: "flex", flexDirection: "row", gap: "6px" }}
              >
                {Object.entries(STATUS_COLORS).map(([status, color]) => (
                  <div
                    key={status}
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        backgroundColor: color,
                        borderRadius: "2px",
                        border: "1px solid #d9d9d9",
                      }}
                    />
                    <span style={{ fontSize: "10px", color: "#666" }}>
                      {STATUS_LABELS[status]}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </Panel>
        </ReactFlow>
      </div>

      <div
        style={{
          marginTop: "8px",
          fontSize: "11px",
          color: "#666",
          textAlign: "center",
        }}
      >
        Layout: {layoutInfo.name} {layoutInfo.icon} • Click nodes to filter jobs
        • Drag to reposition
      </div>
    </div>
  );
};

// Main component with ReactFlowProvider wrapper
const WorkflowGraph: React.FC<WorkflowGraphProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowGraphInner {...props} />
    </ReactFlowProvider>
  );
};

export default WorkflowGraph;
