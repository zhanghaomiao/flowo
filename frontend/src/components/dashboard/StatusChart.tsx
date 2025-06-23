import { Card, Empty, Spin } from "antd";
import React from "react";

interface StatusData {
  SUCCESS: number;
  RUNNING: number;
  ERROR: number;
  WAITING: number;
}

interface StatusChartProps {
  data?: StatusData;
  loading?: boolean;
}

export const StatusChart: React.FC<StatusChartProps> = ({ data, loading }) => {
  if (loading) {
    return (
      <Card title="Workflow Status Distribution" style={{ height: "400px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "300px",
          }}
        >
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card title="Workflow Status Distribution" style={{ height: "400px" }}>
        <Empty description="No data available" />
      </Card>
    );
  }

  // Transform data for chart
  const chartData = [
    { status: "Success", count: data.SUCCESS, color: "#52c41a" },
    { status: "Running", count: data.RUNNING, color: "#1890ff" },
    { status: "Error", count: data.ERROR, color: "#ff4d4f" },
    { status: "Waiting", count: data.WAITING, color: "#faad14" },
  ].filter((item) => item.count > 0);

  const total = Object.values(data).reduce((sum, count) => sum + count, 0);

  return (
    <Card title="Workflow Status Distribution" style={{ height: "400px" }}>
      <div style={{ height: "320px", display: "flex", alignItems: "center" }}>
        {total === 0 ? (
          <Empty description="No workflows found" style={{ margin: "auto" }} />
        ) : (
          <div style={{ width: "100%", height: "100%" }}>
            {/* Simple pie chart using CSS */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  marginBottom: "20px",
                }}
              >
                <div
                  style={{
                    width: "200px",
                    height: "200px",
                    borderRadius: "50%",
                    background: `conic-gradient(
                      ${chartData
                        .map((item, index) => {
                          const percentage = (item.count / total) * 100;
                          const prevPercentages = chartData
                            .slice(0, index)
                            .reduce(
                              (sum, prev) => sum + (prev.count / total) * 100,
                              0,
                            );
                          return `${item.color} ${prevPercentages}% ${prevPercentages + percentage}%`;
                        })
                        .join(", ")}
                    )`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      width: "120px",
                      height: "120px",
                      borderRadius: "50%",
                      backgroundColor: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                    }}
                  >
                    <div style={{ fontSize: "24px", fontWeight: "bold" }}>
                      {total}
                    </div>
                    <div style={{ fontSize: "12px", color: "#666" }}>Total</div>
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
                }}
              >
                {chartData.map((item) => (
                  <div
                    key={item.status}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "2px",
                        backgroundColor: item.color,
                      }}
                    />
                    <span style={{ fontSize: "14px" }}>
                      {item.status}: {item.count} (
                      {Math.round((item.count / total) * 100)}%)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
