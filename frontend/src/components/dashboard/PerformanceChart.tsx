import { Card, Empty, Spin } from "antd";
import React from "react";

interface PerformanceData {
  date: string;
  completed: number;
  failed: number;
  avgDuration: number;
}

interface PerformanceChartProps {
  data?: PerformanceData[];
  loading?: boolean;
}

export const PerformanceChart: React.FC<PerformanceChartProps> = ({
  data,
  loading,
}) => {
  if (loading) {
    return (
      <Card
        title="Performance Trends (Last 7 Days)"
        style={{ height: "400px" }}
      >
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

  if (!data || data.length === 0) {
    return (
      <Card
        title="Performance Trends (Last 7 Days)"
        style={{ height: "400px" }}
      >
        <Empty description="No performance data available" />
      </Card>
    );
  }

  const maxCompleted = Math.max(...data.map((d) => d.completed));
  const maxFailed = Math.max(...data.map((d) => d.failed));
  const maxCount = Math.max(maxCompleted, maxFailed);
  const maxDuration = Math.max(...data.map((d) => d.avgDuration));

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <Card title="Performance Trends (Last 7 Days)" style={{ height: "400px" }}>
      <div style={{ height: "320px", padding: "20px 0" }}>
        {maxCount === 0 ? (
          <Empty
            description="No workflow activity"
            style={{ marginTop: "100px" }}
          />
        ) : (
          <div style={{ position: "relative", height: "100%" }}>
            {/* Chart area */}
            <div
              style={{
                display: "flex",
                alignItems: "end",
                justifyContent: "space-around",
                height: "240px",
                borderBottom: "1px solid #f0f0f0",
                paddingBottom: "10px",
              }}
            >
              {data.map((item, index) => {
                const completedHeight =
                  maxCount > 0 ? (item.completed / maxCount) * 200 : 0;
                const failedHeight =
                  maxCount > 0 ? (item.failed / maxCount) * 200 : 0;

                return (
                  <div
                    key={item.date}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: "4px",
                      minWidth: "60px",
                    }}
                  >
                    {/* Bars */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "end",
                        gap: "2px",
                        height: "200px",
                      }}
                    >
                      {/* Completed bar */}
                      <div
                        style={{
                          width: "20px",
                          height: `${completedHeight}px`,
                          backgroundColor: "#52c41a",
                          borderRadius: "2px 2px 0 0",
                          position: "relative",
                        }}
                        title={`Completed: ${item.completed}`}
                      >
                        {item.completed > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              top: "-20px",
                              left: "50%",
                              transform: "translateX(-50%)",
                              fontSize: "10px",
                              color: "#52c41a",
                              fontWeight: "bold",
                            }}
                          >
                            {item.completed}
                          </div>
                        )}
                      </div>

                      {/* Failed bar */}
                      <div
                        style={{
                          width: "20px",
                          height: `${failedHeight}px`,
                          backgroundColor: "#ff4d4f",
                          borderRadius: "2px 2px 0 0",
                          position: "relative",
                        }}
                        title={`Failed: ${item.failed}`}
                      >
                        {item.failed > 0 && (
                          <div
                            style={{
                              position: "absolute",
                              top: "-20px",
                              left: "50%",
                              transform: "translateX(-50%)",
                              fontSize: "10px",
                              color: "#ff4d4f",
                              fontWeight: "bold",
                            }}
                          >
                            {item.failed}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Date label */}
                    <div
                      style={{
                        fontSize: "11px",
                        color: "#666",
                        textAlign: "center",
                      }}
                    >
                      {formatDate(item.date)}
                    </div>

                    {/* Duration indicator */}
                    {item.avgDuration > 0 && (
                      <div
                        style={{
                          fontSize: "10px",
                          color: "#722ed1",
                          textAlign: "center",
                        }}
                        title={`Average Duration: ${item.avgDuration} minutes`}
                      >
                        {item.avgDuration}m
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                gap: "20px",
                marginTop: "20px",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    backgroundColor: "#52c41a",
                    borderRadius: "2px",
                  }}
                />
                <span style={{ fontSize: "12px" }}>Completed</span>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    backgroundColor: "#ff4d4f",
                    borderRadius: "2px",
                  }}
                />
                <span style={{ fontSize: "12px" }}>Failed</span>
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    backgroundColor: "#722ed1",
                    borderRadius: "2px",
                  }}
                />
                <span style={{ fontSize: "12px" }}>Avg Duration (min)</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};
