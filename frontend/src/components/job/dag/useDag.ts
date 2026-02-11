import { useMemo } from 'react';

import type { Edge, Node } from '@xyflow/react';
import { MarkerType, Position } from '@xyflow/react';

import {
  useGetRuleGraphQuery,
  useGetRuleStatusQuery,
} from '@/client/@tanstack/react-query.gen';
import type { RuleStatusResponse } from '@/client/types.gen';
import { getLayoutedElements, type LayoutDirection } from '@/utils/graphLayout';

// 常量定义
const NODE_WIDTH = 150;
const NODE_HEIGHT = 60;

const STATUS_COLORS: Record<string, string> = {
  unscheduled: '#E0E0E0',
  SUCCESS: '#C8E6C9',
  RUNNING: '#BBDEFB',
  ERROR: '#FFCDD2',
  WAITING: '#FFECB3',
};

// 类型定义 (导出以供组件使用)
export type NodeStylingData = {
  statusInfo: RuleStatusResponse | null;
  isSelected: boolean;
  isHighlighted: boolean;
  isUnscheduled: boolean;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  boxShadow: string;
};

interface GraphData {
  nodes: Array<{ rule: string }>;
  links: Array<{
    source: number;
    target: number;
    sourcerule: string;
    targetrule: string;
  }>;
}

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
  // 1. 获取图谱结构 (Layout Data)
  const {
    data: graphData,
    isLoading: isGraphLoading,
    error: graphError,
  } = useGetRuleGraphQuery({
    path: { workflow_id: workflowId },
  });

  // 2. 获取实时状态 (Status Data)
  // 当 SSE 触发 invalidation 时，这个 hook 会自动重刷
  const {
    data: ruleStatus,
    isLoading: isRuleStatusLoading,
    error: ruleStatusError,
  } = useGetRuleStatusQuery({
    path: { workflow_id: workflowId },
  });

  // 3. 计算基础布局 (Heavy Calculation)
  // 仅在 graphData 结构变化或手动切换布局时执行
  // 移除了 status 依赖，状态变化不应触发重排(Relayout)
  const { nodes, edges } = useMemo(() => {
    if (!graphData) return { nodes: [], edges: [] };

    const parsedData: GraphData =
      typeof graphData === 'string' ? JSON.parse(graphData) : graphData;

    if (!parsedData?.nodes?.length) return { nodes: [], edges: [] };

    // 生成基础节点 (仅包含布局信息)
    const rawNodes: Node[] = parsedData.nodes.map((nodeData, index) => ({
      id: index.toString(),
      type: 'progressNode',
      position: { x: 0, y: 0 },
      data: {
        rule: nodeData.rule,
        // 注意：不在这里放入样式数据，样式走 Context
      },
      sourcePosition:
        layoutDirection === 'LR' ? Position.Right : Position.Bottom,
      targetPosition: layoutDirection === 'LR' ? Position.Left : Position.Top,
    }));

    // 生成边
    const rawEdges: Edge[] = parsedData.links.map((link, index) => ({
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
      style: { stroke: '#1890ff', strokeWidth: 2 },
    }));

    // 执行布局算法
    const layout = getLayoutedElements(rawNodes, rawEdges, {
      direction: layoutDirection,
      nodeWidth: NODE_WIDTH,
      nodeHeight: NODE_HEIGHT,
    });

    // Reference forceLayoutRecalc to satisfy exhaustive-deps
    // it's used as a trigger for re-layout
    void forceLayoutRecalc;

    return { nodes: layout.nodes, edges: layout.edges };
  }, [graphData, layoutDirection, forceLayoutRecalc]);

  // 4. 计算样式字典 (Lightweight Calculation)
  // 专门响应 ruleStatus 的变化，计算飞快
  const nodeStyling = useMemo(() => {
    const styling: Record<string, NodeStylingData> = {};

    nodes.forEach((node) => {
      const ruleName = node.data.rule as string;

      // 获取当前状态
      const statusInfo = ruleStatus?.[ruleName] || null;
      const status = statusInfo?.status || 'unscheduled';

      const isSelected = selectedRule === ruleName;
      const isHighlighted = highlightedRule === ruleName;
      const isUnscheduled = !statusInfo;

      // 颜色逻辑
      let backgroundColor = STATUS_COLORS[status] || STATUS_COLORS.unscheduled;
      let textColor = '#000000';
      let borderColor = '#1890ff';
      let boxShadow = 'none';

      if (isSelected) {
        backgroundColor = '#1890ff';
        textColor = '#ffffff';
      } else if (isHighlighted) {
        backgroundColor = '#fff7e6';
        borderColor = '#faad14';
        boxShadow = '0 0 10px rgba(250, 173, 20, 0.5)';
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
  }, [nodes, ruleStatus, selectedRule, highlightedRule]); // 这里依赖 ruleStatus

  return {
    nodes,
    edges,
    nodeStyling,
    ruleStatus,
    isLoading: isGraphLoading || isRuleStatusLoading,
    error: graphError || ruleStatusError,
  };
};
