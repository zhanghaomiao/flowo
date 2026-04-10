import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  FullscreenExitOutlined,
  FullscreenOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import type { Node, NodeProps } from '@xyflow/react';
import {
  Background,
  ConnectionMode,
  ControlButton,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { Button, Tooltip } from 'antd';

import DraggableLegendPanel from '@/components/job/dag/DraggableLegendPanel';
import LayoutControlPanel from '@/components/job/dag/LayoutControlPanel';
import ProgressNode from '@/components/job/dag/NodeProgressBar';
import { type GraphData, useWorkflowGraph } from '@/components/job/dag/useDag';
import { getLayoutInfo, type LayoutDirection } from '@/utils/graphLayout';

import '@xyflow/react/dist/style.css';

// Type for styling properties - matches what useWorkflowGraph returns
type NodeStylingData = {
  statusInfo: {
    success: string;
    running: string;
    error: string;
    total: string;
    status: string;
  } | null;
  isSelected: boolean;
  isHighlighted: boolean;
  isUnscheduled: boolean;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  boxShadow: string;
};

// Create context for styling data
const StylingContext = createContext<{
  nodeStyling: Record<string, NodeStylingData>;
  layoutDirection: LayoutDirection;
  isFullscreen: boolean;
} | null>(null);

// Wrapper component that provides styling context to nodes
const StyledProgressNode: React.FC<NodeProps> = (props) => {
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
        isFullscreen: stylingContext.isFullscreen,
      }}
    />
  );
};

interface WorkflowGraphProps {
  workflowId?: string;
  catalogSlug?: string;
  onNodeClick?: (ruleName: string) => void;
  selectedRule?: string | null;
  onClearRule?: () => void;
  highlightedRule?: string | null;
  initialData?: GraphData | string | null;
}

const nodeTypes = {
  progressNode: StyledProgressNode,
};

