import { Empty } from 'antd';
import ReactECharts from 'echarts-for-react';
import 'echarts-wordcloud';
import React from 'react';

const CHART_FONT_FAMILY =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif";

export const BarChart = ({
  data,
  title,
  maxLabelLength = 20, // Maximum characters to display for labels
}: {
  data: Array<[string, number]>;
  title: string;
  maxLabelLength?: number;
}) => {
  if (!data || data.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={`No ${title.toLowerCase()} data found`}
        style={{ margin: '20px 0' }}
      />
    );
  }

  const categories = data.map(([name]) => name);
  const values = data.map(([, count]) => count);

  const maxLabelWidth = Math.max(...categories.map((cat) => cat.length));
  const dynamicLeftMargin = `${Math.min(Math.max(maxLabelWidth * 8, 80), 100)}px`; // Dynamic width with min/max limits

  // Function to truncate text
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  const option = {
    grid: {
      left: dynamicLeftMargin,
      right: '10%',
      top: '10%',
      bottom: '15%',
    },
    xAxis: {
      type: 'value',
      name: 'Count',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: {
        fontSize: 10,
        color: '#666',
        fontFamily: CHART_FONT_FAMILY,
      },
      axisLabel: {
        fontSize: 9,
        color: '#666',
        fontFamily: CHART_FONT_FAMILY,
      },
      axisLine: {
        lineStyle: {
          color: '#e8e8e8',
        },
      },
      splitLine: {
        lineStyle: {
          color: '#f0f0f0',
        },
      },
    },
    yAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        fontSize: 11,
        color: '#333',
        width: Math.min(maxLabelWidth * 8, 180), // Dynamic width
        overflow: 'truncate', // Truncate long text
        ellipsis: '...', // Show ellipsis
        fontFamily: CHART_FONT_FAMILY,
        formatter: function (value: string) {
          return truncateText(value, maxLabelLength);
        },
      },
      axisLine: {
        lineStyle: {
          color: '#e8e8e8',
        },
      },
      axisTick: {
        show: false,
      },
    },
    series: [
      {
        type: 'bar',
        data: values.map((value) => ({
          value: value,
          itemStyle: {
            color: '#37a460',
          },
        })),
        barWidth: '60%',
        label: {
          show: false,
        },
      },
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
      formatter: function (params: Array<{ name: string; value: number }>) {
        const data = params[0];
        return `<strong>${data.name}</strong><br/>Count: ${data.value}`;
      },
    },
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: '260px', width: '100%' }}
      opts={{ renderer: 'canvas' }}
    />
  );
};

export const StackedBarChart = ({
  data,
  title,
  maxLabelLength = 20,
}: {
  data: Array<{
    name: string;
    total: number;
    error: number;
  }>;
  title: string;
  maxLabelLength?: number;
}) => {
  if (data.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={`No ${title.toLowerCase()} data found`}
        style={{ margin: '20px 0' }}
      />
    );
  }

  const categories = data.map((item) => item.name);
  const successData = data.map((item) => item.total - item.error);
  const errorData = data.map((item) => item.error);

  const maxLabelWidth = Math.max(...categories.map((cat) => cat.length));
  const dynamicLeftMargin = `${Math.min(Math.max(maxLabelWidth * 8, 80), 200)}px`;

  // Function to truncate text
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  };

  const option = {
    grid: {
      left: dynamicLeftMargin,
      right: '10%',
      top: '10%', // Same as BarChart
      bottom: '15%',
    },
    legend: {
      show: false,
    },
    xAxis: {
      type: 'value',
      name: 'Count',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: {
        fontSize: 10,
        color: '#666',
        fontFamily: CHART_FONT_FAMILY,
      },
      axisLabel: {
        fontSize: 9,
        color: '#666',
        fontFamily: CHART_FONT_FAMILY,
      },
      axisLine: {
        lineStyle: {
          color: '#e8e8e8',
        },
      },
      splitLine: {
        lineStyle: {
          color: '#f0f0f0',
        },
      },
    },
    yAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        fontSize: 11,
        color: '#333',
        width: Math.min(maxLabelWidth * 8, 180),
        overflow: 'truncate',
        ellipsis: '...',
        fontFamily: CHART_FONT_FAMILY,
        formatter: function (value: string) {
          return truncateText(value, maxLabelLength);
        },
      },
      axisLine: {
        lineStyle: {
          color: '#e8e8e8',
        },
      },
      axisTick: {
        show: false,
      },
    },
    series: [
      {
        name: 'Success',
        type: 'bar',
        stack: 'total',
        data: successData,
        itemStyle: {
          color: '#37a460',
        },
        barWidth: '60%', // Same as BarChart
      },
      {
        name: 'Error',
        type: 'bar',
        stack: 'total',
        data: errorData,
        itemStyle: {
          color: '#e57373',
        },
        barWidth: '60%', // Same as BarChart
      },
    ],
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow',
      },
      formatter: function (
        params: Array<{ name: string; value: number; seriesName: string }>,
      ) {
        const category = params[0].name;
        let result = `<strong>${category}</strong><br/>`;
        params.forEach((param) => {
          result += `${param.seriesName}: ${param.value}<br/>`;
        });
        const total = params.reduce((sum, param) => sum + param.value, 0);
        result += `<strong>Total: ${total}</strong>`;
        return result;
      },
    },
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: '260px', width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  );
};

