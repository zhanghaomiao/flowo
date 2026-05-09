import { useCallback, useMemo, useState } from 'react';

import {
  Query,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  Badge,
  Button,
  message,
  Popconfirm,
  Progress,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  FileText,
  Info,
  Library,
  RefreshCcw,
  Settings,
  Trash2,
} from 'lucide-react';

import SnakemakeIcon from '@/assets/snakemake.svg?react';
import {
  deleteWorkflowMutation,
  getConfigfilesOptions,
  getDetailOptions,
  getSnakefileOptions,
  getWorkflowLogOptions,
  getWorkflowsOptions,
  getWorkflowsQueryKey,
} from '@/client/@tanstack/react-query.gen';
import type { Status, WorkflowResponse } from '@/client/types.gen';
import { DurationCell } from '@/components/common/common';
import LiveUpdatesIndicator from '@/components/LiveUpdatesIndicator';
import { FileViewerModal, MultiFileViewer } from '@/components/shared/viewers';
import WorkflowTag from '@/components/workflow/WorkflowTag';
import { useWorkflowRealtime } from '@/config/workflowRealtime';
import {
  formatDateCompact,
  getWorkflowProgressStatus,
  normalizeWorkflowStatus,
  workflowBadgeAntStatus,
  workflowStatusLabel,
} from '@/utils/formatters';

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
      status,
      tags: searchTags,
      name: searchName,
      startAt: searchStartAt,
      endAt: searchEndAt,
    };
  }, [
    pageSize,
    currentPage,
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
        predicate: (query: Query) => {
          const keyObj = query.queryKey[0] as { tags?: string[] };
          return (
            Array.isArray(keyObj?.tags) && keyObj.tags.includes('workflow')
          );
        },
      });
    },
  });

  const workflows = workflowsData?.workflows ?? [];
  const connectionStatus = useWorkflowRealtime(
    workflows.map((workflow) => workflow.id),
  );

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

  const handleShowSnakefile = (workflowId: string) => {
    setSnakefileModal({
      visible: true,
      workflowId,
    });
  };

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
  }, [queryClient, messageApi, queryParams]);

  const columns: ColumnsType<WorkflowResponse> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      minWidth: 200,
      ellipsis: true,
      sorter: (a, b) => (a.name || '').localeCompare(b.name || ''),
      render: (name: string | null, record: WorkflowResponse) => {
        const tags = record.tags || [];
        const displayTags = tags.slice(0, 5);
        const extraTagsCount = tags.length - 5;

        return (
          <div className="flex flex-col gap-1.5 py-1">
            <Link
              to="/workflow/$workflowId"
              params={{ workflowId: record.id }}
              className="text-brand-600 hover:text-brand-700 font-semibold text-sm transition-colors decoration-brand-200/50 hover:underline underline-offset-4"
            >
              {name || record.directory}
              <span className="ml-1.5 text-slate-400 font-normal">
                ({record.total_jobs})
              </span>
            </Link>

            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1">
                {displayTags.map((tag, index) => (
                  <WorkflowTag
                    key={index}
                    tag={tag}
                    className="!text-[10px] !px-1.5 !py-0 !h-5 border-slate-100"
                    onClick={handleTagsSearch}
                  />
                ))}

                {extraTagsCount > 0 && (
                  <Tooltip
                    title={
                      <div className="p-1">
                        <div className="mb-2 font-bold text-xs border-b border-white/10 pb-1">
                          All Tags ({tags.length})
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {tags.map((tag, index) => (
                            <WorkflowTag
                              key={index}
                              tag={tag}
                              className="!text-[10px]"
                              onClick={handleTagsSearch}
                            />
                          ))}
                        </div>
                      </div>
                    }
                  >
                    <Tag className="m-0 text-[10px] px-1.5 h-5 flex items-center cursor-pointer border-dashed bg-slate-50 text-slate-500 border-slate-300 hover:bg-slate-100 transition-colors">
                      +{extraTagsCount}
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
      title: 'Catalog',
      key: 'catalog_slug',
      width: 130,
      ellipsis: true,
      render: (_: unknown, record: WorkflowResponse) => {
        const ref = record.catalog_id ?? record.catalog_slug;
        const label = record.catalog_slug ?? record.catalog_id;
        return ref && label ? (
          <Tooltip title="View all runs in this catalog">
            <Link
              to="/catalog/$catalogId"
              params={{ catalogId: ref }}
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-brand-50 text-brand-600 hover:bg-brand-100 hover:text-brand-700 transition-colors text-xs font-bold border border-brand-100"
            >
              <Library size={12} className="shrink-0" />
              <span className="truncate">{label}</span>
            </Link>
          </Tooltip>
        ) : (
          <span className="text-slate-300">—</span>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 128,
      render: (_: unknown, record: WorkflowResponse) => {
        const s = normalizeWorkflowStatus(record.status);
        return (
          <Badge
            status={workflowBadgeAntStatus(s)}
            className="workflow-status-badge [&_.ant-badge-status-text]:text-slate-700 [&_.ant-badge-status-text]:text-sm [&_.ant-badge-status-text]:font-medium"
            text={workflowStatusLabel(s)}
          />
        );
      },
      filters: [
        { text: 'Succeeded', value: 'SUCCESS' },
        { text: 'Running', value: 'RUNNING' },
        { text: 'Failed', value: 'ERROR' },
        { text: 'Waiting', value: 'WAITING' },
      ],
      filteredValue: status ? [status] : null,
      onFilter: (value, record) =>
        normalizeWorkflowStatus(record.status) === value,
    },
    {
      title: 'Start Time',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 132,
      align: 'right',
      render: (startedAt: string | null) => (
        <span className="text-slate-500 font-medium tabular-nums text-xs">
          {formatDateCompact(startedAt)}
        </span>
      ),
      sorter: (a, b) => {
        const dateA = a.started_at ? new Date(a.started_at).getTime() : 0;
        const dateB = b.started_at ? new Date(b.started_at).getTime() : 0;
        return dateA - dateB;
      },
    },
    {
      title: <span className="whitespace-nowrap">Duration</span>,
      dataIndex: 'duration',
      key: 'duration',
      width: 100,
      align: 'right',
      render: (_, record) => (
        <div className="text-slate-600 font-semibold tabular-nums text-xs">
          <DurationCell record={record} />
        </div>
      ),
    },
    {
      title: <span className="whitespace-nowrap">Progress</span>,
      key: 'progress',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const s = normalizeWorkflowStatus(record.status);
        const progressStatus = getWorkflowProgressStatus(s);
        const percent =
          s === 'SUCCESS'
            ? 100
            : Math.min(100, Math.max(0, record.progress ?? 0));
        return (
          <div className="flex justify-center py-0.5">
            <Progress
              type="circle"
              percent={percent}
              status={progressStatus}
              size={26}
              strokeWidth={8}
            />
          </div>
        );
      },
    },
    {
      title: 'Actions',
      key: 'files',
      width: 168,
      align: 'right',
      render: (_, record) => (
        <div className="flex items-center justify-end gap-0.5">
          <Tooltip title="View Snakefile">
            <Button
              type="text"
              icon={<SnakemakeIcon style={{ fontSize: '18px' }} />}
              size="small"
              className="hover:bg-slate-100 flex items-center justify-center h-8 w-8 min-w-8"
              onClick={() => handleShowSnakefile(record.id)}
            />
          </Tooltip>

          <Tooltip
            title={record.configfiles ? 'View Config Files' : 'No Config Files'}
          >
            <Button
              type="text"
              icon={<Settings size={18} />}
              size="small"
              disabled={!record.configfiles}
              className={`flex items-center justify-center h-8 w-8 min-w-8 ${record.configfiles ? 'text-sky-500 hover:bg-sky-50 hover:text-sky-600' : 'text-slate-200'}`}
              onClick={() => handleShowConfig(record.id)}
            />
          </Tooltip>

          {record.started_at && (
            <Tooltip title="View Workflow Logs">
              <Button
                type="text"
                icon={<FileText size={18} />}
                size="small"
                className="text-amber-500 hover:bg-amber-50 hover:text-amber-600 flex items-center justify-center h-8 w-8 min-w-8"
                onClick={() =>
                  handleShowLogs(
                    record.id,
                    normalizeWorkflowStatus(record.status),
                  )
                }
              />
            </Tooltip>
          )}

          <Tooltip title="View Details">
            <Button
              type="text"
              icon={<Info size={18} />}
              size="small"
              className="text-brand-500 hover:bg-brand-50 hover:text-brand-600 flex items-center justify-center h-8 w-8 min-w-8"
              onClick={() =>
                setWorkflowDetailModal({
                  visible: true,
                  workflowId: record.id,
                })
              }
            />
          </Tooltip>

          <Popconfirm
            title="Delete Workflow"
            description={`Delete "${record.name || record.id}"?`}
            onConfirm={() => handleDeleteWorkflow(record.id)}
            okText="Delete"
            cancelText="Cancel"
            okButtonProps={{ danger: true, loading: deleteWorkflow.isPending }}
            placement="bottomRight"
          >
            <Button
              type="text"
              icon={<Trash2 size={18} />}
              size="small"
              danger
              className="hover:bg-rose-50 flex items-center justify-center h-8 w-8 min-w-8"
            />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div className="w-full h-full">
      {contextHolder}

      {/* Integrated Header */}
      <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white/80 backdrop-blur-md z-10 gap-6">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <h3 className="m-0 text-xl font-black text-slate-800 tracking-tight">
              Workflows
            </h3>
            <div className="text-[10px] uppercase font-black text-slate-400 mt-1 flex items-center gap-2">
              <span>{workflowsData?.total ?? 0} runs detected</span>
              <span className="h-1 w-1 rounded-full bg-slate-200" />
              <span>{workflows.length} visible</span>
            </div>
          </div>

          <div className="h-10 w-px bg-slate-100 hidden md:block" />

          <LiveUpdatesIndicator status={connectionStatus} />
        </div>

        <div className="flex items-center gap-4 flex-1 max-w-6xl justify-end">
          <WorkflowSearch
            onTagsChange={handleTagsSearch}
            onNameChange={handleNameSearch}
            onDateRangeChange={handleDateRangeSearch}
            tags={searchTags}
            name={searchName}
            className="flex-1"
          />
          <Button
            icon={<RefreshCcw size={18} />}
            onClick={handleRefresh}
            className="flex items-center gap-2 text-sky-600 border-none bg-sky-100/40 hover:bg-sky-100 transition-all duration-300 font-bold h-12 px-6 rounded-2xl shadow-sm whitespace-nowrap"
          >
            Refresh List
          </Button>
        </div>
      </div>

      {/* Main Table Content - Borderless & Seamless */}
      <div className="px-8 py-2">
        <Table
          columns={columns}
          dataSource={workflows}
          rowKey="id"
          loading={workflowsLoading}
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
            total: workflowsData?.total ?? 0,
            pageSize: pageSize,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total: number, range: [number, number]) => (
              <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider">
                {range[0]}-{range[1]} of {total} items
              </span>
            ),
            pageSizeOptions: ['10', '20', '50', '100'],
            position: ['bottomCenter'],
            className: '!m-0 py-8 border-t border-slate-50',
            onChange: (page: number, size: number) => {
              setCurrentPage(page);
              if (size !== pageSize) {
                setPageSize(size);
                setCurrentPage(1);
              }
            },
          }}
          tableLayout="fixed"
          size="middle"
          className="workflow-table-unified seamless-table [&_.ant-table]:!bg-transparent [&_.ant-table-thead_th]:!bg-transparent [&_.ant-table-thead_th]:!border-none [&_.ant-table-thead_th]:text-slate-400 [&_.ant-table-thead_th]:text-[9px] [&_.ant-table-thead_th]:font-black [&_.ant-table-thead_th]:uppercase [&_.ant-table-thead_th]:tracking-widest [&_.ant-table-cell]:align-middle [&_.ant-table-cell]:!border-slate-50/50"
          onRow={() => ({
            className: 'hover:bg-slate-50/80 transition-colors group',
          })}
        />
      </div>

      {/* Modals */}
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
        fileContent={
          Array.isArray(configData)
            ? Object.fromEntries(configData.map((f) => [f.path, f.content]))
            : {}
        }
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
