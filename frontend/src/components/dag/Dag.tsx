import "@xyflow/react/dist/style.css";

import type { Node } from "@xyflow/react";
import {
  Background,
  ConnectionMode,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react";
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
  createContext,
  useContext,
} from "react";

import { useWorkflowGraph } from "./useDag";
import {
  getLayoutInfo,
  type LayoutDirection,
} from "../../utils/graphLayout";
import ProgressNode from "./NodeProgressBar";
import DraggableLegendPanel from "./DraggableLegendPanel";
import LayoutControlPanel from "./LayoutControlPanel";

// Create context for styling data
const StylingContext = createContext<{
  nodeStyling: Record<string, any>;
  layoutDirection: LayoutDirection;
} | null>(null);

// Wrapper component that provides styling context to nodes
const StyledProgressNode: React.FC<any> = (props) => {
  const stylingContext = useContext(StylingContext);
  if (!stylingContext) {
    return <ProgressNode {...props} />;
  }
  
  const ruleName = props.data.rule as string;
  const nodeStyle = stylingContext.nodeStyling[ruleName];
  
  return (
    <ProgressNode 
      {...props} 
      data={{
        ...props.data,
        ...nodeStyle,
        layoutDirection: stylingContext.layoutDirection,
      }}
    />
  );
};

interface WorkflowGraphProps {
  workflowId: string;
  onNodeClick?: (ruleName: string) => void;
  selectedRule?: string | null;
  onClearRule?: () => void;
  highlightedRule?: string | null;
}

const nodeTypes = {
  progressNode: StyledProgressNode,
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
  const [forceLayoutRecalc, setForceLayoutRecalc] = useState(0);
  const isFittingView = useRef(false);
  
  // Use the custom hook for graph data
  const { nodes: flowNodes, edges: flowEdges, nodeStyling, isLoading, error, ruleStatus } = useWorkflowGraph({
    workflowId,
    layoutDirection,
    selectedRule,
    highlightedRule,
    forceLayoutRecalc,
  });

  const reactFlowInstance = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const isLayoutChange = useRef(false);
  const currentViewport = useRef({ x: 0, y: 0, zoom: 1 });
  const isInitialLoad = useRef(true);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Update nodes and edges when they change
  useEffect(() => {
    if (reactFlowInstance) {
      currentViewport.current = reactFlowInstance.getViewport();
    }
    setNodes(flowNodes);
    if (!isLayoutChange.current) {
      setTimeout(() => {
        if (reactFlowInstance) {
          reactFlowInstance.setViewport(currentViewport.current);
        }
      }, 10);
    } else {
      isLayoutChange.current = false;
    }
  }, [flowNodes]);

  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges]);

  useEffect(() => {
    if (nodes.length > 0 && isInitialLoad.current && reactFlowInstance) {
      isInitialLoad.current = false;
      setTimeout(() => {
        reactFlowInstance.fitView();
      }, 100);
    }
  }, [nodes, reactFlowInstance]);

    const stylingContext = useMemo(() => ({
      nodeStyling,
      layoutDirection,
    }), [nodeStyling, layoutDirection]);

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
  const handleLayoutChange = useCallback((value: LayoutDirection) => {
    if (isFittingView.current) {
      return;
    }
    isFittingView.current = true;
    setLayoutDirection(value);
    setForceLayoutRecalc(prev => prev + 1);
    isLayoutChange.current = true;
    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ duration: 300 });
      }
      // Reset the flags after fit view is complete
      setTimeout(() => {
        isLayoutChange.current = false;
        isFittingView.current = false;
      }, 350);
    }, 150);
  }, [reactFlowInstance]);

  // Handle fit view with layout recalculation
  const handleFitView = useCallback(() => {
    // Prevent multiple rapid executions
    if (isFittingView.current) {
      return;
    }
    isFittingView.current = true;
    isLayoutChange.current = true;
    setForceLayoutRecalc(prev => prev + 1);
    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ duration: 300 });
      }
      setTimeout(() => {
        isLayoutChange.current = false;
        isFittingView.current = false;
      }, 350);
    }, 150);
  }, [reactFlowInstance]);

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

  if (!flowNodes.length) {
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
        <StylingContext.Provider value={stylingContext}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            connectionMode={ConnectionMode.Loose}
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
              <LayoutControlPanel
                layoutDirection={layoutDirection}
                onLayoutChange={handleLayoutChange}
                selectedRule={selectedRule}
                onClearRule={onClearRule}
              />
            </Panel>
          </ReactFlow>
        </StylingContext.Provider>
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
