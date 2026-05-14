import React from 'react';

import { Empty } from 'antd';
import ReactECharts from 'echarts-for-react';

import 'echarts-wordcloud';

const CHART_FONT_FAMILY = "'Inter', sans-serif";

const PREMIUM_COLORS = [
  '#0ea5e9', // Sky 500 (Theme Primary & Success)
  '#6366f1', // Indigo 500 (Running)
  '#8b5cf6', // Purple 500
  '#f59e0b', // Amber 500
  '#f43f5e', // Rose 500 (Error)
  '#10b981', // Emerald 500
];

/** Brand-only hues for word clouds (matches @theme brand scale). */
const BRAND_WORDCLOUD_COLORS = [
  '#0c4a6e',
  '#075985',
  '#0369a1',
  '#0284c7',
  '#0ea5e9',
  '#38bdf8',
  '#7dd3fc',
];

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i);
  }
  return Math.abs(h);
}

export const BarChart = ({
  data,
  maxLabelLength = 20,
}: {
  data: Array<[string, number]>;
  maxLabelLength?: number;
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Empty />
      </div>
    );
  }

  const categories = data.map(([name]) => name);
  const values = data.map(([, count]) => count);

  const option = {
    grid: { left: '15%', right: '5%', top: '5%', bottom: '15%' },
    xAxis: {
      type: 'value',
      axisLabel: {
        color: '#94a3b8',
        fontFamily: CHART_FONT_FAMILY,
        fontSize: 10,
      },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    yAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        color: '#475569',
        fontFamily: CHART_FONT_FAMILY,
        fontSize: 10,
        width: 120,
        overflow: 'truncate',
        ellipsis: '...',
        formatter: (v: string) =>
          v.length > maxLabelLength
            ? v.substring(0, maxLabelLength) + '...'
            : v,
      },
      axisLine: { lineStyle: { color: '#f1f5f9' } },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        data: values,
        itemStyle: {
          color: PREMIUM_COLORS[0],
          borderRadius: [0, 4, 4, 0],
        },
        barWidth: '50%',
      },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderColor: '#f1f5f9',
      textStyle: { color: '#1e293b', fontSize: 12 },
      formatter: (params: { name: string; value: number }[]) =>
        `<strong>${params[0].name}</strong>: ${params[0].value}`,
    },
  };

  return (
    <ReactECharts option={option} style={{ height: '200px', width: '100%' }} />
  );
};

export const StackedBarChart = ({
  data,
}: {
  data: Array<{ name: string; total: number; error: number }>;
}) => {
  if (data.length === 0)
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Empty />
      </div>
    );

  const categories = data.map((item) => item.name);
  const successData = data.map((item) => item.total - item.error);
  const errorData = data.map((item) => item.error);

  const option = {
    grid: { left: '15%', right: '5%', top: '5%', bottom: '15%' },
    xAxis: {
      type: 'value',
      axisLabel: { fontSize: 10, color: '#94a3b8' },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'category',
      data: categories,
      axisLabel: { fontSize: 10, color: '#475569' },
      axisLine: { lineStyle: { color: '#f1f5f9' } },
    },
    series: [
      {
        name: 'Success',
        type: 'bar',
        stack: 'total',
        data: successData,
        itemStyle: { color: PREMIUM_COLORS[0] }, // Sky Blue
        barWidth: '50%',
      },
      {
        name: 'Error',
        type: 'bar',
        stack: 'total',
        data: errorData,
        itemStyle: { color: PREMIUM_COLORS[4] }, // Rose Red
      },
    ],
    tooltip: { trigger: 'axis', backgroundColor: 'rgba(255, 255, 255, 0.9)' },
  };

  return (
    <ReactECharts option={option} style={{ height: '200px', width: '100%' }} />
  );
};

export const BoxPlot = ({
  data,
}: {
  data?: Record<string, Record<string, number>>;
}) => {
  if (!data || Object.keys(data).length === 0)
    return (
      <div className="flex flex-1 items-center justify-center p-12">
        <Empty />
      </div>
    );
  const categories = Object.keys(data);
  const boxPlotData = categories.map((cat) => {
    const item = data[cat];
    return [
      item.min ?? 0,
      item.q1 ?? 0,
      item.median ?? 0,
      item.q3 ?? 0,
      item.max ?? 0,
    ];
  });

  const option = {
    grid: { left: '15%', right: '5%', top: '5%', bottom: '22%' },
    xAxis: {
      type: 'value',
      name: 'ln(min + 1)',
      nameLocation: 'middle',
      nameGap: 28,
      nameTextStyle: {
        fontSize: 11,
        color: '#64748b',
        fontFamily: CHART_FONT_FAMILY,
        fontWeight: 600,
      },
      axisLabel: { fontSize: 10, color: '#94a3b8' },
    },
    yAxis: {
      type: 'category',
      data: categories,
      axisLabel: { fontSize: 10, color: '#475569' },
    },
    series: [
      {
        type: 'boxplot',
        data: boxPlotData,
        itemStyle: {
          borderColor: '#0284c7',
          color: 'rgba(14, 165, 233, 0.12)',
        },
      },
    ],
    tooltip: {
      trigger: 'item',
      formatter: (param: { name?: string; data?: number[] }) => {
        const name = param.name ?? '';
        const d = param.data;
        if (!Array.isArray(d) || d.length < 5) {
          return name;
        }
        const [mn, q1, med, q3, mx] = d;
        return (
          `<div style="font-size:12px"><strong>${name}</strong><br/>` +
          `<span style="opacity:.75">ln(min+1) scale</span><br/>` +
          `min: ${mn}<br/>Q1: ${q1}<br/>median: ${med}<br/>Q3: ${q3}<br/>max: ${mx}</div>`
        );
      },
    },
  };

  return (
    <ReactECharts option={option} style={{ height: '200px', width: '100%' }} />
  );
};

export const WordCloud = React.memo(
  ({ data }: { data: Array<{ name: string; value: number }> }) => {
    if (!data || data.length === 0)
      return (
        <div className="flex flex-1 items-center justify-center p-12">
          <Empty />
        </div>
      );
    const wordCloudData = data.map(({ name, value }) => ({
      name,
      value,
      textStyle: {
        color:
          BRAND_WORDCLOUD_COLORS[
            hashString(name) % BRAND_WORDCLOUD_COLORS.length
          ],
      },
    }));

    const option = {
      series: [
        {
          type: 'wordCloud',
          shape: 'circle',
          data: wordCloudData,
          sizeRange: [12, 40],
          rotationRange: [0, 0],
        },
      ],
      tooltip: { show: true },
    };

    return (
      <ReactECharts
        option={option}
        style={{ height: '300px', width: '100%' }}
      />
    );
  },
);
WordCloud.displayName = 'WordCloud';
