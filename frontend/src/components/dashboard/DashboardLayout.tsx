import React, { useMemo, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';
import { Button, message, Popconfirm, Select } from 'antd';
import {
  Activity,
  Cpu,
  Database,
  Layers,
  Play,
  RefreshCcw,
  Server,
  Tag,
  Trash2,
  Wifi,
} from 'lucide-react';

import { useAuth } from '@/auth';
import {
  listUsersOptions,
  postPruningMutation,
  useGetActivityQuery,
  useGetRuleDurationQuery,
  useGetRuleErrorQuery,
  useGetStatusQuery,
  useGetSystemHealthQuery,
  useGetSystemResourcesQuery,
} from '@/client/@tanstack/react-query.gen';

import { BoxPlot, StackedBarChart, WordCloud } from './Chart';
import { StatusChart } from './StatusChart';

// --- Shared Components for Dashboard ---

const StatCard = ({
  title,
  value,
  icon: Icon,
  colorClass,
  loading,
  error,
}: {
  title: string;
  value: React.ReactNode;
  icon: React.ElementType;
  colorClass: string;
  loading?: boolean;
  error?: unknown;
}) => (
  <div className="flex min-h-[100px] flex-col justify-between rounded-[16px] border border-brand-100/60 bg-white p-3 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
    <div className="flex items-start justify-between">
      <div className="rounded-xl border border-brand-100 bg-brand-50 p-2.5">
        <Icon size={20} className={colorClass.replace('bg-', 'text-')} />
      </div>
      {!!error && (
        <div className="rounded-lg bg-rose-50 px-2 py-1 text-[10px] font-bold uppercase text-rose-500">
          Error
        </div>
      )}
    </div>
    <div className="mt-4">
      <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-brand-800/80">
        {title}
      </div>
      <div className="text-3xl font-black tracking-tight text-slate-900">
        {loading ? (
          <span className="animate-pulse opacity-50">...</span>
        ) : (
          value
        )}
      </div>
    </div>
  </div>
);

const ResourceCard = ({
  title,
  icon: Icon,
  current,
  total,
  unit,
  percent,
  color,
}: {
  title: string;
  icon: React.ElementType;
  current: number;
  total: number;
  unit: string;
  percent: number;
  color: string;
}) => (
  <div className="flex min-h-[100px] flex-col justify-between rounded-[16px] border border-brand-100/60 bg-white p-3 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-brand-800/85">
        <Icon size={16} className="text-brand-600" /> {title}
      </div>
      <span className={`text-xs font-black ${color.replace('bg-', 'text-')}`}>
        {current}/{total} {unit}
      </span>
    </div>
    <div className="flex flex-col gap-2">
      <div className="h-3 w-full overflow-hidden rounded-full bg-brand-50 p-0.5">
        <div
          className={`h-full ${color} rounded-full shadow-sm transition-all duration-1000 ease-out`}
          style={{ width: `${Math.min(100, percent)}%` }}
        />
      </div>
      <div className="flex items-center justify-between px-1">
        <div className="text-[10px] font-bold text-brand-700/45">
          UTILIZATION
        </div>
        <div className="text-[10px] font-black text-brand-800/70">
          {Math.round(percent)}%
        </div>
      </div>
    </div>
  </div>
);

export const DashboardLayout: React.FC = () => {
  const { user } = useAuth();
  const isAdmin = user?.is_superuser;
  const queryClient = useQueryClient();
  const search = useSearch({
    strict: false,
  }) as { target_user_id?: string };
  const [targetUserId, setTargetUserId] = useState<string | undefined>(
    search.target_user_id,
  );

  const [messageApi, contextHolder] = message.useMessage();
  const [isReloading, setIsReloading] = useState(false);

  const { data: usersData } = useQuery({
    ...listUsersOptions({}),
    enabled: !!isAdmin,
  });

  const queryParams = { target_user_id: targetUserId };

  const runningWorkflows = useGetStatusQuery({
    query: { item: 'workflow', ...queryParams },
  });
  const runningJobs = useGetStatusQuery({
    query: { item: 'job', ...queryParams },
  });
  const tagActivity = useGetActivityQuery({
    query: { item: 'tag', ...queryParams },
  });
  const ruleActivity = useGetActivityQuery({
    query: { item: 'rule', ...queryParams },
  });
  const ruleError = useGetRuleErrorQuery({
    query: { limit: 10, ...queryParams },
  });
  const ruleDuration = useGetRuleDurationQuery({
    query: { limit: 10, ...queryParams },
  });

  const databasePruning = useMutation(postPruningMutation());
  const { data: systemResourcesData } = useGetSystemResourcesQuery();
  const { data: systemHealthData, isLoading: isSystemHealthLoading } =
    useGetSystemHealthQuery();

  const handleReload = async () => {
    setIsReloading(true);
    try {
      await queryClient.invalidateQueries();
      message.success('Dashboard refreshed');
    } catch {
      message.error('Failed to reload dashboard');
    } finally {
      setIsReloading(false);
    }
  };

  const handleDatabasePruning = async () => {
    try {
      const data = await databasePruning.mutateAsync({});
      messageApi.success(
        `Pruning complete: Deleted ${data.workflow} runs and updated ${data.job} jobs.`,
      );
    } catch {
      messageApi.error('Database pruning failed');
    }
  };

  const workflowChartData = useMemo(
    () => ({
      success: runningWorkflows.data?.success || 0,
      running: runningWorkflows.data?.running || 0,
      error: runningWorkflows.data?.error || 0,
      total: runningWorkflows.data?.total || 0,
    }),
    [runningWorkflows.data],
  );

  const jobChartData = useMemo(
    () => ({
      success: runningJobs.data?.success || 0,
      running: runningJobs.data?.running || 0,
      error: runningJobs.data?.error || 0,
      total: runningJobs.data?.total || 0,
    }),
    [runningJobs.data],
  );

  const tagActivityData = useMemo(
    () =>
      Object.entries(tagActivity.data || {}).map(([name, value]) => ({
        name,
        value: value as number,
      })),
    [tagActivity.data],
  );

  const ruleActivityForWordCloud = useMemo(
    () =>
      Object.entries(ruleActivity.data || {}).map(([name, value]) => ({
        name,
        value: value as number,
      })),
    [ruleActivity.data],
  );

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f8fafc] font-sans selection:bg-brand-100 selection:text-brand-900">
      {contextHolder}

      <div className="px-8 py-6 space-y-6 w-full">
        {/* Modern Header Integration */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-2">
          <div>
            <h1 className="m-0 text-4xl font-black tracking-tight text-slate-900">
              Dashboard
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {isAdmin && (
              <div className="bg-white px-4 h-11 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 hover:border-slate-300 transition-colors">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">
                  Analyze User
                </span>
                <Select
                  placeholder="System-wide"
                  className="w-48 font-bold"
                  variant="borderless"
                  allowClear
                  showSearch
                  optionFilterProp="label"
                  value={targetUserId}
                  onChange={setTargetUserId}
                  options={[
                    { label: 'All Users (System-wide)', value: undefined },
                    ...(usersData || []).map((u) => ({
                      label: u.email,
                      value: u.id,
                    })),
                  ]}
                />
              </div>
            )}
            <Button
              icon={
                <RefreshCcw
                  size={16}
                  className={isReloading ? 'animate-spin' : ''}
                />
              }
              onClick={handleReload}
              className="h-11 px-5 rounded-2xl bg-white border-slate-200 text-slate-600 font-bold hover:bg-slate-50 shadow-sm flex items-center gap-2"
            >
              Refresh
            </Button>
            <Popconfirm
              title="System Pruning"
              description="Clean up dangling run records? This action is permanent."
              onConfirm={handleDatabasePruning}
              okText="Prune"
              cancelText="Cancel"
              okButtonProps={{
                danger: true,
                className: 'rounded-xl font-bold',
              }}
            >
              <Button
                danger
                icon={<Trash2 size={16} />}
                className="h-11 px-5 rounded-2xl font-bold flex items-center gap-2 shadow-sm"
              >
                Prune
              </Button>
            </Popconfirm>
          </div>
        </div>

        {/* Key Performance Indicators Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            title="Running workflows"
            value={runningWorkflows.data?.running || 0}
            icon={Activity}
            colorClass="bg-brand-600"
            loading={runningWorkflows.isLoading}
            error={runningWorkflows.error}
          />
          <StatCard
            title="Running jobs"
            value={runningJobs.data?.running || 0}
            icon={Play}
            colorClass="bg-brand-700"
            loading={runningJobs.isLoading}
            error={runningJobs.error}
          />
          <ResourceCard
            title="CPU Resource"
            icon={Cpu}
            current={Math.round(
              (systemResourcesData?.cpu_total_cores || 0) -
                (systemResourcesData?.cpu_idle_cores || 0),
            )}
            total={Math.round(systemResourcesData?.cpu_total_cores || 8)}
            unit="cores"
            percent={
              (((systemResourcesData?.cpu_total_cores || 0) -
                (systemResourcesData?.cpu_idle_cores || 0)) /
                (systemResourcesData?.cpu_total_cores || 1)) *
              100
            }
            color="bg-brand-500"
          />
          <ResourceCard
            title="Memory Usage"
            icon={Server}
            current={Math.round(
              (systemResourcesData?.mem_total_GB || 0) -
                (systemResourcesData?.mem_available_GB || 0),
            )}
            total={Math.round(systemResourcesData?.mem_total_GB || 16)}
            unit="GB"
            percent={
              (((systemResourcesData?.mem_total_GB || 0) -
                (systemResourcesData?.mem_available_GB || 0)) /
                (systemResourcesData?.mem_total_GB || 1)) *
              100
            }
            color="bg-brand-500"
          />
          <StatCard
            title="Database"
            value={
              systemHealthData?.database.status === 'healthy'
                ? 'HEALTHY'
                : 'ERROR'
            }
            icon={Database}
            colorClass={
              systemHealthData?.database.status === 'healthy'
                ? 'bg-brand-500'
                : 'bg-rose-500'
            }
            loading={isSystemHealthLoading}
          />
          <StatCard
            title="SSE Connection"
            value={
              systemHealthData?.sse.status === 'healthy' ? 'ACTIVE' : 'OFFLINE'
            }
            icon={Wifi}
            colorClass={
              systemHealthData?.sse.status === 'healthy'
                ? 'bg-brand-500'
                : 'bg-rose-500'
            }
            loading={isSystemHealthLoading}
          />
        </div>

        {/* Multi-Column Analytics Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Distribution Section (Row 1 of Analytics) */}
          <div className="lg:col-span-3 bg-white border border-slate-100 rounded-[16px] p-4 shadow-sm flex flex-col min-h-[240px]">
            <h3 className="text-xs font-black text-slate-800 mb-3 flex items-center gap-2">
              <Activity size={14} className="text-brand-600" />
              Run status
            </h3>
            <div className="flex-1 flex items-center justify-center">
              <StatusChart
                title=""
                data={workflowChartData}
                loading={runningWorkflows.isLoading}
              />
            </div>
          </div>

          <div className="lg:col-span-3 bg-white border border-slate-100 rounded-[16px] p-4 shadow-sm flex flex-col min-h-[300px]">
            <h3 className="text-xs font-black text-slate-800 mb-3 flex items-center gap-2">
              <Play size={14} className="text-brand-600" />
              Job Status
            </h3>
            <div className="flex-1 flex items-center justify-center">
              <StatusChart
                title=""
                data={jobChartData}
                loading={runningJobs.isLoading}
              />
            </div>
          </div>

          <div className="lg:col-span-3 bg-white border border-slate-100 rounded-[16px] p-4 shadow-sm flex flex-col min-h-[300px]">
            <h3 className="mb-1 flex items-center gap-2 text-xs font-black text-slate-800">
              <Layers size={14} className="text-brand-600" />
              Top rules
            </h3>
            <p className="mb-3 text-[10px] font-medium leading-snug text-slate-500">
              Successful jobs per rule (recent activity)
            </p>
            <div className="flex flex-1 items-center justify-center">
              <WordCloud data={ruleActivityForWordCloud} />
            </div>
          </div>

          <div className="lg:col-span-3 bg-white border border-slate-100 rounded-[16px] p-4 shadow-sm flex flex-col min-h-[300px]">
            <h3 className="text-xs font-black text-slate-800 mb-3 flex items-center gap-2">
              <Tag size={14} className="text-amber-500" />
              Tag Cloud
            </h3>
            <div className="flex-1 flex items-center justify-center">
              <WordCloud data={tagActivityData} />
            </div>
          </div>

          {/* Detailed Analytics Section (Row 2 of Analytics) */}
          <div className="lg:col-span-4 bg-white border border-slate-100 rounded-[16px] p-4 shadow-sm min-h-[280px]">
            <h3 className="mb-1 flex items-center gap-2 text-xs font-black text-slate-800">
              <Activity size={14} className="text-rose-500" />
              Errors by rule
            </h3>
            <p className="mb-3 text-[10px] font-medium leading-snug text-slate-500">
              Rules with at least one failed job; bars show successful vs failed
              job counts (ordered by error share).
            </p>
            <StackedBarChart
              data={Object.entries(ruleError.data || {}).map(
                ([name, value]) => {
                  const val = value as { total?: number; error?: number };
                  return { name, total: val.total || 0, error: val.error || 0 };
                },
              )}
            />
          </div>

          <div className="lg:col-span-8 bg-white border border-slate-100 rounded-[16px] p-4 shadow-sm min-h-[280px]">
            <h3 className="mb-1 flex items-center gap-2 text-xs font-black text-slate-800">
              <Server size={14} className="text-brand-600" />
              Execution latency
            </h3>
            <p className="mb-3 text-[10px] font-medium leading-snug text-slate-500">
              Successful jobs only. Axis values are{' '}
              <span className="font-semibold text-slate-600">
                ln(minutes + 1)
              </span>{' '}
              (natural log of wall-clock duration in minutes plus one), not raw
              minutes.
            </p>
            <BoxPlot data={ruleDuration.data} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;
