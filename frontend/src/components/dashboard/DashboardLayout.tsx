import {
  CloudServerOutlined,
  DatabaseOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SyncOutlined,
  TeamOutlined,
  ToolOutlined,
  WifiOutlined,
} from "@ant-design/icons";
import {
  Alert,
  Button,
  Card,
  Col,
  message,
  Popconfirm,
  Row,
  Space,
  Statistic,
  Typography,
} from "antd";
import React, { useState } from "react";

import { BarChart, BoxPlot, StackedBarChart } from "./Chart";
import { StatusChart } from "./StatusChart";
import { useDashboardMetrics, useDatabasePruning } from "./useDashboardMetrics";

const { Title } = Typography;

export const DashboardLayout: React.FC = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const [isReloading, setIsReloading] = useState(false);
  const databasePruning = useDatabasePruning();

  const {
    runningWorkflows,
    runningJobs,
    runningUsers,
    cpuUsage,
    memoryUsage,
    sseStatus,
    workflowChartData,
    jobChartData,
    tagActivity,
    ruleActivity,
    ruleError,
    ruleDuration,
  } = useDashboardMetrics();

  const handleReload = async () => {
    setIsReloading(true);
    try {
      // Reload the entire page to refresh all data
      window.location.reload();
    } catch {
      message.error("Failed to reload dashboard");
      setIsReloading(false);
    }
  };

  const handleDatabasePruning = async () => {
    try {
      const data = await databasePruning.mutateAsync();
      messageApi.open({
        type: "success",
        content: `Database pruning completed successfully, delete ${data.workflow} workflows 
        and update ${data.job} jobs status`,
      });
    } catch {
      messageApi.open({
        type: "error",
        content: "Database pruning failed",
      });
    }
  };

  return (
    <div style={{ padding: "22px", background: "#f5f5f5", minHeight: "90vh" }}>
      {contextHolder}
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
            Flowo Dashboard
          </Title>
        </div>

        <div>
          <Space>
            <Button
              type="default"
              icon={<ReloadOutlined />}
              loading={isReloading}
              onClick={handleReload}
              style={{
                borderColor: "#1890ff",
                color: "#1890ff",
              }}
            >
              Reload Dashboard
            </Button>
            <Popconfirm
              title="Database Pruning"
              description={
                <div style={{ maxWidth: 300 }}>
                  <p style={{ marginBottom: 8, fontWeight: 500 }}>
                    Are you sure you want to prune the database?
                  </p>
                  <p style={{ marginBottom: 8, fontSize: 13, color: "#666" }}>
                    The pruning will perform the following operations:
                  </p>
                  <ul
                    style={{
                      paddingLeft: 16,
                      margin: 0,
                      fontSize: 12,
                      color: "#666",
                    }}
                  >
                    <li style={{ marginBottom: 4 }}>
                      Delete the workflow that has no job
                    </li>
                    <li style={{ marginBottom: 4 }}>
                      Set running job status to <strong>success</strong> when
                      the status of workflow is success
                    </li>
                    <li style={{ marginBottom: 0 }}>
                      Set running job status to <strong>error</strong> when the
                      status of workflow is error
                    </li>
                  </ul>
                </div>
              }
              onConfirm={handleDatabasePruning}
              okText="Yes"
              cancelText="No"
              placement="bottomRight"
              getPopupContainer={(triggerNode) =>
                triggerNode.parentElement || document.body
              }
            >
              <Button
                type="primary"
                icon={<ToolOutlined />}
                loading={databasePruning.isPending}
                danger
                style={{
                  backgroundColor: "#ff4d4f",
                  borderColor: "#ff4d4f",
                }}
              >
                Database Pruning
              </Button>
            </Popconfirm>
          </Space>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: "12px" }}>
        <Col span={4}>
          <Card style={{ height: "100%" }}>
            {runningWorkflows.error ? (
              <div style={{ textAlign: "center" }}>
                <Alert message="Failed to load" type="error" showIcon />
              </div>
            ) : (
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
                loading={runningWorkflows.loading}
              />
            )}
          </Card>
        </Col>

        <Col span={4}>
          <Card style={{ height: "100%" }}>
            {runningJobs.error ? (
              <div style={{ textAlign: "center" }}>
                <Alert message="Failed to load" type="error" showIcon />
              </div>
            ) : (
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
                loading={runningJobs.loading}
              />
            )}
          </Card>
        </Col>

        <Col span={4}>
          <Card style={{ height: "100%" }}>
            {runningUsers.error ? (
              <div style={{ textAlign: "center" }}>
                <Alert message="Failed to load" type="error" showIcon />
              </div>
            ) : (
              <Statistic
                title="Active Users"
                value={`${runningUsers.running}/${runningUsers.total}`}
                prefix={<TeamOutlined />}
                valueStyle={{ color: "#52c41a", textAlign: "center" }}
                style={{ textAlign: "center" }}
                loading={runningUsers.loading}
              />
            )}
          </Card>
        </Col>

        <Col span={4}>
          <Card style={{ height: "100%" }}>
            {cpuUsage.error ? (
              <div style={{ textAlign: "center" }}>
                <Alert message="Failed to load" type="error" showIcon />
              </div>
            ) : (
              <Statistic
                title="CPU Usage"
                value={`${Math.round(cpuUsage.used)}/${Math.round(cpuUsage.total)}`}
                suffix="cores"
                prefix={<CloudServerOutlined />}
                valueStyle={{ color: "#722ed1", textAlign: "center" }}
                style={{ textAlign: "center" }}
                loading={cpuUsage.loading}
              />
            )}
          </Card>
        </Col>

        <Col span={4}>
          <Card style={{ height: "100%" }}>
            {memoryUsage.error ? (
              <div style={{ textAlign: "center" }}>
                <Alert message="Failed to load" type="error" showIcon />
              </div>
            ) : (
              <Statistic
                title="Memory Usage"
                value={`${Math.round(memoryUsage.used)}/${Math.round(memoryUsage.total)}`}
                suffix="GB"
                prefix={<DatabaseOutlined />}
                valueStyle={{ color: "#13c2c2", textAlign: "center" }}
                style={{ textAlign: "center" }}
                loading={memoryUsage.loading}
              />
            )}
          </Card>
        </Col>

        {/* SSE Status */}
        <Col span={4}>
          <Card style={{ height: "100%" }}>
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
            />
          </Card>
        </Col>
      </Row>

      {/* Charts Section */}
      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} lg={8}>
          <StatusChart
            title="Workflow Status Distribution"
            data={workflowChartData}
            loading={workflowChartData.loading}
          />
        </Col>
        <Col xs={24} lg={8}>
          <StatusChart
            title="Job Status Distribution"
            data={jobChartData}
            loading={jobChartData.loading}
          />
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title="Tag Activity"
            loading={tagActivity.loading}
            style={{ height: "350px", width: "100%" }}
          >
            <BarChart
              data={tagActivity.data as [string, number][]}
              title="Tags"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} lg={8}>
          <Card
            title="Rule Activity"
            loading={ruleActivity.loading}
            style={{ height: "350px", width: "100%" }}
          >
            <BarChart
              data={ruleActivity.data as [string, number][]}
              title="Rules"
              renderTag={false}
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title="Rule Error"
            loading={ruleError.loading}
            style={{ height: "350px", width: "100%" }}
          >
            <StackedBarChart
              data={
                ruleError.data as {
                  name: string;
                  total: number;
                  error: number;
                }[]
              }
              title="Rules"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title="Rule Duration Distribution"
            loading={ruleDuration.loading}
            style={{
              height: "350px",
              width: "100%",
            }}
          >
            <BoxPlot
              data={
                ruleDuration.data as {
                  [key: string]: { [key: string]: number };
                }
              }
              title="Rule Duration"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
