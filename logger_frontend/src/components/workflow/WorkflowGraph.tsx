import React, { useMemo, useCallback, useState, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  ConnectionMode,
  MarkerType,
  Position,
} from '@xyflow/react'
import type { Node, Edge } from '@xyflow/react'
import { Radio, Space, Card, Tooltip } from 'antd'
import { DownOutlined, RightOutlined } from '@ant-design/icons'
import '@xyflow/react/dist/style.css'
import { useWorkflowRuleGraph } from '../../hooks/useQueries'
import { getLayoutedElements, getLayoutInfo, type LayoutDirection } from '../../utils/graphLayout'

interface GraphData {
  nodes: Array<{
    rule: string
  }>
  links: Array<{
    source: number
    target: number
    sourcerule: string
    targetrule: string
  }>
}

interface WorkflowGraphProps {
  workflowId: string
  onNodeClick?: (ruleName: string) => void
  selectedRule?: string | null
}

const NODE_WIDTH = 150
const NODE_HEIGHT = 60

// Inner component that uses useReactFlow
const WorkflowGraphInner: React.FC<WorkflowGraphProps> = ({
  workflowId,
  onNodeClick,
  selectedRule,
}) => {
  const [layoutDirection, setLayoutDirection] = useState<LayoutDirection>('TB')
  const { data: graphData, isLoading, error } = useWorkflowRuleGraph(workflowId)
  const reactFlowInstance = useReactFlow()
  const containerRef = useRef<HTMLDivElement>(null)
  const resizeTimeoutRef = useRef<number | undefined>(undefined)

  // Function to fit view with debouncing
  const fitViewDebounced = useCallback(() => {
    if (resizeTimeoutRef.current) {
      clearTimeout(resizeTimeoutRef.current)
    }
    resizeTimeoutRef.current = window.setTimeout(() => {
      if (reactFlowInstance) {
        reactFlowInstance.fitView()
      }
    }, 100)
  }, [reactFlowInstance])

  // Convert the graph data to React Flow format
  const { nodes, edges } = useMemo(() => {
    if (!graphData) {
      return { nodes: [], edges: [] }
    }

    const parsedData: GraphData = typeof graphData === 'string'
      ? JSON.parse(graphData)
      : graphData

    // Create nodes with proper handle positions based on layout direction
    const flowNodes: Node[] = parsedData.nodes.map((nodeData, index) => ({
      id: index.toString(),
      type: 'default',
      position: { x: 0, y: 0 }, // Will be set by layout algorithm
      data: {
        label: nodeData.rule,
      },
      sourcePosition: layoutDirection === 'LR' ? Position.Right : Position.Bottom,
      targetPosition: layoutDirection === 'LR' ? Position.Left : Position.Top,
      style: {
        background: selectedRule === nodeData.rule ? '#1890ff' : '#ffffff',
        color: selectedRule === nodeData.rule ? '#ffffff' : '#000000',
        border: '2px solid #1890ff',
        borderRadius: '8px',
        padding: '10px',
        fontSize: '16px',
        fontWeight: '500',
        cursor: 'pointer',
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
      },
    }))

    // Create edges with appropriate connection points based on layout direction
    const flowEdges: Edge[] = parsedData.links.map((link, index) => ({
      id: `edge-${index}`,
      source: link.source.toString(),
      target: link.target.toString(),
      type: 'smoothstep',
      animated: true,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20,
        color: '#1890ff',
      },
      style: {
        stroke: '#1890ff',
        strokeWidth: 2,
      },
    }))

    // Apply layout using utility function
    return getLayoutedElements(flowNodes, flowEdges, {
      direction: layoutDirection,
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
    })
  }, [graphData, selectedRule, layoutDirection])

  const [flowNodes, setNodes, onNodesChange] = useNodesState(nodes)
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(edges)

  // Update nodes when dependencies change
  useEffect(() => {
    setNodes(nodes)
  }, [nodes, setNodes])

  useEffect(() => {
    setEdges(edges)
  }, [edges, setEdges])

  // Fit view when nodes change (initial load or layout change)
  useEffect(() => {
    if (flowNodes.length > 0) {
      fitViewDebounced()
    }
  }, [flowNodes, fitViewDebounced])

  // Set up ResizeObserver for container size changes
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      fitViewDebounced()
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
      if (resizeTimeoutRef.current) {
        clearTimeout(resizeTimeoutRef.current)
      }
    }
  }, [fitViewDebounced])

  // Window resize listener as fallback
  useEffect(() => {
    const handleWindowResize = () => {
      fitViewDebounced()
    }

    window.addEventListener('resize', handleWindowResize)
    return () => window.removeEventListener('resize', handleWindowResize)
  }, [fitViewDebounced])

  // Handle node click
  const handleNodeClick = useCallback(
    (event: React.MouseEvent, node: Node) => {
      const ruleName = node.data.label as string
      onNodeClick?.(ruleName)
    },
    [onNodeClick]
  )

  // Handle layout direction change
  const handleLayoutChange = (value: LayoutDirection) => {
    setLayoutDirection(value)
  }

  const layoutInfo = getLayoutInfo(layoutDirection)

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa',
        border: '1px dashed #d9d9d9',
        borderRadius: '6px'
      }}>
        <div>Loading workflow graph...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fff2f0',
        border: '1px solid #ffccc7',
        borderRadius: '6px',
        color: '#ff4d4f'
      }}>
        <div>Error loading graph: {error instanceof Error ? error.message : 'Unknown error'}</div>
      </div>
    )
  }

  if (!graphData || flowNodes.length === 0) {
    return (
      <div style={{
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fafafa',
        border: '1px dashed #d9d9d9',
        borderRadius: '6px'
      }}>
        <div>No workflow graph data available</div>
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ height: '100%' }}>
      <div style={{ height: '96%', border: '1px solid #d9d9d9', borderRadius: '6px' }}>
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
          <Panel position="top-right">
            <Card size="small" style={{
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
              border: '1px solid #d9d9d9'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: '500' }}>Layout:</span>
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
            </Card>
          </Panel>
        </ReactFlow>
      </div>

      {/* Layout Info */}
      <div style={{
        marginTop: '8px',
        fontSize: '11px',
        color: '#666',
        textAlign: 'center'
      }}>
        Layout: {layoutInfo.name} {layoutInfo.icon} •
        Click nodes to filter jobs • Drag to reposition
      </div>
    </div>
  )
}

// Main component with ReactFlowProvider wrapper
const WorkflowGraph: React.FC<WorkflowGraphProps> = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowGraphInner {...props} />
    </ReactFlowProvider>
  )
}

export default WorkflowGraph 