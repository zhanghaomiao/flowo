import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { Card, Col, Progress, Row, Statistic } from "antd";
import React from "react";

import { useWorkflowTotalJobs } from "../../hooks/useQueries";
import { useWorkflowProgressWithSSE } from "../../hooks/useQueriesWithSSE";

interface WorkflowProgressProps {
  workflowId: string;
}

const WorkflowProgress: React.FC<WorkflowProgressProps> = ({ workflowId }) => {
  const { data: progressData } = useWorkflowProgressWithSSE(workflowId);
  const { data: totalJobsData } = useWorkflowTotalJobs(workflowId);

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
      <Row gutter={2}>
        <Col
          span={12}
          style={{
            alignItems: "center",
            alignContent: "center",
            fontWeight: "bold",
            fontSize: "16px",
          }}
        >
          Workflow Progress - {workflowId}
          <Progress
            percent={parseFloat(
              (
                ((progressData?.completed ?? 0) / (progressData?.total ?? 1)) *
                100
              ).toFixed(1),
            )}
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
