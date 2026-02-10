import {
  postPruningMutation,
  useGetActivityQuery,
  useGetRuleDurationQuery,
  useGetRuleErrorQuery,
  useGetStatusQuery,
  useGetSystemHealthQuery,
  useGetSystemResourcesQuery,
} from '@/client/@tanstack/react-query.gen';
import {
  CloudServerOutlined,
  DatabaseOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  SyncOutlined,
  ToolOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  Col,
  Popconfirm,
  Progress,
  Row,
  Space,
  Statistic,
  message,
} from 'antd';
import React, { useMemo, useState } from 'react';

import { BarChart, BoxPlot, StackedBarChart, WordCloud } from './Chart';
import { StatusChart } from './StatusChart';

export const DashboardLayout: React.FC = () => {
  const [messageApi, contextHolder] = message.useMessage();
  const [isReloading, setIsReloading] = useState(false);
  // const databasePruning = useDatabasePruning();
  const runningWorkflows = useGetStatusQuery({ query: { item: 'workflow' } });
  const runningJobs = useGetStatusQuery({ query: { item: 'job' } });
  const tagActivity = useGetActivityQuery({ query: { item: 'tag' } });

  const ruleActivity = useGetActivityQuery({ query: { item: 'rule' } });
  const ruleError = useGetRuleErrorQuery({ query: { limit: 10 } });
  const ruleDuration = useGetRuleDurationQuery({ query: { limit: 10 } });

  const databasePruning = useMutation(postPruningMutation());
  const { data: systemResourcesData, error: systemResourcesError } =
    useGetSystemResourcesQuery();
  const { data: systemHealthData, isLoading: isSystemHealthLoading } =
    useGetSystemHealthQuery();

  const handleReload = async () => {
    setIsReloading(true);
    try {
      // Reload the entire page to refresh all data
      window.location.reload();
    } catch {
      message.error('Failed to reload dashboard');
      setIsReloading(false);
    }
  };

  const handleDatabasePruning = async () => {
    try {
      const data = await databasePruning.mutateAsync({});
      messageApi.open({
        type: 'success',
        content: `Database pruning completed successfully, delete ${data.workflow} workflows
        and update ${data.job} jobs status`,
      });
    } catch {
      messageApi.open({
        type: 'error',
        content: 'Database pruning failed',
      });
    }
  };

  const workflowChartData = useMemo(() => {
    return {
      success: runningWorkflows.data?.success || 0,
      running: runningWorkflows.data?.running || 0,
      error: runningWorkflows.data?.error || 0,
      total: runningWorkflows.data?.total || 0,
    };
  }, [runningWorkflows.data]);

  const jobChartData = useMemo(() => {
    return {
      success: runningJobs.data?.success || 0,
      running: runningJobs.data?.running || 0,
      error: runningJobs.data?.error || 0,
      total: runningJobs.data?.total || 0,
    };
  }, [runningJobs.data]);

  const tagActivityData = useMemo(() => {
    return Object.entries(tagActivity.data || {}).map(([name, value]) => ({
      name: name,
      value: value,
    }));
  }, [tagActivity.data]);

  const ruleActivityData = useMemo(() => {
    return Object.entries(ruleActivity.data || {}).map(([name, value]) => [
      name,
      value,
    ]);
  }, [ruleActivity.data]);

  return (
    <div style={{ padding: '12px', background: '#f5f5f5', minHeight: '90vh' }}>
      {contextHolder}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
        }}
      >
        <div
          style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}
        >
          <Space>
            <Button
              type="default"
              icon={<ReloadOutlined />}
              loading={isReloading}
              onClick={handleReload}
              style={{
                borderColor: '#1890ff',
                color: '#1890ff',
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
                  <p style={{ marginBottom: 8, fontSize: 13, color: '#666' }}>
                    The pruning will perform the following operations:
                  </p>
                  <ul
                    style={{
                      paddingLeft: 16,
                      margin: 0,
                      fontSize: 12,
                      color: '#666',
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
                  backgroundColor: '#ff4d4f',
                  borderColor: '#ff4d4f',
                }}
              >
                Database Pruning
              </Button>
            </Popconfirm>
          </Space>
        </div>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: '12px' }}>
        <Col span={4}>
          <Card style={{ height: '100%' }}>
            {runningWorkflows.error ? (
              <div style={{ textAlign: 'center' }}>
                <Alert message="Failed to load" type="error" showIcon />
              </div>
            ) : (
              <Statistic
                title="Running Workflows"
                value={runningWorkflows.data?.running}
                prefix={
                  runningWorkflows.data?.running &&
                  runningWorkflows.data?.running > 0 ? (
                    <SyncOutlined spin />
                  ) : (
                    <PlayCircleOutlined />
                  )
                }
                valueStyle={{ color: '#1890ff', textAlign: 'center' }}
                style={{ textAlign: 'center' }}
                loading={runningWorkflows.isLoading}
              />
            )}
          </Card>
        </Col>

        <Col span={4}>
          <Card style={{ height: '100%' }}>
            {runningJobs.error ? (
              <div style={{ textAlign: 'center' }}>
                <Alert message="Failed to load" type="error" showIcon />
              </div>
            ) : (
              <Statistic
                title="Running Jobs"
                value={runningJobs.data?.running}
                prefix={
                  runningJobs.data?.running && runningJobs.data?.running > 0 ? (
                    <SyncOutlined spin />
                  ) : (
                    <PlayCircleOutlined />
                  )
                }
                valueStyle={{ color: '#faad14', textAlign: 'center' }}
                style={{ textAlign: 'center' }}
                loading={runningJobs.isLoading}
              />
            )}
          </Card>
        </Col>

        <Col span={4}>
          <Card style={{ height: '100%' }}>
            {systemResourcesError ? (
              <div style={{ textAlign: 'center' }}>
                <Alert message="Failed to load" type="error" showIcon />
              </div>
            ) : (
              <div style={{ padding: '8px 8px', textAlign: 'center' }}>
                <div
                  style={{
                    marginBottom: '8px',
                    fontSize: '14px',
                    color: '#666',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <CloudServerOutlined
                      style={{ marginRight: '6px', color: '#722ed1' }}
                    />
                    CPU Usage
                  </div>
                  <span style={{ fontWeight: 'bold', color: '#722ed1' }}>
                    {Math.round(
                      (systemResourcesData?.cpu_total_cores || 0) -
                        (systemResourcesData?.cpu_idle_cores || 0),
                    )}
                    /{Math.round(systemResourcesData?.cpu_total_cores || 0)}{' '}
                    cores
                  </span>
                </div>
                <Progress
                  percent={Math.round(
                    (((systemResourcesData?.cpu_total_cores || 0) -
                      (systemResourcesData?.cpu_idle_cores || 0)) /
                      (systemResourcesData?.cpu_total_cores || 1)) *
                      100,
                  )}
                  strokeColor="#722ed1"
                  size="small"
                  showInfo={false}
                />
              </div>
            )}
          </Card>
        </Col>

        <Col span={4}>
          <Card style={{ height: '100%' }}>
            {systemResourcesError ? (
              <div style={{ textAlign: 'center' }}>
                <Alert message="Failed to load" type="error" showIcon />
              </div>
            ) : (
              <div style={{ padding: '8px 8px' }}>
                <div
                  style={{
                    marginBottom: '8px',
                    fontSize: '14px',
                    color: '#666',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <DatabaseOutlined
                      style={{ marginRight: '6px', color: '#13c2c2' }}
                    />
                    Memory Usage
                  </div>
                  <span style={{ fontWeight: 'bold', color: '#13c2c2' }}>
                    {Math.round(
                      (systemResourcesData?.mem_total_GB || 0) -
                        (systemResourcesData?.mem_available_GB || 0),
                    )}
                    /{Math.round(systemResourcesData?.mem_total_GB || 1)} GB
                  </span>
                </div>
                <Progress
                  percent={Math.round(
                    (((systemResourcesData?.mem_total_GB || 0) -
                      (systemResourcesData?.mem_available_GB || 0)) /
                      (systemResourcesData?.mem_total_GB || 1)) *
                      100,
                  )}
                  strokeColor="#13c2c2"
                  size="small"
                  showInfo={false}
                />
              </div>
            )}
          </Card>
        </Col>

        <Col span={4}>
          <Card style={{ height: '100%' }}>
            <Statistic
              title="Database"
              value={
                isSystemHealthLoading
                  ? 'Wait...'
                  : systemHealthData?.database.status === 'healthy'
                    ? 'Healthy'
                    : systemHealthData?.database.status === 'unhealthy'
                      ? 'Error'
                      : 'Unknown'
              }
              prefix={
                <DatabaseOutlined
                  style={{
                    color: isSystemHealthLoading
                      ? '#d9d9d9'
                      : systemHealthData?.database.status === 'healthy'
                        ? '#52c41a'
                        : systemHealthData?.database.status === 'unhealthy'
                          ? '#ff4d4f'
                          : '#faad14',
                  }}
                />
              }
              valueStyle={{
                color: isSystemHealthLoading
                  ? '#d9d9d9'
                  : systemHealthData?.database.status === 'healthy'
                    ? '#52c41a'
                    : systemHealthData?.database.status === 'unhealthy'
                      ? '#ff4d4f'
                      : '#faad14',
                textAlign: 'center',
              }}
              style={{ textAlign: 'center' }}
            />
          </Card>
        </Col>

        <Col span={4}>
          <Card style={{ height: '100%' }}>
            <Statistic
              title="SSE Status"
              value={
                isSystemHealthLoading
                  ? 'Loading...'
                  : systemHealthData?.sse.status === 'healthy'
                    ? 'Healthy'
                    : systemHealthData?.sse.status === 'unhealthy'
                      ? 'Error'
                      : 'Unknown'
              }
              prefix={
                <WifiOutlined
                  style={{
                    color: isSystemHealthLoading
                      ? '#d9d9d9'
                      : systemHealthData?.sse.status === 'healthy'
                        ? '#52c41a'
                        : systemHealthData?.sse.status === 'unhealthy'
                          ? '#ff4d4f'
                          : '#faad14',
                  }}
                />
              }
              valueStyle={{
                color: isSystemHealthLoading
                  ? '#d9d9d9'
                  : systemHealthData?.sse.status === 'healthy'
                    ? '#52c41a'
                    : systemHealthData?.sse.status === 'unhealthy'
                      ? '#ff4d4f'
                      : '#faad14',
                textAlign: 'center',
              }}
              style={{ textAlign: 'center' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={8}>
          <StatusChart
            title="Workflow Status Distribution"
            data={workflowChartData}
            loading={runningWorkflows.isLoading}
          />
        </Col>
        <Col xs={24} lg={8}>
          <StatusChart
            title="Job Status Distribution"
            data={jobChartData}
            loading={runningJobs.isLoading}
          />
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title="Tag Activity"
            loading={tagActivity.isLoading}
            style={{ height: '350px', width: '100%' }}
          >
            <WordCloud data={tagActivityData} title="Tags" />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} lg={8}>
          <Card
            title="Rule Activity (10 most active rules)"
            loading={ruleActivity.isLoading}
            style={{ height: '350px', width: '100%' }}
          >
            <BarChart
              data={ruleActivityData as [string, number][]}
              title="Rules"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title="Rule Error"
            loading={ruleError.isLoading}
            style={{ height: '350px', width: '100%' }}
          >
            <StackedBarChart
              data={Object.entries(ruleError.data || {}).map(
                ([name, value]) => ({
                  name: name,
                  total: value.total as number,
                  error: value.error as number,
                }),
              )}
              title="Rules"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card
            title="Rule Duration Distribution"
            loading={ruleDuration.isLoading}
            style={{
              height: '350px',
              width: '100%',
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
