import React, { useState } from 'react'
import { Table, Tag, Button, Tooltip, Alert } from 'antd'
import { ReloadOutlined, InfoCircleOutlined, ClearOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useWorkflowJobsWithSSE } from '../../hooks/useQueriesWithSSE'
import type { JobResponse } from '../../api/client'
import LiveUpdatesIndicator from '../LiveUpdatesIndicator'
import type { Status } from '../../api/api'
import { formatDateCompact, formatDuration, getStatusColor } from '../../utils/formatters'

interface JobTableProps {
  workflowId?: string
  ruleName?: string | null
  showRefreshButton?: boolean
  onClearRuleFilter?: () => void
}

const JobTable: React.FC<JobTableProps> = ({
  workflowId,
  ruleName,
  showRefreshButton = true,
  onClearRuleFilter
}) => {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [status, setStatus] = useState<Status | null>(null)
  const offset = (currentPage - 1) * pageSize


  const {
    data: jobs,
    isLoading,
    error,
    refetch,
    sseStatus,
    isSSEConnected,
    sseError,
    sseRetryCount,
    reconnectSSE,
  } = useWorkflowJobsWithSSE({
    workflowId: workflowId!,
    limit: pageSize,
    offset: offset,
    status: status,
    ruleName: ruleName,
    orderByStarted: true,
    descending: true,
    enableSSE: true
  })


  const columns: ColumnsType<JobResponse> = [
    {
      title: 'Job ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      fixed: 'left',
      render: (id: number) => (
        <code style={{ fontSize: '12px', fontWeight: 'bold' }}>
          {id}
        </code>
      ),
      sorter: (a, b) => (a.id ?? 0) - (b.id ?? 0),
    },
    {
      title: 'Rule name',
      dataIndex: 'rule_name',
      key: 'rule_name',
      width: 120,
      render: (ruleName: string) => (
        <code style={{ fontSize: '14px', fontWeight: 'bold' }}>
          {ruleName}
        </code>
      ),
      sorter: (a, b) => (a.rule_id ?? 0) - (b.rule_id ?? 0),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: Status) => (
        <Tag color={getStatusColor(status)} style={{ textTransform: 'uppercase' }}>
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
        const dateA = a.started_at ? new Date(a.started_at).getTime() : 0
        const dateB = b.started_at ? new Date(b.started_at).getTime() : 0
        return dateA - dateB
      },
    },
    {
      title: 'End Time',
      dataIndex: 'end_time',
      key: 'end_time',
      width: 140,
      render: (endTime: string | null) => formatDateCompact(endTime),
      sorter: (a, b) => {
        const dateA = a.end_time ? new Date(a.end_time).getTime() : 0
        const dateB = b.end_time ? new Date(b.end_time).getTime() : 0
        return dateA - dateB
      },
    },
    {
      title: 'Duration (min:sec)',
      dataIndex: 'duration',
      key: 'duration',
      width: 80,
      render: (_, record) => {
        if (record.end_time && record.started_at) {
          let endTime = record.end_time
          if (record.status === 'running') {
            endTime = new Date().toISOString()
          }
          const duration = new Date(endTime).getTime() - new Date(record.started_at).getTime()
          return formatDuration(duration)
        }
        return '-'
      },
    },
    {
      title: 'Threads',
      dataIndex: 'threads',
      key: 'threads',
      width: 80,
      render: (threads: number | null) => threads ?? '-',
      sorter: (a, b) => (a.threads ?? 0) - (b.threads ?? 0),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      render: (priority: number | null) => priority ?? '-',
      sorter: (a, b) => (a.priority ?? 0) - (b.priority ?? 0),
    },
    {
      title: 'Message',
      dataIndex: 'message',
      key: 'message',
      width: 200,
      render: (message: string | null) => (
        message ? (
          <Tooltip title={message}>
            <span style={{
              display: 'inline-block',
              maxWidth: '180px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '12px'
            }}>
              {message}
            </span>
          </Tooltip>
        ) : '-'
      ),
    },
    {
      title: 'Details',
      key: 'details',
      width: 80,
      render: (_, record) => (
        <Tooltip title="View job details">
          <Button
            type="text"
            icon={<InfoCircleOutlined />}
            size="small"
            onClick={() => {
              // TODO: Implement job detail modal or navigation
              console.log('Job details:', record)
            }}
          />
        </Tooltip>
      ),
    },
  ]

  return (
    <div>
      <div style={{
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 style={{ margin: 0 }}>
            {workflowId ?
              `Jobs` :
              `All Jobs (${jobs?.total ?? 0})`
            }
          </h3>
          <LiveUpdatesIndicator
            isConnected={isSSEConnected}
            retryCount={sseRetryCount}
            onReconnect={reconnectSSE}
            showReconnectButton={false}
          />
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {!isSSEConnected && (
            <Button
              size="small"
              type="link"
              onClick={reconnectSSE}
              style={{ padding: '4px 8px', fontSize: '12px' }}
            >
              Reconnect SSE
            </Button>
          )}
          {ruleName && onClearRuleFilter && (
            <Button
              icon={<ClearOutlined />}
              onClick={onClearRuleFilter}
              size="small"
            >
              Clear Filter
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

      {sseError && sseStatus === 'error' && (
        <Alert
          message="Live Updates Connection Issue"
          description={`Unable to connect to live updates: ${sseError}`}
          type="warning"
          style={{ marginBottom: '16px' }}
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
        <div style={{
          color: '#ff4d4f',
          backgroundColor: '#fff2f0',
          border: '1px solid #ffccc7',
          borderRadius: '6px',
          padding: '8px 12px',
          marginBottom: '16px'
        }}>
          Error loading jobs: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      <Table
        columns={columns}
        dataSource={jobs?.jobs ?? []}
        rowKey={(record, index) => {
          // Create a unique key using multiple fields to avoid duplicates
          const id = record.id ?? 'no-id'
          const ruleId = record.rule_id ?? 'no-rule-id'
          const workflowId = record.workflow_id ?? 'no-workflow'
          return `${workflowId}-${ruleId}-${id}-${index}`
        }}
        loading={isLoading}
        onChange={(pagination, filters, sorter, extra) => {
          if (filters.status !== undefined) {
            const statusFilter = filters.status
            setStatus(statusFilter && statusFilter.length > 0 ? statusFilter[0] as Status : null)
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
            setCurrentPage(page)
            if (size !== pageSize) {
              setPageSize(size)
              setCurrentPage(1) // Reset to first page when page size changes
            }
          },
          onShowSizeChange: (current, size) => {
            setPageSize(size)
            setCurrentPage(1) // Reset to first page when page size changes
          }
        }}
        scroll={{ x: 1200 }}
        size="small"
        bordered
        style={{ backgroundColor: 'white' }}
      />
    </div>
  )
}

export default JobTable 