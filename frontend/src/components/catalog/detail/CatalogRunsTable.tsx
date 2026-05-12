import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Badge, Col, Empty, Progress, Row, Spin, Statistic, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  Activity,
  CheckCircle,
  Clock,
  Library,
  PlayCircle,
  Timer,
} from 'lucide-react';

import { listCatalogWorkflowsOptions } from '@/client/@tanstack/react-query.gen';
import type { WorkflowResponse } from '@/client/types.gen';
import { DurationCell } from '@/components/common/common';
import {
  formatDateCompact,
  normalizeWorkflowStatus,
  workflowBadgeAntStatus,
  workflowStatusLabel,
} from '@/utils/formatters';

interface Props {
  catalogRef: string;
}

function CatalogRunsTable({ catalogRef }: Props) {
  const { data, isLoading } = useQuery({
    ...listCatalogWorkflowsOptions({
      path: { catalog_ref: catalogRef },
      query: {
        limit: 100,
        offset: 0,
        order_by_started: true,
        descending: true,
      },
    }),
    enabled: !!catalogRef,
  });

  const workflows = data?.workflows ?? [];

  // Calculate statistics
  const stats = {
    total: workflows.length,
    success: workflows.filter(
      (w) => normalizeWorkflowStatus(w.status) === 'SUCCESS',
    ).length,
    running: workflows.filter(
      (w) => normalizeWorkflowStatus(w.status) === 'RUNNING',
    ).length,
    failed: workflows.filter(
      (w) => normalizeWorkflowStatus(w.status) === 'ERROR',
    ).length,
    avgDuration:
      workflows.length > 0
        ? workflows.reduce((acc, w) => {
            if (w.started_at && w.end_time) {
              const d =
                (new Date(w.end_time).getTime() -
                  new Date(w.started_at).getTime()) /
                1000;
              return acc + (d > 0 ? d : 0);
            }
            return acc;
          }, 0) / workflows.length
        : 0,
  };

  const successRate =
    stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;

  const columns: ColumnsType<WorkflowResponse> = [
    {
      title: 'Run name',
      key: 'name',
      render: (_, row) => (
        <div className="flex flex-col py-1">
          <Link
            to="/runs/$workflowId"
            params={{ workflowId: row.id }}
            className="text-sm font-bold text-brand-600 hover:text-brand-700 hover:underline"
          >
            {row.name || row.directory || 'Untitled run'}
          </Link>
          <span className="text-[10px] text-slate-400 font-mono mt-0.5">
            ID: {row.id.slice(0, 8)}...
          </span>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 140,
      render: (_: unknown, row: WorkflowResponse) => {
        const s = normalizeWorkflowStatus(row.status);
        const isRunning = s === 'RUNNING';
        return (
          <div className="flex items-center gap-2">
            <Badge
              status={workflowBadgeAntStatus(s)}
              className={isRunning ? 'animate-pulse' : ''}
              text={
                <span
                  className={`font-bold text-xs uppercase tracking-wider ${
                    s === 'SUCCESS'
                      ? 'text-emerald-600'
                      : s === 'ERROR'
                        ? 'text-rose-600'
                        : s === 'RUNNING'
                          ? 'text-sky-600'
                          : 'text-slate-500'
                  }`}
                >
                  {workflowStatusLabel(s)}
                </span>
              }
            />
          </div>
        );
      },
    },
    {
      title: 'Timeline',
      dataIndex: 'started_at',
      width: 160,
      render: (v: string | null | undefined) => (
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5 text-slate-600 text-xs">
            <Clock size={12} className="text-slate-400" />
            <span className="font-medium">{formatDateCompact(v ?? null)}</span>
          </div>
        </div>
      ),
    },
    {
      title: 'Run Duration',
      key: 'duration',
      width: 120,
      align: 'right',
      render: (_, row) => (
        <div className="flex items-center justify-end gap-1.5 text-slate-700 font-mono text-xs font-bold bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
          <Timer size={12} className="text-slate-400" />
          <DurationCell record={row} />
        </div>
      ),
    },
    {
      title: 'Progress',
      key: 'progress',
      width: 140,
      render: (_, row) => {
        const s = normalizeWorkflowStatus(row.status);
        const percent =
          s === 'SUCCESS' ? 100 : Math.min(100, Math.max(0, row.progress ?? 0));
        return (
          <div className="w-full flex items-center gap-3">
            <Progress
              percent={percent}
              size="small"
              strokeWidth={6}
              showInfo={false}
              status={
                s === 'ERROR'
                  ? 'exception'
                  : s === 'RUNNING'
                    ? 'active'
                    : 'normal'
              }
              className="mb-0 flex-1"
            />
            <span className="text-[10px] font-black text-slate-500 w-8">
              {percent}%
            </span>
          </div>
        );
      },
    },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Spin size="large" />
        <span className="text-slate-400 font-bold uppercase tracking-widest text-xs">
          Loading execution history...
        </span>
      </div>
    );
  }

  if (workflows.length === 0) {
    return (
      <div className="p-12">
        <Empty description="No runs recorded for this catalog" />
      </div>
    );
  }

  return (
    <div className="catalog-runs-dashboard flex flex-col gap-2 p-3 bg-white min-h-full">
      {/* Stat Section - Ultra Compact */}
      <div className="bg-slate-50/50 rounded-xl p-5 mb-1">
        <Row gutter={[24, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title={
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1.5 block">
                  Total Executions
                </span>
              }
              value={stats.total}
              prefix={
                <PlayCircle
                  className="text-slate-900 mr-2"
                  size={18}
                  strokeWidth={2.5}
                />
              }
              valueStyle={{
                fontWeight: 900,
                color: '#0f172a',
                fontSize: '22px',
                lineHeight: 1,
              }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title={
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1.5 block">
                  Success Rate
                </span>
              }
              value={successRate}
              suffix={
                <span className="text-[10px] font-black text-emerald-400 ml-1">
                  %
                </span>
              }
              prefix={
                <CheckCircle
                  className="text-emerald-500 mr-2"
                  size={18}
                  strokeWidth={2.5}
                />
              }
              valueStyle={{
                fontWeight: 900,
                color: '#10b981',
                fontSize: '22px',
                lineHeight: 1,
              }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title={
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1.5 block">
                  Active Now
                </span>
              }
              value={stats.running}
              prefix={
                <Activity
                  className={`text-sky-500 mr-2 ${stats.running > 0 ? 'animate-pulse' : ''}`}
                  size={18}
                  strokeWidth={2.5}
                />
              }
              valueStyle={{
                fontWeight: 900,
                color: stats.running > 0 ? '#0ea5e9' : '#0f172a',
                fontSize: '22px',
                lineHeight: 1,
              }}
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Statistic
              title={
                <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1.5 block">
                  Avg Duration
                </span>
              }
              value={Math.round(stats.avgDuration)}
              suffix={
                <span className="text-[9px] font-black text-slate-300 ml-1">
                  SEC
                </span>
              }
              prefix={
                <Timer
                  className="text-amber-500 mr-2"
                  size={18}
                  strokeWidth={2.5}
                />
              }
              valueStyle={{
                fontWeight: 900,
                color: '#0f172a',
                fontSize: '22px',
                lineHeight: 1,
              }}
            />
          </Col>
        </Row>
      </div>

      {/* Main Table - High Density */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="px-1 py-3 flex justify-between items-center bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-slate-900 flex items-center justify-center">
              <Library size={14} className="text-white" strokeWidth={2.5} />
            </div>
            <div>
              <h4 className="m-0 font-black text-slate-900 text-sm tracking-tight">
                Execution History
              </h4>
              <p className="m-0 text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                Recent runs for this catalog
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 pr-1">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                {stats.success} Success
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-rose-500"></div>
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                {stats.failed} Failed
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0">
          <Table<WorkflowResponse>
            rowKey="id"
            dataSource={workflows}
            columns={columns}
            pagination={{
              pageSize: 15,
              showSizeChanger: true,
              position: ['bottomCenter'],
              className: 'py-4 px-1 !m-0 border-t border-slate-50',
            }}
            size="small"
            className="runs-dashboard-table compact-table [&_.ant-table]:!bg-transparent [&_.ant-table-thead_th]:bg-slate-50/50 [&_.ant-table-thead_th]:text-slate-400 [&_.ant-table-thead_th]:text-[8px] [&_.ant-table-thead_th]:font-black [&_.ant-table-thead_th]:uppercase [&_.ant-table-thead_th]:tracking-widest [&_.ant-table-thead_th]:py-2 [&_.ant-table-cell]:px-1"
          />
        </div>
      </div>
    </div>
  );
}

export default CatalogRunsTable;
