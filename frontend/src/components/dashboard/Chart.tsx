import { Empty } from "antd";
import ReactECharts from "echarts-for-react";

import { getTagHexColor } from "../../utils/tagColors";
import WorkflowTag from "../tag/WorkflowTag";

export const BarChart = ({
  data,
  title,
  renderTag = true,
  maxLabelLength = 20, // Maximum characters to display for labels
}: {
  data: Array<[string, number]>;
  title: string;
  renderTag?: boolean;
  maxLabelLength?: number;
}) => {
  if (!data || data.length === 0) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={`No ${title.toLowerCase()} data found`}
        style={{ margin: "20px 0" }}
      />
    );
  }

  const categories = data.map(([name]) => name);
  const values = data.map(([, count]) => count);

  const barColors = categories.map((category) => getTagHexColor(category));
  const maxLabelWidth = Math.max(...categories.map((cat) => cat.length));
  const dynamicLeftMargin = renderTag
    ? "20%"
    : `${Math.min(Math.max(maxLabelWidth * 8, 80), 200)}px`; // Dynamic width with min/max limits

  // Function to truncate text
  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + "...";
  };

  const option = {
    grid: {
      left: dynamicLeftMargin,
      right: "10%",
      top: "10%",
      bottom: "15%",
    },
    xAxis: {
      type: "value",
      name: "Count",
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: {
        fontSize: 10,
        color: "#666",
      },
      axisLabel: {
        fontSize: 9,
        color: "#666",
      },
      axisLine: {
        lineStyle: {
          color: "#e8e8e8",
        },
      },
      splitLine: {
        lineStyle: {
          color: "#f0f0f0",
        },
      },
    },
    yAxis: {
      type: "category",
      data: categories,
      axisLabel: {
        show: !renderTag, // Show default labels when renderTag is false
        fontSize: 11,
        color: "#333",
        width: renderTag ? 0 : Math.min(maxLabelWidth * 8, 180), // Dynamic width
        overflow: "truncate", // Truncate long text
        ellipsis: "...", // Show ellipsis
        formatter: function (value: string) {
          return truncateText(value, maxLabelLength);
        },
      },
      axisLine: {
        lineStyle: {
          color: "#e8e8e8",
        },
      },
      axisTick: {
        show: false,
      },
    },
    series: [
      {
        type: "bar",
        data: values.map((value, index) => ({
          value: value,
          itemStyle: {
            color: barColors[index],
          },
        })),
        barWidth: "60%",
        label: {
          show: false,
        },
      },
    ],
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
      },
      formatter: function (params: Array<{ name: string; value: number }>) {
        const data = params[0];
        return `<strong>${data.name}</strong><br/>Count: ${data.value}`;
      },
    },
  };

  const chartHeight = 260;
  const gridTop = chartHeight * 0.1;
  const gridBottom = chartHeight * 0.15;
  const availableHeight = chartHeight - gridTop - gridBottom;
  const categoryHeight = availableHeight / categories.length;

  return (
    <div style={{ position: "relative", height: "260px", width: "100%" }}>
      {/* WorkflowTag labels positioned as y-axis labels */}
      {renderTag && (
        <div
          style={{
            position: "absolute",
            left: "2%",
            top: `${gridTop}px`,
            height: `${availableHeight}px`,
            width: "16%", // Fixed width for tag container
            display: "flex",
            flexDirection: "column-reverse", // Reverse to match ECharts category order
            justifyContent: "space-around",
            alignItems: "flex-end",
            zIndex: 10,
          }}
        >
          {categories.map((category) => (
            <div
              key={category}
              style={{
                height: `${categoryHeight}px`,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                paddingRight: "8px",
                overflow: "hidden", // Hide overflow
              }}
              title={category} // Show full text on hover
            >
              <div
                style={{
                  maxWidth: "100%",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                <WorkflowTag
                  tag={
                    category.length > maxLabelLength
                      ? truncateText(category, maxLabelLength)
                      : category
                  }
                  style={{
                    maxWidth: "100%",
                    display: "inline-block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <ReactECharts
        option={option}
        style={{ height: "260px", width: "100%" }}
        opts={{ renderer: "canvas" }}
      />
    </div>
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
        style={{ margin: "20px 0" }}
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
    return text.substring(0, maxLength - 3) + "...";
  };

  const option = {
    grid: {
      left: dynamicLeftMargin,
      right: "10%",
      top: "10%", // Same as BarChart
      bottom: "15%",
    },
    legend: {
      show: false,
    },
    xAxis: {
      type: "value",
      name: "Count",
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: {
        fontSize: 10,
        color: "#666",
      },
      axisLabel: {
        fontSize: 9,
        color: "#666",
      },
      axisLine: {
        lineStyle: {
          color: "#e8e8e8",
        },
      },
      splitLine: {
        lineStyle: {
          color: "#f0f0f0",
        },
      },
    },
    yAxis: {
      type: "category",
      data: categories,
      axisLabel: {
        fontSize: 11,
        color: "#333",
        width: Math.min(maxLabelWidth * 8, 180),
        overflow: "truncate",
        ellipsis: "...",
        formatter: function (value: string) {
          return truncateText(value, maxLabelLength);
        },
      },
      axisLine: {
        lineStyle: {
          color: "#e8e8e8",
        },
      },
      axisTick: {
        show: false,
      },
    },
    series: [
      {
        name: "Success",
        type: "bar",
        stack: "total",
        data: successData,
        itemStyle: {
          color: "#37a460",
        },
        barWidth: "60%", // Same as BarChart
      },
      {
        name: "Error",
        type: "bar",
        stack: "total",
        data: errorData,
        itemStyle: {
          color: "#ff4d4f",
        },
        barWidth: "60%", // Same as BarChart
      },
    ],
    tooltip: {
      trigger: "axis",
      axisPointer: {
        type: "shadow",
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
      style={{ height: "260px", width: "100%" }}
      opts={{ renderer: "svg" }}
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
        style={{ margin: "20px 0" }}
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
      top: "5%",
      right: "10%",
      bottom: "15%",
    },
    xAxis: {
      type: "value",
      name: "Duration (minutes)",
      nameLocation: "middle",
      nameGap: 30,
      nameTextStyle: {
        fontSize: 10,
        color: "#666",
      },
      axisLabel: {
        fontSize: 9,
        color: "#666",
      },
      axisLine: {
        lineStyle: {
          color: "#e8e8e8",
        },
      },
      splitLine: {
        lineStyle: {
          color: "#f0f0f0",
        },
      },
    },
    yAxis: {
      type: "category",
      data: categories,
      axisLabel: {
        fontSize: 11,
        color: "#333",
        width: Math.min(maxLabelWidth * 8, 180),
        overflow: "truncate",
        ellipsis: "...",
      },
      axisLine: {
        lineStyle: {
          color: "#e8e8e8",
        },
      },
      axisTick: {
        show: false,
      },
    },
    series: [
      {
        name: "Rule Duration",
        type: "boxplot",
        data: boxPlotData,
        itemStyle: {
          borderColor: "#5abc84",
          borderWidth: 1.5,
          color: "rgba(90, 188, 132, 0.2)",
        },
        boxWidth: ["7%", "50%"],
      },
    ],
    tooltip: {
      trigger: "item",
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
      style={{ height: "260px", width: "100%" }}
      opts={{ renderer: "svg" }}
    />
  );
};