export const BoxPlot = ({
  data,
  title,
}: {
  data: { [key: string]: { [key: string]: number } };
  title: string;
}) => {
  if (!data || Object.keys(data).length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={`No ${title.toLowerCase()} data found`}
        style={{ margin: '20px 0' }}
      />
    );
  }

  const categories = Object.keys(data);
  const boxPlotData = categories.map((category) => {
    const stats = data[category];
    // ECharts boxplot expects [min, q1, median, q3, max]
    return [
      stats.min,
      stats.q1,
      stats.median,
      stats.q3, // q4 is actually q3 (third quartile)
      stats.max,
    ];
  });

  const maxLabelWidth = Math.max(...categories.map((cat) => cat.length));
  const dynamicLeftMargin = `${Math.min(Math.max(maxLabelWidth * 8, 80), 200)}px`;

  const option = {
    grid: {
      left: dynamicLeftMargin,
      top: '5%',
      right: '10%',
      bottom: '15%',
    },
    xAxis: {
      type: 'value',
      name: 'Duration (minutes)',
      nameLocation: 'middle',
      nameGap: 30,
      nameTextStyle: {
        fontSize: 10,
        color: '#666',
        fontFamily: CHART_FONT_FAMILY,
      },
      axisLabel: {
        fontSize: 9,
        color: '#666',
        fontFamily: CHART_FONT_FAMILY,
      },
      axisLine: {
        lineStyle: {
          color: '#e8e8e8',
        },
      },
      splitLine: {
        lineStyle: {
          color: '#f0f0f0',
        },
      },
    },
    yAxis: {
      type: 'category',
      data: categories,
      axisLabel: {
        fontSize: 11,
        color: '#333',
        width: Math.min(maxLabelWidth * 8, 180),
        overflow: 'truncate',
        ellipsis: '...',
        fontFamily: CHART_FONT_FAMILY,
      },
      axisLine: {
        lineStyle: {
          color: '#e8e8e8',
        },
      },
      axisTick: {
        show: false,
      },
    },
    series: [
      {
        name: 'Rule Duration',
        type: 'boxplot',
        data: boxPlotData,
        itemStyle: {
          borderColor: '#5abc84',
          borderWidth: 1.5,
          color: 'rgba(90, 188, 132, 0.2)',
        },
        boxWidth: ['7%', '50%'],
      },
    ],
    tooltip: {
      trigger: 'item',
      formatter: function (params: { data: number[]; dataIndex: number }) {
        const data = params.data;
        const categoryName = categories[params.dataIndex];
        return `
          <strong>${categoryName}</strong><br/>
          Max: ${data[4].toFixed(2)}m<br/>
          Q3: ${data[3].toFixed(2)}m<br/>
          Median: ${data[2].toFixed(2)}m<br/>
          Q1: ${data[1].toFixed(2)}m<br/>
          Min: ${data[0].toFixed(2)}m
        `;
      },
    },
  };

  return (
    <ReactECharts
      option={option}
      style={{ height: '260px', width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  );
};

export const WordCloud = React.memo(
  ({ data, title }: { data: Array<{ name: string; value: number }>; title: string }) => {
    if (!data || data.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={`No ${title.toLowerCase()} data found`}
          style={{ margin: '20px 0' }}
        />
      );
    }

    // Define color palette
    const colors = [
      '#37a460',
      '#52c41a',
      '#85d2ab',
      '#73d13d',
      '#b7eb8f',
      '#5abc84',
      '#95f985',
      '#7cb305',
      '#389e0d',
      '#237804',
    ];

    // Create a simple hash function for consistent color assignment
    const getHashCode = (str: string): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash);
    };

    // Transform data for word cloud format with deterministic colors
    const wordCloudData = data.map(({ name, value }) => ({
      name: name,
      value: value,
      textStyle: {
        color: colors[getHashCode(name) % colors.length],
      },
    }));

    const option = {
      tooltip: {
        show: true,
        confine: true,
        formatter: function (params: { name: string; value: number }) {
          return `Count: ${params.value}`;
        },
      },
      series: [
        {
          type: 'wordCloud',
          data: wordCloudData,
          // Shape of the word cloud
          shape: 'square',
          // Keep aspect ratio of words
          keepAspect: false,
          // Font configuration
          textStyle: {
            fontFamily: CHART_FONT_FAMILY,
            fontWeight: 'normal',
          },
          // Size range for words based on their values
          sizeRange: [14, 60],
          // Rotation range for words
          rotationRange: [-90, 90],
          // Rotation step
          rotationStep: 45,
          // Grid size for layout algorithm
          gridSize: 8,
          // Drawing outside of canvas will not be shown
          drawOutOfBound: false,
          // Shrink to fit if the word cloud is too large
          shrinkToFit: true,
          // Layout animation
          layoutAnimation: true,
          // Word spacing
          left: 'center',
          top: 'center',
          right: null,
          bottom: null,
          width: '100%',
          height: '100%',
        },
      ],
    };

    return (
      <ReactECharts
        option={option}
        style={{ height: '260px', width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    );
  },
);

WordCloud.displayName = 'WordCloud';
