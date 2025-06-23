import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SyncOutlined,
  TeamOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Space,
  Statistic,
  Typography,
} from "antd";
import React from "react";

import { useDashboardMetrics } from "../../hooks/useDashboardMetrics";
import LiveUpdatesIndicator from "../LiveUpdatesIndicator";
import { PerformanceChart } from "./PerformanceChart";
import { RecentWorkflows } from "./RecentWorkflows";
import { StatusChart } from "./StatusChart";
import { SystemHealth } from "./SystemHealth";
import { UserActivityTable } from "./UserActivityTable";

const { Title } = Typography;

export const DashboardLayout: React.FC = () => {
  const {
    metrics,
    isLoading,
    error,
    refetch,
    isSSEConnected,
    sseRetryCount,
    reconnectSSE,
  } = useDashboardMetrics();

  const handleRefresh = () => {
    refetch();
  };

  if (error) {
    return (
      <div style={{ padding: "24px" }}>
        <Alert
          message="Error Loading Dashboard"
          description={
            error instanceof Error
              ? error.message
              : "Failed to load dashboard data"
          }
          type="error"
          showIcon
          action={
            <Button size="small" onClick={handleRefresh}>
              Retry
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: "24px", background: "#f5f5f5", minHeight: "100vh" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "24px",
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, color: "#1890ff" }}>
            Workflow Dashboard
          </Title>
        </div>
        <Space>
          <LiveUpdatesIndicator
            isConnected={isSSEConnected}
            retryCount={sseRetryCount}
            onReconnect={reconnectSSE}
            showReconnectButton={true}
          />
          <Button
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={isLoading}
          >
            Refresh
          </Button>
        </Space>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: "12px" }}>
        <Col span={4}>
          <Card>
            <Statistic
              title="Total Workflows"
              value={metrics?.totalWorkflows || 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: "#1890ff" }}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Active Workflows"
              value={metrics?.activeWorkflows || 0}
              prefix={
                metrics && metrics.activeWorkflows > 0 ? (
                  <SyncOutlined spin />
                ) : (
                  <PlayCircleOutlined />
                )
              }
              valueStyle={{ color: "#faad14" }}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Failed Workflows"
              value={metrics?.failedWorkflows || 0}
              prefix={<ExclamationCircleOutlined />}
              valueStyle={{ color: "#ff4d4f" }}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Success Rate"
              value={metrics?.successRate || 0}
              suffix="%"
              prefix={<TrophyOutlined />}
              valueStyle={{ color: "#52c41a" }}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Avg Duration"
              value={metrics?.avgExecutionTime || 0}
              suffix="min"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: "#722ed1" }}
              loading={isLoading}
            />
          </Card>
        </Col>
        <Col span={4}>
          <Card>
            <Statistic
              title="Active Users"
              value={metrics?.activeUsers || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: "#13c2c2" }}
              loading={isLoading}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Section */}
      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} lg={12}>
          <StatusChart data={metrics?.statusDistribution} loading={isLoading} />
        </Col>
        <Col xs={24} lg={12}>
          <PerformanceChart
            data={metrics?.performanceTrends}
            loading={isLoading}
          />
        </Col>
      </Row>

      {/* Details Section */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <RecentWorkflows />
        </Col>
        <Col xs={24} lg={8}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <UserActivityTable
              data={metrics?.userActivity}
              loading={isLoading}
            />
            <SystemHealth data={metrics?.systemHealth} loading={isLoading} />
          </Space>
        </Col>
      </Row>
    </div>
  );
};
