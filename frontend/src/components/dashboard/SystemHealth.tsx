import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { Card, Progress, Space, Statistic, Tag } from "antd";
import React from "react";

interface SystemHealthData {
  uptime: string;
  avgResponseTime: number;
  errorRate: number;
  status: "healthy" | "warning" | "critical";
}

interface SystemHealthProps {
  data?: SystemHealthData;
  loading?: boolean;
}

export const SystemHealth: React.FC<SystemHealthProps> = ({
  data,
  loading,
}) => {
  const getStatusConfig = (status: SystemHealthData["status"]) => {
    switch (status) {
      case "healthy":
        return {
          color: "#52c41a",
          icon: <CheckCircleOutlined />,
          text: "Healthy",
        };
      case "warning":
        return {
          color: "#faad14",
          icon: <WarningOutlined />,
          text: "Warning",
        };
      case "critical":
        return {
          color: "#ff4d4f",
          icon: <ExclamationCircleOutlined />,
          text: "Critical",
        };
      default:
        return {
          color: "#d9d9d9",
          icon: <CheckCircleOutlined />,
          text: "Unknown",
        };
    }
  };

  const statusConfig = data
    ? getStatusConfig(data.status)
    : getStatusConfig("healthy");

  return (
    <Card
      title="System Health"
      style={{ height: "200px" }}
      extra={
        <Tag
          color={statusConfig.color}
          icon={statusConfig.icon}
          style={{ borderRadius: "12px", padding: "2px 8px" }}
        >
          {statusConfig.text}
        </Tag>
      }
    >
      <div style={{ height: "120px" }}>
        <Space direction="vertical" style={{ width: "100%" }} size="small">
          {/* Uptime */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "13px", color: "#666" }}>Uptime</span>
            <span style={{ fontSize: "14px", fontWeight: "500" }}>
              {loading ? "..." : data?.uptime || "N/A"}
            </span>
          </div>

          {/* Response Time */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "13px", color: "#666" }}>
              Avg Response
            </span>
            <span style={{ fontSize: "14px", fontWeight: "500" }}>
              {loading ? "..." : `${data?.avgResponseTime || 0}ms`}
            </span>
          </div>

          {/* Error Rate */}
          <div style={{ marginTop: "8px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "4px",
              }}
            >
              <span style={{ fontSize: "13px", color: "#666" }}>
                Error Rate
              </span>
              <span style={{ fontSize: "14px", fontWeight: "500" }}>
                {loading ? "..." : `${data?.errorRate || 0}%`}
              </span>
            </div>
            <Progress
              percent={data?.errorRate || 0}
              size="small"
              strokeColor={
                !data || data.errorRate <= 5
                  ? "#52c41a"
                  : data.errorRate <= 15
                    ? "#faad14"
                    : "#ff4d4f"
              }
              trailColor="#f0f0f0"
              showInfo={false}
            />
          </div>

          {/* Last Updated */}
          <div
            style={{
              textAlign: "center",
              marginTop: "8px",
              fontSize: "11px",
              color: "#999",
            }}
          >
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </Space>
      </div>
    </Card>
  );
};
