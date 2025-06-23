import { EyeOutlined, ReloadOutlined } from "@ant-design/icons";
import { Link } from "@tanstack/react-router";
import { Button, Card, Table, Tag, Space, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import React from "react";

import type { Status } from "../../api/api";
import type { WorkflowResponse } from "../../api/client";
import { useWorkflowsWithSSE } from "../../hooks/useQueriesWithSSE";
import {
  formatDateCompact,
  formatDuration,
  getStatusColor,
} from "../../utils/formatters";

const { Text } = Typography;

export const RecentWorkflows: React.FC = () => {
  const {
    data: workflowsData,
    isLoading,
    error,
    refetch,
  } = useWorkflowsWithSSE({
    limit: 10,
    offset: 0,
    orderByStarted: true,
    descending: true,
  });

  const workflows = workflowsData?.workflows || [];

  const columns: ColumnsType<WorkflowResponse> = [
    {
      title: "Workflow ID",
      dataIndex: "id",
      key: "id",
      width: 120,
      render: (id: string) => (
        <Link
          to="/workflow/$workflowId"
          params={{ workflowId: id }}
          style={{ fontFamily: "monospace", fontSize: "12px" }}
        >
          {id.substring(0, 8)}...
        </Link>
      ),
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 150,
      render: (name: string | null, record: WorkflowResponse) => (
        <div>
          <div style={{ fontWeight: "500", marginBottom: "2px" }}>
            {name || `Workflow ${record.id.substring(0, 8)}`}
          </div>
          {record.user && (
            <Text type="secondary" style={{ fontSize: "11px" }}>
              by {record.user}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: Status) => (
        <Tag
          color={getStatusColor(status)}
          style={{ textTransform: "uppercase", fontSize: "11px" }}
        >
          {status}
        </Tag>
      ),
    },
    {
      title: "Started",
      dataIndex: "started_at",
      key: "started_at",
      width: 120,
      render: (startedAt: string | null) => (
        <Text style={{ fontSize: "12px" }}>{formatDateCompact(startedAt)}</Text>
      ),
    },
    {
      title: "Duration",
      key: "duration",
      width: 100,
      render: (_, record) => {
        if (record.end_time && record.started_at) {
          let endTime = record.end_time;
          if (record.status === "RUNNING") {
            endTime = new Date().toISOString();
          }
          const duration =
            new Date(endTime).getTime() - new Date(record.started_at).getTime();
          return (
            <Text style={{ fontSize: "12px" }}>{formatDuration(duration)}</Text>
          );
        }
        return (
          <Text type="secondary" style={{ fontSize: "12px" }}>
            -
          </Text>
        );
      },
    },
    {
      title: "Tags",
      dataIndex: "tags",
      key: "tags",
      width: 150,
      render: (tags: string[] | null) => {
        if (!tags || tags.length === 0) return null;

        const displayTags = tags.slice(0, 2);
        const extraCount = tags.length - displayTags.length;

        return (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "2px" }}>
            {displayTags.map((tag, index) => (
              <Tag
                key={index}
                size="small"
                style={{ fontSize: "10px", margin: 0 }}
              >
                {tag}
              </Tag>
            ))}
            {extraCount > 0 && (
              <Tag
                size="small"
                style={{ fontSize: "10px", margin: 0, fontStyle: "italic" }}
              >
                +{extraCount}
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: "Action",
      key: "action",
      width: 80,
      render: (_, record) => (
        <Link to="/workflow/$workflowId" params={{ workflowId: record.id }}>
          <Button
            type="text"
            size="small"
            icon={<EyeOutlined />}
            title="View Details"
          />
        </Link>
      ),
    },
  ];

  return (
    <Card
      title="Recent Workflows"
      extra={
        <Button
          type="text"
          size="small"
          icon={<ReloadOutlined />}
          onClick={() => refetch()}
          loading={isLoading}
        >
          Refresh
        </Button>
      }
      style={{ height: "500px" }}
    >
      <div style={{ height: "420px" }}>
        <Table
          columns={columns}
          dataSource={workflows}
          rowKey="id"
          loading={isLoading}
          pagination={false}
          size="small"
          scroll={{ y: 380 }}
          showSorterTooltip={false}
        />

        {error && (
          <div
            style={{
              color: "#ff4d4f",
              backgroundColor: "#fff2f0",
              border: "1px solid #ffccc7",
              borderRadius: "4px",
              padding: "8px 12px",
              marginTop: "8px",
              fontSize: "12px",
            }}
          >
            Error loading workflows:{" "}
            {error instanceof Error ? error.message : "Unknown error"}
          </div>
        )}

        {!isLoading && workflows.length === 0 && !error && (
          <div
            style={{
              textAlign: "center",
              padding: "40px",
              color: "#666",
            }}
          >
            No workflows found
          </div>
        )}
      </div>
    </Card>
  );
};
