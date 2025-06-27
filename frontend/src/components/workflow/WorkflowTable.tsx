import {
  DeleteOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  LinkOutlined,
  SettingOutlined,
} from "@ant-design/icons";
import Icon from "@ant-design/icons";
import { Link } from "@tanstack/react-router";
import {
  Button,
  message,
  Popconfirm,
  Progress,
  Space,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useCallback, useMemo, useState } from "react";

import type { Status } from "../../api/api";
import type { WorkflowResponse } from "../../api/client";
import SnakemakeIcon from "../../assets/snakemake.svg?react";
import {
  useDeleteWorkflow,
  useWorkflowConfig,
  useWorkflowDetail,
  useWorkflowLogs,
  useWorkflowSnakefile,
  useWorkFlowUsers,
} from "../../hooks/useQueries";
import { useWorkflowsWithSSE } from "../../hooks/useQueriesWithSSE";
import {
  formatDateCompact,
  getStatusColor,
  getWorkflowProgressStatus,
} from "../../utils/formatters";
import FilesViewer from "../code/FilesViewer";
import FileViewer from "../code/FileViewer";
import { DurationCell } from "../common/common";
import LiveUpdatesIndicator from "../LiveUpdatesIndicator";
import WorkflowTag from "../tag/WorkflowTag";
import WorkflowSearch from "./WorkflowSearch";

