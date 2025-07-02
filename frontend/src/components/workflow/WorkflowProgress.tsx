import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { Link } from "@tanstack/react-router";
import { Button, Card, Col, Progress, Row, Statistic } from "antd";
import React from "react";

import { useWorkflow, useWorkflowTotalJobs } from "../../hooks/useQueries";
import { useWorkflowProgressWithSSE } from "../../hooks/useQueriesWithSSE";

interface WorkflowProgressProps {
  workflowId: string;
}

const WorkflowProgress: React.FC<WorkflowProgressProps> = ({ workflowId }) => {
  const { data: progressData } = useWorkflowProgressWithSSE(workflowId);
  const { data: totalJobsData } = useWorkflowTotalJobs(workflowId);
  const { data: workflow } = useWorkflow(workflowId);

  const getProgressStatus = () => {
    if ((progressData?.failed ?? 0) > 0) return "exception";
    if ((progressData?.running ?? 0) > 0) return "active";
    if (
      ((progressData?.completed ?? 0) / (progressData?.total ?? 1)) * 100 ===
      100
    )
      return "success";
    return "normal";
  };

  return (
    <Card>
      <Row gutter={24} align="middle">
        <Col span={2}>
          <Link to="/">
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              size="large"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              Back
            </Button>
          </Link>
        </Col>
        <Col
          span={10}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            alignContent: "center",
            fontWeight: "bold",
            fontSize: "16px",
          }}
        >
          Workflow Progress - {workflow?.name || "Unnamed"}
          <Progress
            percent={progressData?.progress ?? 0}
            status={getProgressStatus()}
          />
        </Col>
        <Col span={4}>
          <Statistic
            title="Total Jobs"
            value={totalJobsData?.total}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: "#1890ff" }}
          />
        </Col>
        <Col span={4}>
          <Statistic
            title="Completed"
            value={progressData?.completed}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: "#52c41a" }}
          />
        </Col>
        <Col span={4}>
          <Statistic
            title="Running"
            value={progressData?.running}
            prefix={<SyncOutlined spin={(progressData?.running ?? 0) > 0} />}
            valueStyle={{ color: "#1890ff" }}
          />
        </Col>
      </Row>
    </Card>
  );
};

export default WorkflowProgress;
