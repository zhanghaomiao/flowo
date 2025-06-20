import { Table, Tag, Space, Button, Tooltip, Progress, Popconfirm, message } from 'antd'
import { FileOutlined, ReloadOutlined, LinkOutlined, DeleteOutlined } from '@ant-design/icons'
import { Link } from '@tanstack/react-router'
import type { ColumnsType } from 'antd/es/table'
import { useWorkflowsWithSSE } from '../../hooks/useQueriesWithSSE'
import { useDeleteWorkflow, useWorkflowSnakefile, useWorkFlowUsers } from '../../hooks/useQueries'
import type { WorkflowResponse } from '../../api/client'
import LiveUpdatesIndicator from '../LiveUpdatesIndicator'
import SnakefileViewer from './SnakefileViewer'
import LogViewer from '../log/LogViewer'
import LiveLogViewer from '../log/LiveLogViewer'
import { useState } from 'react'
import type { Status } from '../../api/api'
import {
  formatDateCompact,
  formatDuration,
  getStatusColor,
  getWorkflowProgressPercent,
  getWorkflowProgressStatus
} from '../../utils/formatters'

interface WorkflowTableProps {
  limit?: number
  showRefreshButton?: boolean
}

const WorkflowTable: React.FC<WorkflowTableProps> = ({
  limit = 20,
  showRefreshButton = true,
}) => {
  const deleteWorkflowMutation = useDeleteWorkflow()
  const [snakefileModal, setSnakefileModal] = useState<{
    visible: boolean
    workflowId: string
  }>({
    visible: false,
    workflowId: '',
  })

  const [logModal, setLogModal] = useState<{
    visible: boolean
    workflowId: string
    workflowStatus: Status
  }>({
    visible: false,
    workflowId: '',
    workflowStatus: 'SUCCESS',
  })

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(limit)
  const [user, setUser] = useState<string | null>(null)
  const [status, setStatus] = useState<Status | null>(null)
  const [messageApi, contextHolder] = message.useMessage();

  // Calculate offset for API call
  const offset = (currentPage - 1) * pageSize

  // Fetch Snakefile content when modal is visible and workflowId is set
  const { data: snakefileData } = useWorkflowSnakefile(
    snakefileModal.workflowId,
    snakefileModal.visible && !!snakefileModal.workflowId
  )
  const { data: usersData } = useWorkFlowUsers()

  const {
    data: workflowsData,
    isLoading,
    error,
    refetch,
    // SSE related data
    sseError,
    isSSEConnected,
    sseRetryCount,
    reconnectSSE,
  } = useWorkflowsWithSSE({
    limit: pageSize,
    offset,
    orderByStarted: true,
    descending: true,
    enableSSE: true, // Enable SSE updates
    user,
    status,
  })

  const workflows = workflowsData?.workflows ?? []

  // Handle workflow deletion
  const handleDeleteWorkflow = async (workflowId: string) => {
    try {
      await deleteWorkflowMutation.mutateAsync(workflowId)
      messageApi.open({
        type: 'success',
        content: `Workflow ${workflowId} deleted successfully!`,
      });
    } catch (error) {
      console.error('Failed to delete workflow:', error)
      messageApi.open({
        type: 'error',
        content: `Failed to delete workflow ${workflowId}. Please try again.`,
      });
    }
  }

  // Handle showing Snakefile
  const handleShowSnakefile = (workflowId: string) => {
    setSnakefileModal({
      visible: true,
      workflowId
    })
  }

  // Handle showing logs
  const handleShowLogs = (workflowId: string, workflowStatus: Status) => {
    setLogModal({
      visible: true,
      workflowId,
      workflowStatus,
    })
  }

  const columns: ColumnsType<WorkflowResponse> = [
    {
      title: 'Workflow ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      fixed: 'left',
      render: (id: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link
            to="/workflow/$workflowId"
            params={{ workflowId: id }}
            style={{
              color: '#1890ff',
              textDecoration: 'none',
              fontSize: '12px',
              fontFamily: 'monospace',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <LinkOutlined style={{ fontSize: '10px' }} />
            <code style={{ fontSize: '12px', color: 'inherit' }}>
              {id}
            </code>
          </Link>
        </div>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      width: 60,
      sorter: (a, b) => {
        const nameA = a.name || ''
        const nameB = b.name || ''
        return nameA.localeCompare(nameB)
      },
    },
    {
      title: 'User',
      dataIndex: 'user',
      key: 'user',
      width: 60,
      filters: usersData?.map(user => ({ text: user!, value: user! })) ?? [],
      filteredValue: user ? [user] : null,
      onFilter: (value, record) => record.user === value,
      sorter: (a, b) => {
        const userA = a.user || ''
        const userB = b.user || ''
        return userA.localeCompare(userB)
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 60,
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
      title: 'Started time',
      dataIndex: 'started_at',
      key: 'started_at',
      width: 100,
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
      width: 100,
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
      width: 60,
      render: (_, record) => {
        // if has end_time and started_at, calculate duration
        if (record.end_time && record.started_at) {
          // using the time now as end_time if the status is running
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
      title: 'Configfile',
      dataIndex: 'configfiles',
      key: 'configfiles',
      width: 50,
      align: 'center',
      render: (configfiles: string[]) => (
        <div style={{ fontSize: '12px' }}>{configfiles?.join(', ')}</div>
      ),
    },
    {
      title: 'Snakefile',
      dataIndex: 'snakefile',
      key: 'snakefile',
      width: 40,
      align: 'center',
      render: (_, record) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%'
        }}>
          <Tooltip title="View Snakefile">
            <Button
              type="text"
              icon={<FileOutlined />}
              size="small"
              onClick={() => handleShowSnakefile(record.id)}
              style={{
                color: '#1890ff',
                padding: '2px'
              }}
            />
          </Tooltip>
        </div>
      ),
    },
    {
      title: 'Log File',
      key: 'logfile',
      width: 40,
      align: 'center',
      render: (_, record) => {
        // Only show log icon if logfile exists in the record
        const hasLogFile = record.logfile && record.logfile.trim() !== ''

        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%'
          }}>
            {hasLogFile ? (
              <Tooltip title="View Workflow Logs">
                <Button
                  type="text"
                  icon={<FileOutlined />}
                  size="small"
                  onClick={() => handleShowLogs(record.id, record.status as Status)}
                  style={{
                    color: '#52c41a',
                    padding: '2px'
                  }}
                />
              </Tooltip>
            ) : (
              <span style={{ color: '#d9d9d9', fontSize: '12px' }}>-</span>
            )}
          </div>
        )
      },
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 40,
      render: (_, record) => {
        const percent = getWorkflowProgressPercent(record.status as Status)
        const progressStatus = getWorkflowProgressStatus(record.status as Status)
        return (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%'
          }}>
            <Progress
              type="circle"
              percent={percent}
              status={progressStatus as any}
              size={20}
              showInfo={false}
            />
          </div>
        )
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%'
        }}>
          <Space size="small">
            <Popconfirm
              title="Delete Workflow"
              description={`Are you sure you want to delete workflow: ${record.id}?`}
              onConfirm={() => handleDeleteWorkflow(record.id)}
              okText="Yes"
              cancelText="No"
              okButtonProps={{
                danger: true,
                loading: deleteWorkflowMutation.isPending
              }}
              placement="topRight"
              disabled={deleteWorkflowMutation.isPending}
            >
              <Button
                type="text"
                icon={<DeleteOutlined />}
                size="small"
                danger
                style={{ padding: '2px' }}
              />
            </Popconfirm>
          </Space>
        </div>
      ),
    },
  ]

  return (
    <div>
      {contextHolder}
      <div style={{
        marginBottom: 16,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h3 style={{ margin: 0 }}>
            Workflows ({workflowsData?.total ?? 0} total, showing {workflows.length})
          </h3>
          <LiveUpdatesIndicator
            isConnected={isSSEConnected}
            retryCount={sseRetryCount}
            onReconnect={reconnectSSE}
            showReconnectButton={false}
          />
        </div>
        <Space>
          {!isSSEConnected && (
            <Button
              type="link"
              size="small"
              onClick={reconnectSSE}
              style={{ padding: '4px 8px' }}
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
        </Space>
      </div>

      {error && (
        <div style={{
          color: '#ff4d4f',
          backgroundColor: '#fff2f0',
          border: '1px solid #ffccc7',
          borderRadius: '6px',
          padding: '8px 12px',
          marginBottom: '16px'
        }}>
          Error loading workflows: {error instanceof Error ? error.message : 'Unknown error'}
        </div>
      )}

      {sseError && (
        <div style={{
          color: '#ff4d4f',
          backgroundColor: '#fff2f0',
          border: '1px solid #ffccc7',
          borderRadius: '6px',
          padding: '8px 12px',
          marginBottom: '16px'
        }}>
          SSE Connection Error: {sseError}
        </div>
      )}

      <Table
        columns={columns}
        dataSource={workflows}
        rowKey="id"
        loading={isLoading}
        onChange={(pagination, filters, sorter, extra) => {
          // Handle filter changes
          if (filters.user !== undefined) {
            const userFilter = filters.user
            setUser(userFilter && userFilter.length > 0 ? userFilter[0] as string : null)
          }
          if (filters.status !== undefined) {
            const statusFilter = filters.status
            setStatus(statusFilter && statusFilter.length > 0 ? statusFilter[0] as Status : null)
          }
        }}
        pagination={{
          current: currentPage,
          total: workflowsData?.total,
          pageSize: pageSize,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total}`,
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
        onRow={(record) => ({
          style: { cursor: 'pointer' },
        })}
      />

      <SnakefileViewer
        visible={snakefileModal.visible}
        onClose={() => setSnakefileModal({ visible: false, workflowId: '' })}
        snakefileContent={snakefileData?.snakefile_content || ''}
        workflowId={snakefileModal.workflowId}
      />

      {/* Conditionally render LogViewer or LiveLogViewer based on workflow status */}
      {logModal.workflowStatus === 'RUNNING' ? (
        <LiveLogViewer
          visible={logModal.visible}
          onClose={() => setLogModal({ visible: false, workflowId: '', workflowStatus: 'SUCCESS' })}
          workflowId={logModal.workflowId}
        />
      ) : (
        <LogViewer
          visible={logModal.visible}
          onClose={() => setLogModal({ visible: false, workflowId: '', workflowStatus: 'SUCCESS' })}
          workflowId={logModal.workflowId}
        />
      )}
    </div>
  )
}

export default WorkflowTable 