// Inner component that uses useReactFlow
const WorkflowGraphInner: React.FC<WorkflowGraphProps> = ({
  workflowId,
  catalogSlug,
  onNodeClick,
  selectedRule,
  onClearRule,
  highlightedRule,
  initialData,
}) => {
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>('TB');
  const [forceLayoutRecalc, setForceLayoutRecalc] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const isFittingView = useRef(false);

  // Use the custom hook for graph data
  const {
    nodes: flowNodes,
    edges: flowEdges,
    nodeStyling,
    isLoading,
    error,
  } = useWorkflowGraph({
    workflowId,
    catalogSlug,
    layoutDirection,
    selectedRule,
    highlightedRule,
    forceLayoutRecalc,
    initialData,
  });

  const reactFlowInstance = useReactFlow();
  const containerRef = useRef<HTMLDivElement>(null);
  const isLayoutChange = useRef(false);
  const currentViewport = useRef({ x: 0, y: 0, zoom: 1 });
  const isInitialLoad = useRef(true);

  const [nodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);

      // Fit view after fullscreen change with a small delay
      setTimeout(() => {
        if (reactFlowInstance) {
          reactFlowInstance.fitView({ duration: 300, padding: 0.2 });
        }
      }, 100);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [reactFlowInstance]);

  // Handle fullscreen toggle
  const handleToggleFullscreen = useCallback(async () => {
    if (!containerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await containerRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  }, []);

  // Handle container resizing to keep graph centered
  useEffect(() => {
    if (!containerRef.current || !reactFlowInstance) return;

    const resizeObserver = new ResizeObserver(() => {
      // Use a debounce or delay to avoid jitter during split dragging
      window.requestAnimationFrame(() => {
        reactFlowInstance.fitView({ duration: 200, padding: 0.2 });
      });
    });

    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [reactFlowInstance]);

  // Update nodes and edges when they change
  useEffect(() => {
    if (reactFlowInstance) {
      currentViewport.current = reactFlowInstance.getViewport();
    }
    setNodes(flowNodes);

    // If it's the initial load or a layout change, we want to fit view
    if (isInitialLoad.current || isLayoutChange.current) {
      setTimeout(() => {
        if (reactFlowInstance) {
          reactFlowInstance.fitView({ duration: 400, padding: 0.2 });
          isInitialLoad.current = false;
          isLayoutChange.current = false;
        }
      }, 100);
    } else {
      // Otherwise maintain the user's current viewport
      setTimeout(() => {
        if (reactFlowInstance) {
          reactFlowInstance.setViewport(currentViewport.current);
        }
      }, 10);
    }
  }, [flowNodes, reactFlowInstance, setNodes]);

  useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  const stylingContext = useMemo(
    () => ({
      nodeStyling,
      layoutDirection,
      isFullscreen,
    }),
    [nodeStyling, layoutDirection, isFullscreen],
  );

  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const ruleName = node.data.rule as string;
      onNodeClick?.(ruleName);
    },
    [onNodeClick],
  );

  // Handle layout direction change
  const handleLayoutChange = useCallback(
    (value: LayoutDirection) => {
      if (isFittingView.current) {
        return;
      }
      isFittingView.current = true;
      setLayoutDirection(value);
      setForceLayoutRecalc((prev) => prev + 1);
      isLayoutChange.current = true;
      setTimeout(() => {
        if (reactFlowInstance) {
          reactFlowInstance.fitView({ duration: 400, padding: 0.2 });
        }
        // Reset the flags after fit view is complete
        setTimeout(() => {
          isLayoutChange.current = false;
          isFittingView.current = false;
        }, 450);
      }, 150);
    },
    [reactFlowInstance],
  );

  // Handle fit view with layout recalculation
  const handleFitView = useCallback(() => {
    // Prevent multiple rapid executions
    if (isFittingView.current) {
      return;
    }
    isFittingView.current = true;
    isLayoutChange.current = true;
    setForceLayoutRecalc((prev) => prev + 1);
    setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView({ duration: 400, padding: 0.2 });
      }
      setTimeout(() => {
        isLayoutChange.current = false;
        isFittingView.current = false;
      }, 450);
    }, 150);
  }, [reactFlowInstance]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50/50 border border-dashed border-slate-200 rounded-xl font-sans gap-3">
        <SyncOutlined spin className="text-brand-500 text-xl" />
        <div className="text-slate-400 font-bold text-xs uppercase tracking-widest">
          Generating Workflow Graph...
        </div>
      </div>
    );
  }

  if (error) {
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';

    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-rose-50/30 border border-rose-100 rounded-xl font-sans overflow-hidden">
        <div className="max-w-full w-full">
          <div className="text-rose-600 text-base font-black mb-4 flex items-center gap-2">
            <span className="p-1 px-2 bg-rose-600 text-white rounded-lg text-xs">
              !
            </span>
            DAG GENERATION FAILED
          </div>
          <pre className="bg-white p-4 rounded-xl border border-rose-100 text-[11px] leading-relaxed max-h-[300px] overflow-auto whitespace-pre-wrap word-break-all text-slate-600 font-mono shadow-sm">
            {errorMessage}
          </pre>
          <div className="mt-4 text-right">
            <Button
              size="middle"
              onClick={() => window.location.reload()}
              icon={<SyncOutlined />}
              className="rounded-xl font-bold border-rose-200 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!flowNodes.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-slate-50 border border-dashed border-slate-200 rounded-xl font-sans gap-2">
        <div className="text-slate-400 font-bold text-xs uppercase tracking-widest">
          No Graph Data Available
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative ${isFullscreen ? 'h-screen w-screen bg-white' : 'h-full w-full'}`}
    >
      {!isFullscreen && !catalogSlug && <DraggableLegendPanel />}
      <div
        className={`bg-white transition-all duration-300 ${isFullscreen ? 'h-full border-none' : 'h-[96%] border border-slate-100 rounded-2xl shadow-sm overflow-hidden'}`}
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
              padding: 0.2,
              includeHiddenNodes: false,
            }}
            nodesDraggable={true}
            nodesConnectable={false}
            elementsSelectable={true}
            minZoom={0.1}
            maxZoom={2}
          >
            <Background color="#fafafa" gap={20} />
            <Controls
              onFitView={handleFitView}
              className="bg-white border-slate-100 rounded-lg overflow-hidden shadow-md"
            >
              <Tooltip
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                <ControlButton onClick={handleToggleFullscreen}>
                  {isFullscreen ? (
                    <FullscreenExitOutlined />
                  ) : (
                    <FullscreenOutlined />
                  )}
                </ControlButton>
              </Tooltip>
            </Controls>
            <MiniMap
              className="rounded-xl border border-slate-100 shadow-lg"
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

      {!isFullscreen && (
        <div className="mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center flex items-center justify-center gap-2">
          <span>Layout: {getLayoutInfo(layoutDirection).name}</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Click nodes to filter</span>
          <span className="h-1 w-1 rounded-full bg-slate-300" />
          <span>Drag to move</span>
        </div>
      )}
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
