import { Card } from "antd";
import React from "react";

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
  // Calculate percentages for the conic gradient
  const calculatePercentages = () => {
    if (data.total === 0)
      return { success: 0, running: 0, error: 0, waiting: 0 };

    const waiting = data.total - data.success - data.running - data.error;

    return {
      success: (data.success / data.total) * 100,
      running: (data.running / data.total) * 100,
      error: (data.error / data.total) * 100,
      waiting: (waiting / data.total) * 100,
    };
  };

  const percentages = calculatePercentages();
  const waiting = data.total - data.success - data.running - data.error;

  // Create conic gradient based on data
  const createConicGradient = () => {
    if (data.total === 0) return "conic-gradient(#d9d9d9 100%)";

    let gradientString = "conic-gradient(from 0deg, ";
    let currentAngle = 0;

    // Success (green)
    if (data.success > 0) {
      const endAngle = currentAngle + percentages.success * 3.6; // Convert percentage to degrees
      gradientString += `#37a460 ${currentAngle}deg ${endAngle}deg, `;
      currentAngle = endAngle;
    }

    // Running (light green)
    if (data.running > 0) {
      const endAngle = currentAngle + percentages.running * 3.6;
      gradientString += `#85d2ab ${currentAngle}deg ${endAngle}deg, `;
      currentAngle = endAngle;
    }

    // Error (red)
    if (data.error > 0) {
      const endAngle = currentAngle + percentages.error * 3.6;
      gradientString += `#f5222d ${currentAngle}deg ${endAngle}deg, `;
      currentAngle = endAngle;
    }

    if (waiting > 0) {
      gradientString += `#d9d9d9 ${currentAngle}deg 360deg`;
    } else {
      gradientString = gradientString.slice(0, -2);
    }

    gradientString += ")";
    return gradientString;
  };

  return (
    <Card title={title} loading={loading} style={{ height: "350px" }}>
      <div
        style={{
          width: "100%",
          height: "280px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "20px",
        }}
      >
        {!loading && (
          <>
            {/* CSS Donut Chart */}
            <div
              style={{
                position: "relative",
                width: "200px",
                height: "200px",
                borderRadius: "50%",
                background: createConicGradient(),
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.3s ease",
              }}
            >
              {/* Inner circle to create donut effect */}
              <div
                style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "50%",
                  backgroundColor: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
                }}
              >
                {/* Total count in center */}
                <div
                  style={{
                    fontSize: "32px",
                    fontWeight: "bold",
                    color: "#333",
                    lineHeight: "1",
                  }}
                >
                  {data.total}
                </div>
                <div
                  style={{
                    fontSize: "14px",
                    color: "#666",
                    fontWeight: "500",
                    marginTop: "4px",
                  }}
                >
                  Total
                </div>
              </div>
            </div>

            {/* Legend */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                flexWrap: "wrap",
                gap: "16px",
                maxWidth: "300px",
              }}
            >
              {data.success > 0 && (
                <div
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      backgroundColor: "#37a460",
                      borderRadius: "2px",
                    }}
                  />
                  <span style={{ fontSize: "12px", color: "#333" }}>
                    Success: {data.success}
                  </span>
                </div>
              )}

              {data.running > 0 && (
                <div
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      backgroundColor: "#85d2ab",
                      borderRadius: "2px",
                    }}
                  />
                  <span style={{ fontSize: "12px", color: "#333" }}>
                    Running: {data.running}
                  </span>
                </div>
              )}

              {data.error > 0 && (
                <div
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      backgroundColor: "#f5222d",
                      borderRadius: "2px",
                    }}
                  />
                  <span style={{ fontSize: "12px", color: "#333" }}>
                    Error: {data.error}
                  </span>
                </div>
              )}

              {waiting > 0 && (
                <div
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <div
                    style={{
                      width: "12px",
                      height: "12px",
                      backgroundColor: "#d9d9d9",
                      borderRadius: "2px",
                    }}
                  />
                  <span style={{ fontSize: "12px", color: "#333" }}>
                    Waiting: {waiting}
                  </span>
                </div>
              )}
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
