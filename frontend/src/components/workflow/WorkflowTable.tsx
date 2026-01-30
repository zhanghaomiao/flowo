import SnakemakeIcon from '@/assets/snakemake.svg?react';
import {
  deleteWorkflowMutation,
  getAllUsersOptions,
  getConfigfilesOptions,
  getDetailOptions,
  getSnakefileOptions,
  getWorkflowLogOptions,
  getWorkflowsOptions,
  getWorkflowsQueryKey
} from '@/client/@tanstack/react-query.gen';
import type { Status, WorkflowResponse } from '@/client/types.gen';
import { DurationCell } from '@/components/common/common';
import LiveUpdatesIndicator from '@/components/LiveUpdatesIndicator';
import { FileViewerModal, MultiFileViewer } from '@/components/shared/viewers';
import WorkflowTag from '@/components/workflow/WorkflowTag';
import { useWorkflowRealtime } from '@/config/workflowRealtime';
import {
  formatDateCompact,
  getStatusColor,
  getWorkflowProgressStatus,
} from '@/utils/formatters';
import Icon, {
  DeleteOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  Button,
  Popconfirm,
  Progress,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useMemo, useState } from 'react';

import WorkflowSearch from './WorkflowSearch';


const WorkflowTable = () => {

  const queryClient = useQueryClient();
  const [snakefileModal, setSnakefileModal] = useState<{
    visible: boolean;
    workflowId: string;
  }>({
    visible: false,
    workflowId: '',
  });

  const [configModal, setConfigModal] = useState<{
    visible: boolean;
    workflowId: string;
  }>({
    visible: false,
    workflowId: '',
  });

  const [logModal, setLogModal] = useState<{
    visible: boolean;
    workflowId: string;
    workflowStatus: Status;
  }>({
    visible: false,
    workflowId: '',
    workflowStatus: 'SUCCESS',
  });

  const [workflowDetailModal, setWorkflowDetailModal] = useState<{
    visible: boolean;
    workflowId: string;
  }>({
    visible: false,
    workflowId: '',
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

  const { data: snakefileData } = useQuery({
    ...getSnakefileOptions({
      path: {
        workflow_id: snakefileModal.workflowId,
      },
    }),
    enabled: snakefileModal.visible && !!snakefileModal.workflowId,
  });

  const { data: configData } = useQuery({
    ...getConfigfilesOptions({
      path: {
        workflow_id: configModal.workflowId,
      },
    }),
    enabled: configModal.visible && !!configModal.workflowId,
  });

  const { data: usersData } = useQuery({
    ...getAllUsersOptions(),
  });

  const { data: logData } = useQuery({
    ...getWorkflowLogOptions({
      path: {
        workflow_id: logModal.workflowId,
      },
    }),
    enabled: logModal.visible && !!logModal.workflowId,
  });

  const { data: workflowDetailData } = useQuery({
    ...getDetailOptions({
      path: {
        workflow_id: workflowDetailModal.workflowId,
      },
    }),
    enabled: workflowDetailModal.visible && !!workflowDetailModal.workflowId,
  });

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

  const { data: workflowsData, isLoading: workflowsLoading } = useQuery({
    ...getWorkflowsOptions({ query: queryParams }),
  });


  const deleteWorkflow = useMutation({
    ...deleteWorkflowMutation(),
    onSuccess: () => {
      queryClient.invalidateQueries({
        predicate: (query: any) => {
          const keyObj = query.queryKey[0] as any;
          return Array.isArray(keyObj?.tags) && keyObj.tags.includes('workflow');
        },
      });
    }
  });

  const workflows = workflowsData?.workflows ?? [];
  const connectionStatus = useWorkflowRealtime(workflows.map((workflow) => workflow.id));

  const handleDeleteWorkflow = async (workflowId: string) => {
    try {
      await deleteWorkflow.mutateAsync({
        path: {
          workflow_id: workflowId,
        },
      });
      messageApi.open({
        type: 'success',
        content: `Workflow ${workflowId} deleted successfully!`,
      });
    } catch (error) {
      console.error('Failed to delete workflow:', error);
      messageApi.open({
        type: 'error',
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

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: getWorkflowsQueryKey({ query: queryParams }),
    });
    messageApi.open({
      type: 'success',
      content: 'Workflows refreshed successfully!',
    });
  }, [queryClient, messageApi]);

  const columns: ColumnsType<WorkflowResponse> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 240,
      fixed: 'left',
      sorter: (a, b) => {
        const nameA = a.name || '';
        const nameB = b.name || '';
        return nameA.localeCompare(nameB);
      },
      render: (name: string | null, record: WorkflowResponse) => {
        const tags = record.tags || [];
        const displayTags = tags.slice(0, 5);
        const extraTagsCount = tags.length - 5;

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {/* Name on first row */}
            <Link
              to="/workflow/$workflowId"
              params={{ workflowId: record.id }}
              style={{
                color: '#1890ff',
                textDecoration: 'none',
                display: 'block',
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: '14px',
                  color: '#1890ff',
                  lineHeight: '1.3',
                  letterSpacing: '-0.01em',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#40a9ff';
                  e.currentTarget.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#1890ff';
                  e.currentTarget.style.textDecoration = 'none';
                }}
              >
                {name || record.directory} ({record.total_jobs})
              </div>
            </Link>

            {tags.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                }}
              >
                {displayTags.map((tag, index) => (
                  <WorkflowTag
                    key={index}
                    tag={tag}
                    style={{
                      fontSize: '11px',
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
                          style={{ marginBottom: '4px', fontWeight: 'bold' }}
                        >
                          All Tags ({tags.length}):
                        </div>
                        {tags.map((tag, index) => (
                          <WorkflowTag
                            key={index}
                            tag={tag}
                            style={{ margin: '2px', fontSize: '11px' }}
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
                        fontSize: '11px',
                        lineHeight: '16px',
                        height: '18px',
                        display: 'flex',
                        alignItems: 'center',
                        cursor: 'pointer',
                        borderStyle: 'dashed',
                        padding: '0 6px',
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
      title: 'User',
      dataIndex: 'user',
      key: 'user',
      align: 'right',
      width: 35,
      filters: usersData?.map((user) => ({ text: user!, value: user! })) ?? [],
      filteredValue: user ? [user] : null,
      onFilter: (value, record) => record.user === value,
      sorter: (a, b) => {
        const userA = a.user || '';
        const userB = b.user || '';
        return userA.localeCompare(userB);
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 40,
      align: 'right',
      render: (status: Status) => (
        <Tag
          color={getStatusColor(status)}
          style={{ textTransform: 'uppercase' }}
        >
          {status}
        </Tag>
      ),
      filters: [
        { text: 'Success', value: 'SUCCESS' },
        { text: 'Running', value: 'RUNNING' },
        { text: 'Error', value: 'ERROR' },
        { text: 'Waiting', value: 'WAITING' },
      ],
      filteredValue: status ? [status] : null,
      onFilter: (value, record) => record.status === value,
    },
    {
      title: 'Started time',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 60,
      align: 'right',
      render: (startedAt: string | null) => formatDateCompact(startedAt),
      sorter: (a, b) => {
        const dateA = a.started_at ? new Date(a.started_at).getTime() : 0;
        const dateB = b.started_at ? new Date(b.started_at).getTime() : 0;
        return dateA - dateB;
      },
    },
    {
      title: 'End Time',
      dataIndex: 'end_time',
      key: 'end_time',
      align: 'right',
      width: 60,
      render: (endTime: string | null) => formatDateCompact(endTime),
      sorter: (a, b) => {
        const dateA = a.end_time ? new Date(a.end_time).getTime() : 0;
        const dateB = b.end_time ? new Date(b.end_time).getTime() : 0;
        return dateA - dateB;
      },
    },
    {
      title: 'Duration',
      dataIndex: 'duration',
      key: 'duration',
      width: 30,
      align: 'right',
      render: (_, record) => <DurationCell record={record} />,
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 25,
      fixed: 'right',
      align: 'right',
      render: (_, record) => {
        const progressStatus = getWorkflowProgressStatus(
          record.status as Status,
        );
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              width: '100%',
              height: '100%',
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
      title: 'Files',
      key: 'files',
      width: 40,
      align: 'center',
      render: (_, record) => {
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '2px',
              width: '100%',
              height: '100%',
            }}
          >
            <Space size={2}>
              <Tooltip title="View Snakefile">
                <Button
                  type="text"
                  icon={
                    <Icon component={SnakemakeIcon} style={{ fontSize: 22 }} />
                  }
                  size="small"
                  onClick={() => handleShowSnakefile(record.id)}
                />
              </Tooltip>
              {record.configfiles ? (
                <Tooltip title="View Config Files">
                  <Button
                    type="text"
                    icon={<SettingOutlined style={{ fontSize: 22 }} />}
                    size="small"
                    onClick={() => handleShowConfig(record.id)}
                    style={{
                      color: '#52c41a',
                      padding: '0px',
                    }}
                  />
                </Tooltip>
              ) : (
                <Tooltip title="No Config Files">
                  <Button
                    type="text"
                    icon={<SettingOutlined style={{ fontSize: 22 }} />}
                    size="small"
                    style={{
                      color: '#e8e8e8',
                      padding: '0px',
                    }}
                  />
                </Tooltip>
              )}
              {/* Log file button */}
              {record.started_at && (
                <Tooltip title="View Workflow Logs">
                  <Button
                    type="text"
                    icon={<FileTextOutlined style={{ fontSize: 22 }} />}
                    size="small"
                    onClick={() =>
                      handleShowLogs(record.id, record.status as Status)
                    }
                    style={{
                      color: '#fa8c16',
                      padding: '0px',
                    }}
                  />
                </Tooltip>
              )}
              {/* Workflow detail button */}
              <Tooltip title="View Workflow Detail">
                <Button
                  type="text"
                  icon={<InfoCircleOutlined style={{ fontSize: 22 }} />}
                  size="small"
                  onClick={() =>
                    setWorkflowDetailModal({
                      visible: true,
                      workflowId: record.id,
                    })
                  }
                  style={{
                    color: '#1890ff',
                    padding: '0px',
                  }}
                />
              </Tooltip>
            </Space>
          </div>
        );
      },
    },
    {
      title: 'Delete',
      key: 'delete',
      width: 20,
      align: 'center',
      render: (_, record) => {
        return (
          <Popconfirm
            title="Delete Workflow"
            description={`Are you sure you want to delete workflow: "${record.name}" with user: ${record.user}?`}
            onConfirm={() => handleDeleteWorkflow(record.id)}
            okText="Yes"
            cancelText="No"
            okButtonProps={{
              danger: true,
              loading: deleteWorkflow.isPending,
            }}
            placement="topLeft"
            disabled={deleteWorkflow.isPending}
          >
            <Button
              type="text"
              icon={<DeleteOutlined style={{ fontSize: 20 }} />}
              size="small"
              danger
              style={{ padding: '2px' }}
            />
          </Popconfirm>
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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 style={{ margin: '4px 0' }}>
            Workflows ({workflowsData?.total ?? 0} total, showing{' '}
            {workflows.length})
          </h3>
          <LiveUpdatesIndicator
            status={connectionStatus}
          />
          <WorkflowSearch
            onTagsChange={handleTagsSearch}
            onNameChange={handleNameSearch}
            onDateRangeChange={handleDateRangeSearch}
            tags={searchTags}
            name={searchName}
          />
        </div>
        <Button
          type="default"
          icon={<ReloadOutlined />}
          onClick={handleRefresh}
          size="small"
        >
          Refresh
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={workflows}
        rowKey="id"
        loading={workflowsLoading}
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
          pageSizeOptions: ['10', '20', '50', '100'],
          position: ['bottomCenter'],
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
        style={{ backgroundColor: 'white' }}
        onRow={() => ({
          style: { cursor: 'pointer' },
        })}
      />
      <FileViewerModal
        key={`snakefile-${snakefileModal.workflowId}`}
        title={`Snakefile - Workflow ${snakefileModal.workflowId}`}
        visible={snakefileModal.visible}
        onClose={() => setSnakefileModal({ visible: false, workflowId: '' })}
        fileContent={snakefileData?.content || ''}
        fileFormat="yaml"
      />
      <MultiFileViewer
        key={`config-${configModal.workflowId}`}
        visible={configModal.visible}
        onClose={() => setConfigModal({ visible: false, workflowId: '' })}
        fileContent={Object.fromEntries(
          Object.entries(configData || {}).map(([key, value]) => [
            key,
            value || '',
          ]),
        )}
        workflowId={configModal.workflowId}
      />

      <FileViewerModal
        key={`log-${logModal.workflowId}`}
        title={`Log - Workflow ${logModal.workflowId}`}
        visible={logModal.visible}
        onClose={() =>
          setLogModal({
            visible: false,
            workflowId: '',
            workflowStatus: 'SUCCESS',
          })
        }
        fileContent={logData?.content || ''}
        fileFormat="log"
      />

      <FileViewerModal
        key={`detail-${workflowDetailModal.workflowId}`}
        title={`Detail - Workflow ${workflowDetailModal.workflowId}`}
        visible={workflowDetailModal.visible}
        onClose={() =>
          setWorkflowDetailModal({ visible: false, workflowId: '' })
        }
        fileContent={JSON.stringify(workflowDetailData, null, 2) || ''}
        fileFormat="json"
      />
    </div>
  );
};

export default WorkflowTable;
