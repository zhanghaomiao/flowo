import { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';
import type { Edge, Node } from '@xyflow/react';
import { MarkerType, Position } from '@xyflow/react';

import {
  getCatalogDagOptions,
  getRuleGraphOptions,
  getRuleStatusOptions,
} from '@/client/@tanstack/react-query.gen';
import type { RuleStatusResponse } from '@/client/types.gen';
import { getLayoutedElements, type LayoutDirection } from '@/utils/graphLayout';

// 常量定义
const NODE_WIDTH = 150;
const NODE_HEIGHT = 60;

const STATUS_COLORS: Record<string, string> = {
  unscheduled: '#f8fafc', // Slate 50
  SUCCESS: '#e0f2fe', // Sky 100
  RUNNING: '#e0e7ff', // Indigo 100
  ERROR: '#ffe4e6', // Rose 100
  WAITING: '#fef3c7', // Amber 100
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

export interface GraphData {
  nodes: Array<{ rule: string }>;
  links: Array<{
    source: number;
    target: number;
    sourcerule: string;
    targetrule: string;
  }>;
  error?: string;
}

interface UseWorkflowGraphProps {
  workflowId?: string;
  catalogSlug?: string;
  layoutDirection: LayoutDirection;
  selectedRule?: string | null;
  highlightedRule?: string | null;
  forceLayoutRecalc?: number;
  initialData?: GraphData | string | null;
}

export const useWorkflowGraph = ({
  workflowId,
  catalogSlug,
  layoutDirection,
  selectedRule,
  highlightedRule,
  forceLayoutRecalc = 0,
  initialData,
}: UseWorkflowGraphProps) => {
  const isWorkflow = !!workflowId;

  // 1. 获取图谱结构 (Layout Data)
  const {
    data: workflowGraphData,
    isLoading: isWorkflowGraphLoading,
    error: workflowGraphError,
  } = useQuery({
    ...getRuleGraphOptions({ path: { workflow_id: workflowId ?? '' } }),
    enabled: isWorkflow,
  });

  const {
    data: catalogGraphData,
    isLoading: isCatalogGraphLoading,
    error: catalogGraphError,
  } = useQuery({
    ...getCatalogDagOptions({ path: { slug: catalogSlug ?? '' } }),
    enabled: !isWorkflow,
    placeholderData: initialData,
  });

  const graphData = isWorkflow ? workflowGraphData : catalogGraphData;
  const isGraphLoading = isWorkflow
    ? isWorkflowGraphLoading
    : isCatalogGraphLoading;
  const graphError = isWorkflow ? workflowGraphError : catalogGraphError;

  // 2. 获取实时状态 (Status Data) - Only for workflows
  const {
    data: ruleStatus,
    isLoading: isRuleStatusLoading,
    error: ruleStatusError,
  } = useQuery({
    ...getRuleStatusOptions({ path: { workflow_id: workflowId ?? '' } }),
    enabled: isWorkflow,
  });

  // 3. 计算基础布局 (Heavy Calculation)
  // 仅在 graphData 结构变化或手动切换布局时执行
  // 移除了 status 依赖，状态变化不应触发重排(Relayout)
  const {
    nodes,
    edges,
    error: dataError,
  } = useMemo(() => {
    if (!graphData) return { nodes: [], edges: [], error: null };

    const parsedData: GraphData & { error?: string } =
      typeof graphData === 'string' ? JSON.parse(graphData) : graphData;

    if (parsedData?.error) {
      return { nodes: [], edges: [], error: parsedData.error };
    }

    if (!parsedData?.nodes?.length)
      return { nodes: [], edges: [], error: null };

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
        color: '#0ea5e9',
      },
      style: { stroke: '#0ea5e9', strokeWidth: 2 },
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

    return { nodes: layout.nodes, edges: layout.edges, error: null };
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
      const isUnscheduled = isWorkflow ? !statusInfo : false; // Catalogs don't appear as unscheduled

      // 颜色逻辑
      let backgroundColor = isWorkflow
        ? STATUS_COLORS[status] || STATUS_COLORS.unscheduled
        : '#f0f5ff'; // Catalog nodes are blue-ish
      let textColor = isWorkflow ? '#000000' : '#1d39c4';
      let borderColor = isWorkflow ? '#1890ff' : '#597ef7';
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
  }, [nodes, ruleStatus, selectedRule, highlightedRule, isWorkflow]);

  return {
    nodes,
    edges,
    nodeStyling,
    ruleStatus,
    isLoading: isGraphLoading || isRuleStatusLoading,
    error:
      graphError ||
      ruleStatusError ||
      (dataError ? new Error(dataError) : null),
  };
};
