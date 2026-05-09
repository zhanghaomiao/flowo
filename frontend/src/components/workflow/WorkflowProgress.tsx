import React from 'react';

import {
  ArrowLeftOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { Link } from '@tanstack/react-router';
import { Button, Card, Col, Progress, Row, Statistic } from 'antd';
import { Library } from 'lucide-react';

import {
  useGetDetailQuery,
  useGetProgressQuery,
} from '@/client/@tanstack/react-query.gen';
import WorkflowTag from '@/components/workflow/WorkflowTag';

interface WorkflowProgressProps {
  workflowId: string;
}

const WorkflowProgress: React.FC<WorkflowProgressProps> = ({ workflowId }) => {
  const { data: progressData } = useGetProgressQuery({
    path: {
      workflow_id: workflowId,
    },
  });

  const { data: totalJobsData } = useGetProgressQuery({
    path: {
      workflow_id: workflowId,
    },
    query: {
      return_total_jobs_number: true,
    },
  });

  const { data: workflow } = useGetDetailQuery({
    path: {
      workflow_id: workflowId,
    },
  });

  const getProgressStatus = () => {
    if ((progressData?.failed ?? 0) > 0) return 'exception';
    if ((progressData?.running ?? 0) > 0) return 'active';
    if (
      ((progressData?.completed ?? 0) / (progressData?.total ?? 1)) * 100 ===
      100
    )
      return 'success';
    return 'normal';
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
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              Back
            </Button>
          </Link>
        </Col>
        <Col
          span={10}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          {workflow?.catalog_slug && (
            <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold tracking-widest">
              <Library size={12} strokeWidth={2.5} className="text-slate-300" />
              <Link
                to="/catalog"
                className="text-slate-400 hover:text-brand-500 transition-colors"
              >
                Catalog
              </Link>
              <span className="text-slate-200">/</span>
              <Link
                to="/catalog/$catalogSlug"
                params={{ catalogSlug: workflow.catalog_slug }}
                className="text-slate-900 hover:text-brand-500 transition-colors border-b border-transparent hover:border-brand-500/30"
              >
                {workflow.catalog_slug}
              </Link>
            </div>
          )}

          <div className="text-base font-black text-slate-900 tracking-tight">
            {workflow?.name || workflow?.directory}
          </div>

          {workflow?.tags && workflow.tags.length > 0 && (
            <div className="flex flex-wrap justify-center gap-1">
              {workflow.tags.map((tag, index) => (
                <WorkflowTag
                  key={index}
                  tag={tag}
                  style={{
                    fontSize: '9px',
                    marginInlineEnd: 0,
                    lineHeight: '14px',
                    height: '16px',
                    borderRadius: '4px',
                  }}
                />
              ))}
            </div>
          )}
        </Col>
        <Col span={3}>
          <div style={{ textAlign: 'left' }}>
            <div
              style={{
                color: 'rgba(0, 0, 0, 0.45)',
                fontSize: '14px',
                marginBottom: '4px',
                fontWeight: 'normal',
              }}
            >
              Progress
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Progress
                percent={progressData?.progress ?? 0}
                status={getProgressStatus()}
                type="circle"
                size={25}
                showInfo={false}
              />
              <span
                style={{
                  fontSize: '16px',
                  fontWeight: '600',
                  color:
                    getProgressStatus() === 'exception'
                      ? '#ff4d4f'
                      : getProgressStatus() === 'success'
                        ? '#52c41a'
                        : getProgressStatus() === 'active'
                          ? '#1890ff'
                          : '#8c8c8c',
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
            valueStyle={{ color: '#1890ff' }}
          />
        </Col>
        <Col span={3}>
          <Statistic
            title="Completed"
            value={progressData?.completed}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: '#52c41a' }}
          />
        </Col>
        <Col span={3}>
          <Statistic
            title="Running"
            value={progressData?.running}
            prefix={<SyncOutlined spin={(progressData?.running ?? 0) > 0} />}
            valueStyle={{ color: '#1890ff' }}
          />
        </Col>
      </Row>
    </Card>
  );
};

export default WorkflowProgress;
