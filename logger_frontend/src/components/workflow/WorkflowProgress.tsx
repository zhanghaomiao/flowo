import React from 'react'
import { Progress, Card, Statistic, Row, Col, Alert } from 'antd'
import { CheckCircleOutlined, SyncOutlined, CloseCircleOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { useWorkflowProgressWithSSE } from '../../hooks/useQueriesWithSSE'

interface WorkflowProgressProps {
  workflowId: string
}

const WorkflowProgress: React.FC<WorkflowProgressProps> = ({ workflowId }) => {
  const {
    data: progressData,
    isLoading,
    error,
  } = useWorkflowProgressWithSSE(workflowId)


  const getProgressStatus = () => {
    if ((progressData?.failed ?? 0) > 0) return 'exception'
    if ((progressData?.running ?? 0) > 0) return 'active'
    if ((progressData?.completed ?? 0) / (progressData?.total ?? 1) * 100 === 100) return 'success'
    return 'normal'
  }

  return (
    <Card>
      <Row gutter={2}>
        <Col span={8} style={{ alignItems: 'center', alignContent: 'center', fontWeight: 'bold', fontSize: '16px' }}>
          Workflow Progress - {workflowId}
        </Col>
        <Col span={4}>
          <Statistic
            title="Total Jobs"
            value={progressData?.total}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Col>
        <Col span={4}>
          <Statistic
            title="Completed"
            value={progressData?.completed}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Col>
        <Col span={4}>
          <Statistic
            title="Running"
            value={progressData?.running}
            prefix={<SyncOutlined spin={(progressData?.running ?? 0) > 0} />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Col>
        <Col span={4}>
          <Statistic
            title="Failed"
            value={progressData?.error}
            prefix={<CloseCircleOutlined />}
            valueStyle={{ color: (progressData?.failed ?? 0) > 0 ? '#ff4d4f' : '#666' }}
          />
        </Col>
      </Row>
      {isLoading && (
        <Alert
          message="Loading job data..."
          type="info"
          showIcon
          style={{ marginBottom: '12px' }}
        />
      )}

      <div style={{ marginTop: '10px' }}>
        <Progress
          percent={parseFloat(((progressData?.completed ?? 0) / (progressData?.total ?? 1) * 100).toFixed(1))}
          status={getProgressStatus()}
          strokeWidth={16}
          showInfo={true}
        />
      </div>


      {error && (
        <Alert
          message="Error loading job data for progress calculation"
          description={error instanceof Error ? error.message : 'Unknown error'}
          type="error"
          showIcon
          style={{ marginTop: '16px' }}
        />
      )}
    </Card>
  )
}

export default WorkflowProgress 