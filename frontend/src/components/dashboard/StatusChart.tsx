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

export const StatusChart: React.FC<StatusChartProps> = ({
  title,
  data,
  loading = false,
}) => {
  // Prepare chart data
  const chartData = [
    ["Status", "Count"],
    ["Success", data.success],
    ["Running", data.running],
    ["Error", data.error],
  ];

  const options = {
    title: "",
    pieHole: 0.5, // Donut chart with larger hole for total display
    colors: ["#52c41a", "#1890ff", "#ff4d4f"], // Green, Blue, Red
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
    },
    pieSliceText: "value",
  };

  return (
    <Card title={title} loading={loading} style={{ height: "350px" }}>
      <div
        style={{
          width: "100%",
          height: "280px",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        {!loading && (
          <>
            <div
              style={{ width: "100%", height: "100%", position: "relative" }}
            >
              <Chart
                chartType="PieChart"
                width="100%"
                height="100%"
                data={chartData}
                options={options}
              />
            </div>
            {/* Total count overlay in the center of donut */}
            <div
              style={{
                position: "absolute",
                top: "calc(50% - 10px)",
                left: "50%",
                // transform: "translate(-50%, -50%)",
                textAlign: "center",
                pointerEvents: "none",
                zIndex: 10,
                userSelect: "none",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  fontSize: "28px",
                  fontWeight: "bold",
                  color: "#333",
                  lineHeight: "1",
                  textShadow: "0 1px 2px rgba(255,255,255,0.8)",
                }}
              >
                {data.total}
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: "#666",
                  fontWeight: "500",
                  marginTop: "2px",
                }}
              >
                Total
              </div>
            </div>
          </>
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
