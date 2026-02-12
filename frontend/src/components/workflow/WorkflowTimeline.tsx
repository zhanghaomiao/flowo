import React, { useMemo } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Alert, Card, Spin } from 'antd';
import dayjs from 'dayjs';
import * as echarts from 'echarts';
import ReactECharts from 'echarts-for-react';

import { getTimelinesOptions } from '@/client/@tanstack/react-query.gen';

// Warm, distinguishable palette for rules
const RULE_PALETTE = [
  '#f2a600', // orange
  '#0f9d58', // green
  '#c62828', // dark red
  '#5470c6', // blue
  '#ab47bc', // purple
  '#00acc1', // teal
  '#fc8452', // salmon
  '#91cc75', // light green
  '#ee6666', // red
  '#73c0de', // sky blue
  '#9a60b4', // violet
  '#ea7ccc', // pink
  '#fac858', // yellow
  '#3ba272', // emerald
  '#db4437', // crimson
];

// Increased sizes for better visibility
const BAR_HEIGHT = 20;
const ROW_HEIGHT = 32;

// Padding around the grid
const GRID_TOP = 20;
const GRID_BOTTOM = 40;

type TimelineJob = [string | number, string, string, string];

interface WorkflowTimelineProps {
  workflowId: string;
  selectedRule?: string | null;
  onJobSelect?: (
    jobInfo: {
      jobId: string;
      ruleName: string;
      startTime: string;
      endTime: string;
      status: string;
    } | null,
  ) => void;
}

