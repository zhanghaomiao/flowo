import {
  FileTextOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { Alert, Button, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import React, { useState } from "react";

import type { Status } from "../../api/api";
import type { JobResponse } from "../../api/client";
import { useWorkflowJobs } from "../../hooks/useQueries";
import { useJobDetail, useJobLogs } from "../../hooks/useQueries";
import { useWorkflowJobsWithSSE } from "../../hooks/useQueriesWithSSE";
import {
  formatDateCompact,
  formatDuration,
  getStatusColor,
} from "../../utils/formatters";
import FilesViewer from "../code/FilesViewer";
import FileViewer from "../code/FileViewer";
import LiveUpdatesIndicator from "../LiveUpdatesIndicator";

interface JobTableProps {
  workflowId?: string;
  workflowStatus?: Status;
  ruleName?: string | null;
  showRefreshButton?: boolean;
}

const JobTable: React.FC<JobTableProps> = ({
  workflowId,
  workflowStatus,
  ruleName,
  showRefreshButton = true,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<Status | null>(null);
  const [jobDetailModal, setJobDetailModal] = useState<{
    visible: boolean;
    jobId: number;
  }>({
    visible: false,
    jobId: 0,
  });
  const [jobLogsModal, setJobLogsModal] = useState<{
    visible: boolean;
    jobId: number;
  }>({
    visible: false,
    jobId: 0,
  });

  const offset = (currentPage - 1) * pageSize;

  const needsSSE = workflowStatus === "RUNNING";

  const sseResult = useWorkflowJobsWithSSE({
    workflowId: workflowId!,
    limit: pageSize,
    offset: offset,
    status: status,
    ruleName: ruleName,
    orderByStarted: true,
    descending: true,
  });

  const staticResult = useWorkflowJobs(
    workflowId!,
    pageSize,
    offset,
    true,
    true,
    ruleName,
    status,
    !needsSSE, // Only enable when not using SSE
  );

  // Conditionally select which result to use
  const result = needsSSE ? sseResult : staticResult;

  const { data: jobDetailData } = useJobDetail(
    jobDetailModal.jobId,
    jobDetailModal.visible,
  );
  const { data: jobLogsData } = useJobLogs(
    jobLogsModal.jobId,
    jobLogsModal.visible,
  );

  const { data: jobs, isLoading, error, refetch } = result;

  const { sseStatus, isSSEConnected, sseError, sseRetryCount, reconnectSSE } =
    needsSSE
      ? sseResult
      : {
        sseStatus: "disconnected" as const,
        isSSEConnected: false,
        sseError: null,
        sseRetryCount: 0,
        reconnectSSE: () => { },
      };

  const columns: ColumnsType<JobResponse> = [
    {
      title: "Rule name",
      dataIndex: "rule_name",
      key: "rule_name",
      width: 100,
      render: (ruleName: string) => (
        <code style={{ fontSize: "14px", fontWeight: "bold" }}>{ruleName}</code>
      ),
      sorter: (a, b) => (a.rule_id ?? 0) - (b.rule_id ?? 0),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: Status) => (
        <Tag
          color={getStatusColor(status)}
          style={{ textTransform: "uppercase" }}
        >
          {status}
        </Tag>
      ),
      filters: [
        { text: "Success", value: "SUCCESS" },
        { text: "Running", value: "RUNNING" },
        { text: "Error", value: "ERROR" },
        { text: "Waiting", value: "WAITING" },
      ],
      filteredValue: status ? [status] : null,
      onFilter: (value, record) => record.status === value,
    },
    {
      title: "Started At",
      dataIndex: "started_at",
      key: "started_at",
      width: 140,
      render: (startedAt: string | null) => formatDateCompact(startedAt),
      sorter: (a, b) => {
        const dateA = a.started_at ? new Date(a.started_at).getTime() : 0;
        const dateB = b.started_at ? new Date(b.started_at).getTime() : 0;
        return dateA - dateB;
      },
    },
    {
      title: "End Time",
      dataIndex: "end_time",
      key: "end_time",
      width: 140,
      render: (endTime: string | null) => formatDateCompact(endTime),
      sorter: (a, b) => {
        const dateA = a.end_time ? new Date(a.end_time).getTime() : 0;
        const dateB = b.end_time ? new Date(b.end_time).getTime() : 0;
        return dateA - dateB;
      },
    },
    {
      title: "Duration (min:sec)",
      dataIndex: "duration",
      key: "duration",
      width: 40,
      render: (_, record) => {
        if (record.end_time && record.started_at) {
          let endTime = record.end_time;
          if (record.status === "running") {
            endTime = new Date().toISOString();
          }
          const duration =
            new Date(endTime).getTime() - new Date(record.started_at).getTime();
          return formatDuration(duration);
        }
        return "-";
      },
    },
    {
      title: "Threads",
      dataIndex: "threads",
      key: "threads",
      width: 30,
      render: (threads: number | null) => threads ?? "-",
      sorter: (a, b) => (a.threads ?? 0) - (b.threads ?? 0),
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      width: 30,
      render: (priority: number | null) => priority ?? "-",
      sorter: (a, b) => (a.priority ?? 0) - (b.priority ?? 0),
    },
    {
      title: "Wildcards",
      dataIndex: "wildcards",
      width: 150,
      render: (wildcards: string | null) => {
        if (!wildcards) return "-";

        try {
          const wildcardsObj =
            typeof wildcards === "string" ? JSON.parse(wildcards) : wildcards;
          const entries = Object.entries(wildcardsObj);

          if (entries.length === 0) return "-";

          // Show first 2 key-value pairs as tags, rest in tooltip
          const visibleEntries = entries.slice(0, 3);
          const hiddenEntries = entries.slice(3);

          const tooltipContent =
            entries.length > 3 ? (
              <div style={{ maxWidth: "300px" }}>
                <div style={{ marginBottom: "8px", fontWeight: "bold" }}>
                  All Wildcards:
                </div>
                {entries.map(([key, value]) => (
                  <div
                    key={key}
                    style={{
                      marginBottom: "4px",
                      padding: "2px 6px",
                      backgroundColor: "rgba(255,255,255,0.1)",
                      borderRadius: "3px",
                      fontSize: "12px",
                    }}
                  >
                    <strong>{key}:</strong> {String(value)}
                  </div>
                ))}
              </div>
            ) : null;

          return (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "2px" }}
            >
              {visibleEntries.map(([key, value]) => (
                <Tag
                  key={key}
                  color="blue"
                  style={{
                    margin: 0,
                    fontSize: "11px",
                    maxWidth: "180px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={`${key}: ${value}`}
                >
                  <strong>{key}:</strong> {String(value)}
                </Tag>
              ))}
              {hiddenEntries.length > 0 && (
                <Tooltip title={tooltipContent} placement="topLeft">
                  <Tag
                    color="default"
                    style={{
                      margin: 0,
                      fontSize: "11px",
                      cursor: "pointer",
                      border: "1px dashed #d9d9d9",
                    }}
                  >
                    +{hiddenEntries.length} more...
                  </Tag>
                </Tooltip>
              )}
            </div>
          );
        } catch {
          return (
            <Tooltip title={wildcards} placement="topLeft">
              <Tag
                color="orange"
                style={{ fontSize: "11px", cursor: "pointer" }}
              >
                {wildcards.length > 15
                  ? wildcards.substring(0, 15) + "..."
                  : wildcards}
              </Tag>
            </Tooltip>
          );
        }
      },
    },
    {
      title: "Files",
      key: "files",
      width: 100,
      align: "center",
      render: (_, record) => {
        return (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "100%",
              height: "100%",
            }}
          >
            <Tooltip title="View Job Details">
              <Button
                type="text"
                icon={<InfoCircleOutlined />}
                size="small"
                onClick={() => {
                  setJobDetailModal({ visible: true, jobId: record.id! });
                }}
              />
            </Tooltip>
            <Tooltip title="View Job Logs">
              <Button
                type="text"
                icon={<FileTextOutlined />}
                size="small"
                onClick={() => {
                  setJobLogsModal({ visible: true, jobId: record.id! });
                }}
              />
            </Tooltip>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "10px 0",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {needsSSE ? (
            <LiveUpdatesIndicator
              isConnected={isSSEConnected}
              retryCount={sseRetryCount}
              onReconnect={reconnectSSE}
              showReconnectButton={false}
            />
          ) : (
            <div
              style={{
                fontSize: "12px",
                color: "#666",
                display: "flex",
                alignItems: "center",
              }}
            >
              <span>📊</span>
              <span>Static Data (Workflow {workflowStatus || "Unknown"})</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center" }}>
          {needsSSE && !isSSEConnected && (
            <Button
              size="small"
              type="link"
              onClick={reconnectSSE}
              style={{ padding: "4px 8px", fontSize: "12px" }}
            >
              Reconnect SSE
            </Button>
          )}
          {showRefreshButton && (
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isLoading}
            >
              Refresh
            </Button>
          )}
        </div>
      </div>

      {needsSSE && sseError && sseStatus === "error" && (
        <Alert
          message="Live Updates Connection Issue"
          description={`Unable to connect to live updates: ${sseError}`}
          type="warning"
          style={{ marginBottom: "16px" }}
          showIcon
          action={
            <Button size="small" onClick={reconnectSSE}>
              Retry Connection
            </Button>
          }
          closable
        />
      )}

      {error && (
        <div
          style={{
            color: "#ff4d4f",
            backgroundColor: "#fff2f0",
            border: "1px solid #ffccc7",
            borderRadius: "6px",
            padding: "8px 12px",
            marginBottom: "16px",
          }}
        >
          Error loading jobs:{" "}
          {error instanceof Error ? error.message : "Unknown error"}
        </div>
      )}

      <Table
        columns={columns}
        dataSource={jobs?.jobs ?? []}
        rowKey={(record, index) => {
          // Create a unique key using multiple fields to avoid duplicates
          const id = record.id ?? "no-id";
          const ruleId = record.rule_id ?? "no-rule-id";
          const workflowId = record.workflow_id ?? "no-workflow";
          return `${workflowId}-${ruleId}-${id}-${index}`;
        }}
        loading={isLoading}
        onChange={(_, filters) => {
          if (filters.status !== undefined) {
            const statusFilter = filters.status;
            setStatus(
              statusFilter && statusFilter.length > 0
                ? (statusFilter[0] as Status)
                : null,
            );
          }
        }}
        pagination={{
          current: currentPage,
          total: jobs?.total,
          pageSize: pageSize,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total} jobs`,
          pageSizeOptions: ["10", "20", "50", "100"],
          position: ["bottomCenter"],
          onChange: (page, size) => {
            setCurrentPage(page);
            if (size !== pageSize) {
              setPageSize(size);
              setCurrentPage(1); // Reset to first page when page size changes
            }
          },
          onShowSizeChange: (_, size) => {
            setPageSize(size);
            setCurrentPage(1); // Reset to first page when page size changes
          },
        }}
        size="small"
        bordered
        style={{ backgroundColor: "white" }}
      />

      <FileViewer
        key={`jobDetail`}
        title={`Detail -  Job ${jobDetailModal.jobId}`}
        visible={jobDetailModal.visible}
        onClose={() => setJobDetailModal({ visible: false, jobId: 0 })}
        fileContent={JSON.stringify(jobDetailData, null, 2)}
      />

      <FilesViewer
        visible={jobLogsModal.visible}
        onClose={() => setJobLogsModal({ visible: false, jobId: 0 })}
        fileContent={jobLogsData ?? {}}
        jobId={jobLogsModal.jobId}
      />
    </div>
  );
};

export default JobTable;
