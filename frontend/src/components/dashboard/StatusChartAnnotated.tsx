import { Card } from "antd";
import React from "react";
import { Chart } from "react-google-charts";

interface StatusData {
  success: number;
  running: number;
  error: number;
  total: number;
}

interface StatusChartProps {
  title: string;
  data: StatusData;
  loading?: boolean;
}

export const StatusChartAnnotated: React.FC<StatusChartProps> = ({
  title,
  data,
  loading = false,
}) => {
  // Prepare chart data with annotations
  const chartData = [
    ["Status", "Count", { role: "annotation" }],
    ["Success", data.success, ""],
    ["Running", data.running, ""],
    ["Error", data.error, ""],
    // Add invisible slice for center text
    ["", 0, `Total\n${data.total}`],
  ];

  const options = {
    title: "",
    pieHole: 0.5,
    colors: ["#37a460", "#85d2ab", "#f5222d", "transparent"],
    legend: {
      position: "bottom",
      alignment: "center",
      textStyle: {
        fontSize: 12,
      },
    },
    chartArea: {
      left: 0,
      top: 0,
      width: "80%",
      height: "80%",
    },
    backgroundColor: "transparent",
    pieSliceTextStyle: {
      color: "white",
      fontSize: 11,
    },
    tooltip: {
      textStyle: {
        fontSize: 12,
      },
      showColorCode: true,
      // Hide tooltip for the invisible slice
      trigger: "selection",
    },
    pieSliceText: "value",
    annotations: {
      textStyle: {
        fontSize: 20,
        bold: true,
        color: "#333",
      },
    },
    // Hide the invisible slice from legend
    slices: {
      3: {
        color: "transparent",
        offset: 0,
      },
    },
  };

  return (
    <Card title={title} loading={loading} style={{ height: "350px" }}>
      <div
        style={{
          width: "100%",
          height: "280px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {!loading && (
          <Chart
            chartType="PieChart"
            width="100%"
            height="100%"
            data={chartData}
            options={options}
          />
        )}
        {loading && (
          <div style={{ textAlign: "center", color: "#666" }}>
            Loading chart...
          </div>
        )}
      </div>
    </Card>
  );
};
