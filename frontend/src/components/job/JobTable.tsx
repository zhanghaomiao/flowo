import {
  getJobOptions,
  getLogsOptions,
  useGetJobsQuery,
} from '@/client/@tanstack/react-query.gen';
import type { JobResponse, Status } from '@/client/types.gen';
import LiveUpdatesIndicator from '@/components/LiveUpdatesIndicator';
import { DurationCell, calculateDuration } from '@/components/common/common';
import { formatDateCompact, getStatusColor } from '@/utils/formatters';
import {
  FileTextOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { Button, Table, Tag, Tooltip } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import React, { useEffect, useState } from 'react';
import FileViewer from '@/components/code/FileViewer';
import FilesViewer from '@/components/code/FilesViewer';

interface JobTableProps {
  workflowId?: string;
  workflowStatus?: Status;
  ruleName?: string | null;
  showRefreshButton?: boolean;
}

const JobTable: React.FC<JobTableProps> = ({
  workflowId,
  ruleName,
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

  // Reset pagination when ruleName changes
  useEffect(() => {
    setCurrentPage(1);
    setPageSize(20);
  }, [ruleName]);

  const { data: jobs, isLoading } =
    useGetJobsQuery({
      path: { workflow_id: workflowId! },
      query: {
        limit: pageSize,
        offset: offset,
        status: status,
        rule_name: ruleName,
        order_by_started: true,
        descending: true,
      },
    });

  const { data: jobDetailData } = useQuery({
    ...getJobOptions({
      path: { job_id: jobDetailModal.jobId },
    }),
    enabled: jobDetailModal.visible && jobDetailModal.jobId > 0 ? true : false,
  })

  const { data: jobLogsData } = useQuery({
    ...getLogsOptions({
      path: { job_id: jobLogsModal.jobId },
    }),
    enabled: jobLogsModal.visible && jobLogsModal.jobId > 0 ? true : false,
  });

  const columns: ColumnsType<JobResponse> = [
    {
      title: 'Rule name',
      dataIndex: 'rule_name',
      key: 'rule_name',
      width: 100,
      render: (ruleName: string) => (
        <code style={{ fontSize: '14px', fontWeight: 'bold' }}>{ruleName}</code>
      ),
      sorter: (a, b) => (a.rule_id ?? 0) - (b.rule_id ?? 0),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
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
      title: 'Started At',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 140,
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
      width: 140,
      render: (endTime: string | null) => formatDateCompact(endTime),
      sorter: (a, b) => {
        const dateA = a.end_time ? new Date(a.end_time).getTime() : 0;
        const dateB = b.end_time ? new Date(b.end_time).getTime() : 0;
        return dateA - dateB;
      },
    },
    {
      title: 'Duration (min:sec)',
      dataIndex: 'duration',
      key: 'duration',
      width: 40,
      render: (_, record) => <DurationCell record={record} />,
      sorter: (a, b) => {
        const durationA = calculateDuration(a);
        const durationB = calculateDuration(b);
        return durationA - durationB;
      },
    },
    {
      title: 'Threads',
      dataIndex: 'threads',
      key: 'threads',
      width: 30,
      render: (threads: number | null) => threads ?? '-',
      sorter: (a, b) => (a.threads ?? 0) - (b.threads ?? 0),
    },
    {
      title: 'Wildcards',
      dataIndex: 'wildcards',
      width: 150,
      render: (wildcards: string | null) => {
        if (!wildcards) return '-';

        try {
          const wildcardsObj =
            typeof wildcards === 'string' ? JSON.parse(wildcards) : wildcards;
          const entries = Object.entries(wildcardsObj);

          if (entries.length === 0) return '-';

          // Show first 2 key-value pairs as tags, rest in tooltip
          const visibleEntries = entries.slice(0, 3);
          const hiddenEntries = entries.slice(3);

          const tooltipContent =
            entries.length > 3 ? (
              <div style={{ maxWidth: '300px' }}>
                <div style={{ marginBottom: '8px', fontWeight: 'bold' }}>
                  All Wildcards:
                </div>
                {entries.map(([key, value]) => (
                  <div
                    key={key}
                    style={{
                      marginBottom: '4px',
                      padding: '2px 6px',
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      borderRadius: '3px',
                      fontSize: '12px',
                    }}
                  >
                    <strong>{key}:</strong> {String(value)}
                  </div>
                ))}
              </div>
            ) : null;

          return (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}
            >
              {visibleEntries.map(([key, value]) => (
                <Tag
                  key={key}
                  color="blue"
                  style={{
                    margin: 0,
                    fontSize: '11px',
                    maxWidth: '180px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
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
                      fontSize: '11px',
                      cursor: 'pointer',
                      border: '1px dashed #d9d9d9',
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
                style={{ fontSize: '11px', cursor: 'pointer' }}
              >
                {wildcards.length > 15
                  ? wildcards.substring(0, 15) + '...'
                  : wildcards}
              </Tag>
            </Tooltip>
          );
        }
      },
    },
    {
      title: 'Files',
      key: 'files',
      width: 100,
      align: 'center',
      render: (_, record) => {
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              height: '100%',
            }}
          >
            <Tooltip title="View Job Logs">
              <Button
                type="text"
                icon={<FileTextOutlined style={{ fontSize: 20 }} />}
                size="small"
                onClick={() => {
                  setJobLogsModal({ visible: true, jobId: record.id! });
                }}
              />
            </Tooltip>
            <Tooltip title="View Job Details">
              <Button
                type="text"
                icon={<InfoCircleOutlined style={{ fontSize: 20 }} />}
                size="small"
                onClick={() => {
                  setJobDetailModal({ visible: true, jobId: record.id! });
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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          margin: '10px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LiveUpdatesIndicator
            isConnected={true}
            showReconnectButton={false}
          />
        </div>
      </div>

      <Table
        columns={columns}
        dataSource={jobs?.jobs ?? []}
        rowKey={(record) => record.id ?? ''}
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
          pageSizeOptions: ['10', '20', '50', '100'],
          position: ['bottomCenter'],
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
        style={{ backgroundColor: 'white' }}
      />

      <FileViewer
        key={`jobDetail`}
        title={`Detail -  Job ${jobDetailModal.jobId}`}
        visible={jobDetailModal.visible}
        onClose={() => setJobDetailModal({ visible: false, jobId: 0 })}
        fileContent={JSON.stringify(jobDetailData, null, 2) || ''}
        fileFormat="json"
      />

      <FilesViewer
        key={`jobLogs`}
        visible={jobLogsModal.visible}
        onClose={() => setJobLogsModal({ visible: false, jobId: 0 })}
        fileContent={jobLogsData || {}}
        jobId={jobLogsModal.jobId}
      />
    </div>
  );
};

export default JobTable;