const WorkflowTable = () => {
  const deleteWorkflowMutation = useDeleteWorkflow();
  const [snakefileModal, setSnakefileModal] = useState<{
    visible: boolean;
    workflowId: string;
  }>({
    visible: false,
    workflowId: "",
  });

  const [configModal, setConfigModal] = useState<{
    visible: boolean;
    workflowId: string;
  }>({
    visible: false,
    workflowId: "",
  });

  const [logModal, setLogModal] = useState<{
    visible: boolean;
    workflowId: string;
    workflowStatus: Status;
  }>({
    visible: false,
    workflowId: "",
    workflowStatus: "SUCCESS",
  });

  const [workflowDetailModal, setWorkflowDetailModal] = useState<{
    visible: boolean;
    workflowId: string;
  }>({
    visible: false,
    workflowId: "",
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [user, setUser] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [messageApi, contextHolder] = message.useMessage();

  // Search state
  const [searchTags, setSearchTags] = useState<string | null>(null);
  const [searchName, setSearchName] = useState<string | null>(null);
  const [searchStartAt, setSearchStartAt] = useState<string | null>(null);
  const [searchEndAt, setSearchEndAt] = useState<string | null>(null);

  const { data: snakefileData } = useWorkflowSnakefile(
    snakefileModal.workflowId,
    snakefileModal.visible && !!snakefileModal.workflowId,
  );

  const { data: configData } = useWorkflowConfig(
    configModal.workflowId,
    configModal.visible && !!configModal.workflowId,
  );

  const { data: usersData } = useWorkFlowUsers();

  const { data: logData } = useWorkflowLogs(
    logModal.workflowId,
    logModal.visible && !!logModal.workflowId,
  );

  const { data: workflowDetailData } = useWorkflowDetail(
    workflowDetailModal.workflowId,
    workflowDetailModal.visible && !!workflowDetailModal.workflowId,
  );

  const queryParams = useMemo(() => {
    const offset = (currentPage - 1) * pageSize;
    return {
      limit: pageSize,
      offset,
      orderByStarted: true,
      descending: true,
      user,
      status,
      tags: searchTags,
      name: searchName,
      startAt: searchStartAt,
      endAt: searchEndAt,
    };
  }, [
    pageSize,
    currentPage,
    user,
    status,
    searchTags,
    searchName,
    searchStartAt,
    searchEndAt,
  ]);

  const {
    data: workflowsData,
    isLoading,
    sseError,
    isSSEConnected,
  } = useWorkflowsWithSSE(queryParams);

  const workflows = workflowsData?.workflows ?? [];

  // Handle workflow deletion
  const handleDeleteWorkflow = async (workflowId: string) => {
    try {
      await deleteWorkflowMutation.mutateAsync(workflowId);
      messageApi.open({
        type: "success",
        content: `Workflow ${workflowId} deleted successfully!`,
      });
    } catch (error) {
      console.error("Failed to delete workflow:", error);
      messageApi.open({
        type: "error",
        content: `Failed to delete workflow ${workflowId}. Please try again.`,
      });
    }
  };

  // Handle showing Snakefile
  const handleShowSnakefile = (workflowId: string) => {
    setSnakefileModal({
      visible: true,
      workflowId,
    });
  };

  // Handle showing logs
  const handleShowLogs = (workflowId: string, workflowStatus: Status) => {
    setLogModal({
      visible: true,
      workflowId,
      workflowStatus,
    });
  };

  const handleShowConfig = (workflowId: string) => {
    setConfigModal({
      visible: true,
      workflowId,
    });
  };

  // Search handlers - use useCallback to prevent unnecessary re-renders
  const handleTagsSearch = useCallback((tags: string | null) => {
    setSearchTags(tags);
    setCurrentPage(1);
  }, []);

  const handleNameSearch = useCallback((name: string | null) => {
    setSearchName(name);
    setCurrentPage(1);
  }, []);

  const handleDateRangeSearch = useCallback(
    (startAt: string | null, endAt: string | null) => {
      setSearchStartAt(startAt);
      setSearchEndAt(endAt);
      setCurrentPage(1);
    },
    [],
  );

  const columns: ColumnsType<WorkflowResponse> = [
    {
      title: "Workflow ID",
      dataIndex: "id",
      key: "id",
      width: 120,
      fixed: "left",
      render: (id: string) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Link
            to="/workflow/$workflowId"
            params={{ workflowId: id }}
            style={{
              color: "#1890ff",
              textDecoration: "none",
              fontSize: "12px",
              fontFamily: "monospace",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <LinkOutlined style={{ fontSize: "10px" }} />
            <code style={{ fontSize: "12px", color: "inherit" }}>{id}</code>
          </Link>
        </div>
      ),
    },
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      width: 140,
      sorter: (a, b) => {
        const nameA = a.name || "";
        const nameB = b.name || "";
        return nameA.localeCompare(nameB);
      },
      render: (name: string | null, record: WorkflowResponse) => {
        const tags = record.tags || [];
        const displayTags = tags.slice(0, 3);
        const extraTagsCount = tags.length - 3;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {/* Name on first row */}
            <div
              style={{
                fontWeight: 600,
                fontSize: "15px",
                color: "#1f2937",
                lineHeight: "1.3",
                letterSpacing: "-0.01em",
              }}
            >
              {name || "Unnamed"} ({record.total_jobs})
            </div>

            {tags.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  alignItems: "center",
                }}
              >
                {displayTags.map((tag, index) => (
                  <WorkflowTag
                    key={index}
                    tag={tag}
                    style={{
                      fontSize: "11px",
                      marginInlineEnd: 2,
                    }}
                    onClick={handleTagsSearch}
                  />
                ))}

                {/* Show additional tags count with tooltip */}
                {extraTagsCount > 0 && (
                  <Tooltip
                    title={
                      <div>
                        <div
                          style={{ marginBottom: "4px", fontWeight: "bold" }}
                        >
                          All Tags ({tags.length}):
                        </div>
                        {tags.map((tag, index) => (
                          <WorkflowTag
                            key={index}
                            tag={tag}
                            style={{ margin: "2px", fontSize: "11px" }}
                            onClick={handleTagsSearch}
                          />
                        ))}
                      </div>
                    }
                  >
                    <Tag
                      color="default"
                      style={{
                        margin: 0,
                        fontSize: "11px",
                        lineHeight: "16px",
                        height: "18px",
                        display: "flex",
                        alignItems: "center",
                        cursor: "pointer",
                        borderStyle: "dashed",
                        padding: "0 6px",
                      }}
                    >
                      +{extraTagsCount} more
                    </Tag>
                  </Tooltip>
                )}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: "User",
      dataIndex: "user",
      key: "user",
      width: 60,
      filters: usersData?.map((user) => ({ text: user!, value: user! })) ?? [],
      filteredValue: user ? [user] : null,
      onFilter: (value, record) => record.user === value,
      sorter: (a, b) => {
        const userA = a.user || "";
        const userB = b.user || "";
        return userA.localeCompare(userB);
      },
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 60,
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
      title: "Started time",
      dataIndex: "started_at",
      key: "started_at",
      width: 100,
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
      width: 100,
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
      width: 60,
      render: (_, record) => <DurationCell record={record} />,
    },
    {
      title: "Progress",
      key: "progress",
      width: 40,
      render: (_, record) => {
        // const percent = getWorkflowProgressPercent(record.status as Status)
        const progressStatus = getWorkflowProgressStatus(
          record.status as Status,
        );
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
            <Progress
              type="circle"
              percent={record.progress ?? 0}
              status={progressStatus}
              size={30}
            />
          </div>
        );
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
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
            <Space size="small">
              <Tooltip title="View Snakefile">
                <Button
                  type="text"
                  icon={
                    <Icon component={SnakemakeIcon} style={{ fontSize: 20 }} />
                  }
                  size="small"
                  onClick={() => handleShowSnakefile(record.id)}
                  style={{
                    color: "#1890ff",
                    padding: "2px",
                  }}
                />
              </Tooltip>

              {/* Config files button */}
              {record.configfiles && (
                <Tooltip title="View Config Files">
                  <Button
                    type="text"
                    icon={<SettingOutlined style={{ fontSize: 20 }} />}
                    size="small"
                    onClick={() => handleShowConfig(record.id)}
                    style={{
                      color: "#52c41a",
                      padding: "2px",
                    }}
                  />
                </Tooltip>
              )}

              {/* Log file button */}
              {record.started_at && (
                <Tooltip title="View Workflow Logs">
                  <Button
                    type="text"
                    icon={<FileTextOutlined style={{ fontSize: 20 }} />}
                    size="small"
                    onClick={() =>
                      handleShowLogs(record.id, record.status as Status)
                    }
                    style={{
                      color: "#fa8c16",
                      padding: "2px",
                    }}
                  />
                </Tooltip>
              )}

              {/* Workflow detail button */}
              <Tooltip title="View Workflow Detail">
                <Button
                  type="text"
                  icon={<InfoCircleOutlined style={{ fontSize: 20 }} />}
                  size="small"
                  onClick={() =>
                    setWorkflowDetailModal({
                      visible: true,
                      workflowId: record.id,
                    })
                  }
                  style={{
                    color: "#1890ff",
                    padding: "2px",
                  }}
                />
              </Tooltip>

              {/* Delete button */}
              <Popconfirm
                title="Delete Workflow"
                description={`Are you sure you want to delete workflow: ${record.id}?`}
                onConfirm={() => handleDeleteWorkflow(record.id)}
                okText="Yes"
                cancelText="No"
                okButtonProps={{
                  danger: true,
                  loading: deleteWorkflowMutation.isPending,
                }}
                placement="topLeft"
                disabled={deleteWorkflowMutation.isPending}
              >
                <Button
                  type="text"
                  icon={<DeleteOutlined style={{ fontSize: 20 }} />}
                  size="small"
                  danger
                  style={{ padding: "2px" }}
                />
              </Popconfirm>
            </Space>
          </div>
        );
      },
    },
  ];

  return (
    <div>
      {contextHolder}
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <h3 style={{ margin: 0 }}>
            Workflows ({workflowsData?.total ?? 0} total, showing{" "}
            {workflows.length})
          </h3>
          <LiveUpdatesIndicator
            isConnected={isSSEConnected}
            retryCount={0}
            showReconnectButton={false}
          />
          <WorkflowSearch
            onTagsChange={handleTagsSearch}
            onNameChange={handleNameSearch}
            onDateRangeChange={handleDateRangeSearch}
            tags={searchTags}
            name={searchName}
          />
        </div>
      </div>

      {sseError && (
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
          SSE Connection Error: {sseError}
        </div>
      )}

      <Table
        columns={columns}
        dataSource={workflows}
        rowKey="id"
        loading={isLoading}
        onChange={(pagination, filters) => {
          if (filters.user !== undefined) {
            const userFilter = filters.user;
            setUser(
              userFilter && userFilter.length > 0
                ? (userFilter[0] as string)
                : null,
            );
          }
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
          total: workflowsData?.total ?? 0,
          pageSize: pageSize,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}`,
          pageSizeOptions: ["10", "20", "50", "100"],
          position: ["bottomCenter"],
          onChange: (page, size) => {
            setCurrentPage(page);
            if (size !== pageSize) {
              setPageSize(size);
              setCurrentPage(1); // Reset to first page when page size changes
            }
          },
          onShowSizeChange: (current, size) => {
            setPageSize(size);
            setCurrentPage(1); // Reset to first page when page size changes
          },
        }}
        scroll={{ x: 1200 }}
        size="small"
        bordered
        style={{ backgroundColor: "white" }}
        onRow={() => ({
          style: { cursor: "pointer" },
        })}
      />
      <FileViewer
        key={`snakefile-${snakefileModal.workflowId}`}
        title={`Snakefile - Workflow ${snakefileModal.workflowId}`}
        visible={snakefileModal.visible}
        onClose={() => setSnakefileModal({ visible: false, workflowId: "" })}
        fileContent={snakefileData || ""}
        fileFormat="yaml"
      />
      <FilesViewer
        key={`config-${configModal.workflowId}`}
        visible={configModal.visible}
        onClose={() => setConfigModal({ visible: false, workflowId: "" })}
        fileContent={Object.fromEntries(
          Object.entries(configData || {}).map(([key, value]) => [
            key,
            value || "",
          ]),
        )}
        workflowId={configModal.workflowId}
      />

      <FileViewer
        key={`log-${logModal.workflowId}`}
        title={`Log - Workflow ${logModal.workflowId}`}
        visible={logModal.visible}
        onClose={() =>
          setLogModal({
            visible: false,
            workflowId: "",
            workflowStatus: "SUCCESS",
          })
        }
        fileContent={logData?.content || ""}
        fileFormat="log"
      />

      <FileViewer
        key={`detail-${workflowDetailModal.workflowId}`}
        title={`Detail - Workflow ${workflowDetailModal.workflowId}`}
        visible={workflowDetailModal.visible}
        onClose={() =>
          setWorkflowDetailModal({ visible: false, workflowId: "" })
        }
        fileContent={JSON.stringify(workflowDetailData, null, 2) || ""}
        fileFormat="json"
      />
    </div>
  );
};

export default WorkflowTable;