const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  workflowId,
  selectedRule,
  onJobSelect,
}) => {
  const {
    data: timelineData,
    isLoading,
    error,
  } = useQuery({
    ...getTimelinesOptions({
      path: {
        workflow_id: workflowId,
      },
    }),
  });

  const processedData = useMemo(() => {
    if (!timelineData)
      return {
        labels: [],
        items: [],
        chartHeight: 300,
        ruleColorMap: {},
        labelRuleMap: {} as Record<string, string>,
      };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data = timelineData as Record<string, any[]>;
    const allRules = Object.keys(data);
    const ruleMinStart: Record<string, number> = {};
    allRules.forEach((ruleName) => {
      const jobs = (data[ruleName] as unknown as TimelineJob[]) || [];
      let minStart = Infinity;
      jobs.forEach((job: TimelineJob) => {
        const start = new Date(job[1]).getTime();
        if (start < minStart) minStart = start;
      });
      ruleMinStart[ruleName] = minStart;
    });

    const sortedRules = [...allRules].sort(
      (a, b) => ruleMinStart[a] - ruleMinStart[b],
    );

    const ruleColorMap: Record<string, string> = {};
    sortedRules.forEach((rule, i) => {
      ruleColorMap[rule] = RULE_PALETTE[i % RULE_PALETTE.length];
    });

    const rules = selectedRule
      ? sortedRules.filter((r) => r === selectedRule)
      : sortedRules;

    const labels: string[] = [];
    const items: unknown[] = [];
    const labelRuleMap: Record<string, string> = {};
    let rowIndex = 0;

    rules.forEach((ruleName) => {
      const jobs = (data[ruleName] as unknown as TimelineJob[]) || [];
      const totalJobs = jobs.length;
      const color = ruleColorMap[ruleName];

      const sortedJobs = [...jobs].sort((a: TimelineJob, b: TimelineJob) => {
        return new Date(a[1]).getTime() - new Date(b[1]).getTime();
      });

      sortedJobs.forEach((job: TimelineJob, jobIdx: number) => {
        const [jobId, startTime, endTime, status] = job;
        const start = new Date(startTime).getTime();
        const end = new Date(endTime).getTime();

        const label = `${ruleName} ${jobIdx + 1}/${totalJobs}`;
        labels.push(label);
        labelRuleMap[label] = ruleName;

        items.push({
          name: ruleName,
          value: [rowIndex, start, end, end - start, status, jobId],
          itemStyle: { color },
        });

        rowIndex++;
      });
    });

    // Calculate exact height needed for rows plus grid padding
    const chartHeight = Math.max(
      300,
      rowIndex * ROW_HEIGHT + GRID_TOP + GRID_BOTTOM,
    );
    return { labels, items, chartHeight, ruleColorMap, labelRuleMap };
  }, [timelineData, selectedRule]);

  const option = useMemo(() => {
    const richStyles: Record<
      string,
      { color: string; fontSize: number; fontWeight: number }
    > = {};
    Object.entries(processedData.ruleColorMap).forEach(([rule, color]) => {
      const styleKey = rule.replace(/[^a-zA-Z0-9_]/g, '_');
      richStyles[styleKey] = {
        color: color,
        fontSize: 12,
        fontWeight: 500,
      };
    });

    const rowCount = processedData.labels.length;
    const rowContentHeight = rowCount * ROW_HEIGHT;

    return {
      tooltip: {
        formatter: (
          params: echarts.TooltipComponentFormatterCallbackParams,
        ) => {
          if (Array.isArray(params)) return '';
          const p = params as unknown as {
            value: [number, number, number, number, string, string | number];
            name: string;
            color: string;
          };
          const [, start, end, duration, status, jobId] = p.value;
          const ruleName = p.name;
          return `
            <div style="font-weight:bold;margin-bottom:4px;">${ruleName}</div>
            <span style="display:inline-block;margin-right:4px;border-radius:50%;width:10px;height:10px;background:${p.color};"></span>
            Job: ${jobId}<br/>
            Status: ${status}<br/>
            Start: ${dayjs(start).format('HH:mm:ss')}<br/>
            End: ${dayjs(end).format('HH:mm:ss')}<br/>
            Duration: ${(duration / 1000).toFixed(1)}s
          `;
        },
      },
      grid: {
        top: GRID_TOP,
        left: 10,
        right: 30,
        height: rowContentHeight, // Force constant height area to avoid stretching
        bottom: GRID_BOTTOM,
        containLabel: true,
      },
      xAxis: [
        {
          show: true,
          type: 'time',
          position: 'bottom',
          axisLine: { show: true, lineStyle: { color: '#e0e0e0' } },
          axisTick: { show: true },
          splitLine: { show: false },
          axisLabel: {
            show: true,
            formatter: (val: number) => dayjs(val).format('mm:ss'),
            color: '#666',
          },
        },
        {
          show: true,
          type: 'time',
          position: 'top',
          axisLine: { show: true, lineStyle: { color: '#e0e0e0' } },
          axisTick: { show: true },
          splitLine: { show: false },
          axisLabel: {
            show: true,
            formatter: (val: number) => dayjs(val).format('mm:ss'),
            color: '#666',
          },
        },
      ],
      yAxis: {
        type: 'category',
        data: processedData.labels,
        inverse: true,
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: {
          interval: 0,
          margin: 12,
          rich: richStyles,
          formatter: (value: string) => {
            const ruleName = processedData.labelRuleMap[value] || '';
            const styleKey = ruleName.replace(/[^a-zA-Z0-9_]/g, '_');
            return `{${styleKey}|${value}}`;
          },
        },
        z: 10,
      },
      dataZoom: [
        {
          type: 'inside',
          xAxisIndex: [0, 1],
          filterMode: 'weakFilter',
          zoomOnMouseWheel: false, // Disable enlarging/shrinking with wheel
          moveOnMouseWheel: false, // Restore normal page scrolling
          moveOnMouseMove: true, // Allow drag to pan
          zoomLock: true, // Explicitly lock the zoom scale
          preventDefaultMouseMove: false,
        },
      ],
      series: [
        {
          type: 'custom',
          renderItem: (
            params: echarts.CustomSeriesRenderItemParams,
            api: echarts.CustomSeriesRenderItemAPI,
          ) => {
            const categoryIndex = api.value(0) as number;
            const start = api.coord([api.value(1), categoryIndex]);
            const end = api.coord([api.value(2), categoryIndex]);
            const yCenter = start[1];

            const coordSys = params.coordSys as unknown as {
              x: number;
              y: number;
              width: number;
              height: number;
            };

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const children: any[] = [];

            // Full-width background on odd rows
            if (categoryIndex % 2 === 1) {
              const bgRect: echarts.CustomSeriesRenderItemReturn = {
                type: 'rect',
                shape: {
                  x: 0,
                  y: yCenter - ROW_HEIGHT / 2,
                  width: coordSys.x + coordSys.width,
                  height: ROW_HEIGHT,
                },
                style: {
                  fill: 'rgba(0, 0, 0, 0.03)',
                },
                silent: true,
                z2: -1,
              };
              children.push(bgRect);
            }

            const rectShape = echarts.graphic.clipRectByRect(
              {
                x: start[0],
                y: yCenter - BAR_HEIGHT / 2,
                width: Math.max(end[0] - start[0], 4),
                height: BAR_HEIGHT,
              },
              {
                x: coordSys.x,
                y: coordSys.y,
                width: coordSys.width,
                height: coordSys.height,
              },
            );

            if (rectShape) {
              const style = api.style() as { fill: string };
              const barRect: echarts.CustomSeriesRenderItemReturn = {
                type: 'rect',
                shape: {
                  ...rectShape,
                  r: [4, 4, 4, 4],
                },
                style: {
                  ...api.style(),
                  fill: style.fill,
                },
                z2: 1,
              };
              children.push(barRect);
            }

            return {
              type: 'group',
              children: children,
            };
          },
          encode: {
            x: [1, 2],
            y: 0,
          },
          data: processedData.items,
        },
      ],
    };
  }, [processedData]);

  const onEvents = useMemo(
    () => ({
      click: (params: echarts.ECElementEvent) => {
        if (
          onJobSelect &&
          params.data &&
          typeof params.data === 'object' &&
          'value' in params.data &&
          'name' in params.data
        ) {
          const data = params.data as { value: unknown[]; name: string };
          if (Array.isArray(data.value)) {
            const [, start, end, , status, jobId] = data.value as [
              number,
              number,
              number,
              number,
              string,
              string | number,
            ];
            const ruleName = data.name;
            onJobSelect({
              jobId: String(jobId),
              ruleName: String(ruleName),
              startTime: new Date(start).toISOString(),
              endTime: new Date(end).toISOString(),
              status: String(status),
            });
          }
        }
      },
    }),
    [onJobSelect],
  );

  if (isLoading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <Card style={{ border: 'none' }}>
        <Alert
          message="Error Loading Timeline"
          description={error instanceof Error ? error.message : 'Unknown error'}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  if (processedData.items.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
        No timeline data available
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100%',
        width: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      <ReactECharts
        option={option}
        style={{
          height: `${processedData.chartHeight}px`,
          width: '100%',
          minHeight: '100%',
        }}
        onEvents={onEvents}
        notMerge={true}
        lazyUpdate={true}
      />
    </div>
  );
};

export default WorkflowTimeline;
