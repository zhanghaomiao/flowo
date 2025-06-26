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
import ProgressNode from "./NodeProgressBar";

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

// Define nodeTypes outside component to prevent re-renders
const nodeTypes = {
  progressNode: ProgressNode,
};

// Draggable Legend Panel Component
const DraggableLegendPanel: React.FC = () => {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    e.preventDefault();
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={panelRef}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        zIndex: 1000,
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
    >
      <Card
        size="small"
        style={{
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          border: "1px solid #d9d9d9",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
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
    </div>
  );
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

  // Memoize the rule status to prevent unnecessary re-renders when the object reference changes but content is same
  const memoizedRuleStatus = useMemo(
    () => ruleStatus,
    [ruleStatus ? JSON.stringify(ruleStatus) : null],
  );

  // Separate layout structure from status-dependent styling
  const { baseNodes, edges } = useMemo(() => {
    if (!graphData) {
      return { baseNodes: [], edges: [] };
    }

    const parsedData: GraphData =
      typeof graphData === "string" ? JSON.parse(graphData) : graphData;

    // Create base nodes with progressNode type
    const flowNodes: Node[] = parsedData.nodes.map((nodeData, index) => ({
      id: index.toString(),
      type: "progressNode",
      position: { x: 0, y: 0 }, // Will be set by layout algorithm
      data: {
        rule: nodeData.rule,
        value: nodeData.rule,
        statusInfo: null,
        isSelected: false,
        isHighlighted: false,
        isUnscheduled: true,
        backgroundColor: STATUS_COLORS.unscheduled,
        textColor: "#000000",
        borderColor: "#1890ff",
        boxShadow: "none",
        layoutDirection,
      },
      sourcePosition:
        layoutDirection === "LR" ? Position.Right : Position.Bottom,
      targetPosition: layoutDirection === "LR" ? Position.Left : Position.Top,
    }));

    // Create edges
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
    return {
      baseNodes: getLayoutedElements(flowNodes, flowEdges, {
        direction: layoutDirection,
        nodeWidth: NODE_WIDTH,
        nodeHeight: NODE_HEIGHT,
      }).nodes,
      edges: getLayoutedElements(flowNodes, flowEdges, {
        direction: layoutDirection,
        nodeWidth: NODE_WIDTH,
        nodeHeight: NODE_HEIGHT,
      }).edges,
    };
  }, [graphData, layoutDirection]);

  const [flowNodes, setNodes, onNodesChange] = useNodesState(baseNodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges);

  // Initialize base nodes when layout changes
  useEffect(() => {
    setNodes(baseNodes);
  }, [baseNodes, setNodes]);

  useEffect(() => {
    setEdges(edges);
  }, [edges, setEdges]);

  // Efficiently update only nodes that have changed status/selection/highlighting
  useEffect(() => {
    if (flowNodes.length === 0) return;

    const updatedNodes = flowNodes.map((node) => {
      const ruleName = node.data.rule as string;
      const isSelected = selectedRule === ruleName;
      const isHighlighted = highlightedRule === ruleName;
      const isUnscheduled =
        !memoizedRuleStatus || !(ruleName in memoizedRuleStatus);

      // Calculate new styling
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

      // Check if this node actually needs updating
      const currentData = node.data;
      const needsUpdate =
        currentData.isSelected !== isSelected ||
        currentData.isHighlighted !== isHighlighted ||
        currentData.isUnscheduled !== isUnscheduled ||
        currentData.backgroundColor !== backgroundColor ||
        currentData.textColor !== textColor ||
        currentData.borderColor !== borderColor ||
        currentData.boxShadow !== boxShadow ||
        currentData.layoutDirection !== layoutDirection ||
        JSON.stringify(currentData.statusInfo) !== JSON.stringify(statusInfo);

      if (!needsUpdate) {
        return node; // Return existing node if no changes needed
      }

      return {
        ...node,
        data: {
          ...node.data,
          statusInfo,
          isSelected,
          isHighlighted,
          isUnscheduled,
          backgroundColor,
          textColor,
          borderColor,
          boxShadow,
          layoutDirection,
        },
      };
    });

    // Only update if at least one node has changed
    const hasAnyChanges = updatedNodes.some(
      (updatedNode, index) => updatedNode !== flowNodes[index],
    );

    if (hasAnyChanges) {
      setNodes(updatedNodes);
    }
  }, [
    memoizedRuleStatus,
    selectedRule,
    highlightedRule,
    flowNodes,
    setNodes,
    layoutDirection,
  ]);

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
      const ruleName = node.data.rule as string;

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

  // Handle fit view with layout recalculation
  const handleFitView = useCallback(() => {
    // Force layout recalculation by creating new nodes with updated positions
    if (baseNodes.length > 0) {
      const { nodes: newNodes, edges: newEdges } = getLayoutedElements(
        baseNodes.map((node) => ({ ...node, position: { x: 0, y: 0 } })),
        edges,
        {
          direction: layoutDirection,
          nodeWidth: NODE_WIDTH,
          nodeHeight: NODE_HEIGHT,
        },
      );

      // Update nodes and edges with new layout
      setNodes(newNodes);
      setEdges(newEdges);

      // Then fit view after a brief delay to ensure nodes are updated
      setTimeout(() => {
        if (reactFlowInstance) {
          reactFlowInstance.fitView();
        }
      }, 50);
    }
  }, [
    baseNodes,
    edges,
    layoutDirection,
    setNodes,
    setEdges,
    reactFlowInstance,
  ]);

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
    <div ref={containerRef} style={{ height: "100%", position: "relative" }}>
      <DraggableLegendPanel />
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
          nodeTypes={nodeTypes}
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
          <Controls onFitView={handleFitView} />
          <MiniMap
            style={{
              height: 80,
              width: 120,
            }}
            zoomable
            pannable
          />
          <Panel position="top-right">
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
        Layout: {getLayoutInfo(layoutDirection).name}{" "}
        {getLayoutInfo(layoutDirection).icon} • Click nodes to filter jobs •
        Drag to reposition
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
