import {
  CloudServerOutlined,
  DatabaseOutlined,
  PlayCircleOutlined,
  SyncOutlined,
  TeamOutlined,
  WifiOutlined,
} from "@ant-design/icons";
import { Alert, Button, Card, Col, Row, Statistic, Typography } from "antd";
import React from "react";

import { StatusChart } from "./StatusChart";
import { useDashboardMetrics } from "./useDashboardMetrics";
// import LiveUpdatesIndicator from "../LiveUpdatesIndicator";
// import { PerformanceChart } from "./PerformanceChart";
// import { RecentWorkflows } from "./RecentWorkflows";
// import { SystemHealth } from "./SystemHealth";
// import { UserActivityTable } from "./UserActivityTable";

const { Title } = Typography;

export const DashboardLayout: React.FC = () => {
  const {
    runningWorkflows,
    runningJobs,
    runningUsers,
    cpuUsage,
    memoryUsage,
    sseStatus,
    workflowChartData,
    jobChartData,
    isLoading,
    error,
  } = useDashboardMetrics();

  const handleRefresh = () => {
    window.location.reload();
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
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: "12px" }}>
        {/* Running Workflows */}
        <Col span={4}>
          <Card>
            <Statistic
              title="Running Workflows"
              value={runningWorkflows.running}
              prefix={
                runningWorkflows.running > 0 ? (
                  <SyncOutlined spin />
                ) : (
                  <PlayCircleOutlined />
                )
              }
              valueStyle={{ color: "#1890ff", textAlign: "center" }}
              style={{ textAlign: "center" }}
              loading={isLoading}
            />
          </Card>
        </Col>

        {/* Running Jobs */}
        <Col span={4}>
          <Card>
            <Statistic
              title="Running Jobs"
              value={runningJobs.running}
              prefix={
                runningJobs.running > 0 ? (
                  <SyncOutlined spin />
                ) : (
                  <PlayCircleOutlined />
                )
              }
              valueStyle={{ color: "#faad14", textAlign: "center" }}
              style={{ textAlign: "center" }}
              loading={isLoading}
            />
          </Card>
        </Col>

        {/* Running Users */}
        <Col span={4}>
          <Card>
            <Statistic
              title="Active Users"
              value={`${runningUsers.running}/${runningUsers.total}`}
              prefix={<TeamOutlined />}
              valueStyle={{ color: "#52c41a", textAlign: "center" }}
              style={{ textAlign: "center" }}
              loading={isLoading}
            />
          </Card>
        </Col>

        {/* CPU Usage */}
        <Col span={4}>
          <Card>
            <Statistic
              title="CPU Usage"
              value={`${Math.round(cpuUsage.used)}/${Math.round(cpuUsage.total)}`}
              suffix="cores"
              prefix={<CloudServerOutlined />}
              valueStyle={{ color: "#722ed1", textAlign: "center" }}
              style={{ textAlign: "center" }}
              loading={isLoading}
            />
          </Card>
        </Col>

        {/* Memory Usage */}
        <Col span={4}>
          <Card>
            <Statistic
              title="Memory Usage"
              value={`${Math.round(memoryUsage.used)}/${Math.round(memoryUsage.total)}`}
              suffix="GB"
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: "#13c2c2", textAlign: "center" }}
              style={{ textAlign: "center" }}
              loading={isLoading}
            />
          </Card>
        </Col>

        {/* SSE Status */}
        <Col span={4}>
          <Card>
            <Statistic
              title="SSE Status"
              value={sseStatus.status}
              prefix={
                <WifiOutlined
                  style={{
                    color: sseStatus.isConnected
                      ? "#52c41a"
                      : sseStatus.status === "Error"
                        ? "#ff4d4f"
                        : "#faad14",
                  }}
                />
              }
              valueStyle={{
                color: sseStatus.isConnected
                  ? "#52c41a"
                  : sseStatus.status === "Error"
                    ? "#ff4d4f"
                    : "#faad14",
                textAlign: "center",
              }}
              style={{ textAlign: "center" }}
              loading={isLoading}
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Section */}
      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} lg={12}>
          <StatusChart
            title="Workflow Status Distribution"
            data={workflowChartData}
            loading={isLoading}
          />
        </Col>
        <Col xs={24} lg={12}>
          <StatusChart
            title="Job Status Distribution"
            data={jobChartData}
            loading={isLoading}
          />
        </Col>
      </Row>

      {/* Details Section */}
      {/* <Row gutter={[16, 16]}>
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
      </Row> */}
    </div>
  );
};
