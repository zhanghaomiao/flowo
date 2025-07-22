import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
} from "@ant-design/icons";
import { Link } from "@tanstack/react-router";
import { Button, Card, Col, Progress, Row, Statistic } from "antd";
import React from "react";

import {
  useWorkflowDetail,
  useWorkflowTotalJobs,
} from "../../hooks/useQueries";
import { useWorkflowProgressWithSSE } from "../../hooks/useQueriesWithSSE";
import WorkflowTag from "../tag/WorkflowTag";

interface WorkflowProgressProps {
  workflowId: string;
}

const WorkflowProgress: React.FC<WorkflowProgressProps> = ({ workflowId }) => {
  const { data: progressData } = useWorkflowProgressWithSSE(workflowId);
  const { data: totalJobsData } = useWorkflowTotalJobs(workflowId);
  // const { data: workflow } = useWorkflow(workflowId);
  const { data: workflow } = useWorkflowDetail(workflowId);

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
            fontSize: "14px",
          }}
        >
          {workflow?.name || workflow?.directory}
          {workflow?.tags && workflow.tags.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: "2px",
              }}
            >
              {workflow.tags.map((tag, index) => (
                <WorkflowTag
                  key={index}
                  tag={tag}
                  style={{
                    fontSize: "10px",
                    marginInlineEnd: 2,
                    lineHeight: "16px",
                    height: "18px",
                  }}
                />
              ))}
            </div>
          )}
        </Col>
        <Col span={3}>
          <div style={{ textAlign: "left" }}>
            <div
              style={{
                color: "rgba(0, 0, 0, 0.45)",
                fontSize: "14px",
                marginBottom: "4px",
                fontWeight: "normal",
              }}
            >
              Progress
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Progress
                percent={progressData?.progress ?? 0}
                status={getProgressStatus()}
                type="circle"
                size={25}
                showInfo={false}
              />
              <span
                style={{
                  fontSize: "16px",
                  fontWeight: "600",
                  color:
                    getProgressStatus() === "exception"
                      ? "#ff4d4f"
                      : getProgressStatus() === "success"
                        ? "#52c41a"
                        : getProgressStatus() === "active"
                          ? "#1890ff"
                          : "#8c8c8c",
                }}
              >
                {(progressData?.progress ?? 0).toFixed(0)}%
              </span>
            </div>
          </div>
        </Col>
        <Col span={3}>
          <Statistic
            title="Total Jobs"
            value={totalJobsData?.total}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: "#1890ff" }}
          />
        </Col>
        <Col span={3}>
          <Statistic
            title="Completed"
            value={progressData?.completed}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: "#52c41a" }}
          />
        </Col>
        <Col span={3}>
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
