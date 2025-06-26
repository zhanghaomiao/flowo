import { useQuery } from "@tanstack/react-query";

import {
  GetActivityApiV1SummaryActivityGetItemEnum,
  StatusSummary,
  UserSummary,
} from "../../api/api";
import { summaryApi } from "../../api/client";
import { useSSE } from "../../hooks/useSSE";

const DASHBOARD_STALE_TIME = 3000;
const DASHBOARD_REFETCH_INTERVAL = false;

// Hook for Running Workflows (running/total)
export const useRunningWorkflows = () => {
  return useQuery<StatusSummary>({
    queryKey: ["running-workflows"],
    queryFn: async () => {
      const response =
        await summaryApi.getStatusApiV1SummaryStatusGet("workflow");
      return response.data;
    },
    staleTime: DASHBOARD_STALE_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
  });
};

// Hook for Running Jobs (running/total)
export const useRunningJobs = () => {
  return useQuery<StatusSummary>({
    queryKey: ["running-jobs"],
    queryFn: async () => {
      const response = await summaryApi.getStatusApiV1SummaryStatusGet("job");
      return response.data;
    },
    staleTime: DASHBOARD_STALE_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
  });
};

// Hook for Running Users (running/total)
export const useRunningUsers = () => {
  return useQuery<UserSummary>({
    queryKey: ["running-users"],
    queryFn: async () => {
      const response = await summaryApi.getUserSummaryApiV1SummaryUserGet();
      return response.data;
    },
    staleTime: DASHBOARD_STALE_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
  });
};

// Combined hook for System Resources (CPU + Memory)
export const useSystemResources = () => {
  return useQuery<{ [key: string]: number }>({
    queryKey: ["system-resources"],
    queryFn: async () => {
      const response =
        await summaryApi.getSystemResourcesApiV1SummaryResourcesGet();
      return response.data;
    },
    staleTime: DASHBOARD_STALE_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
  });
};

export const useActivity = (
  type: GetActivityApiV1SummaryActivityGetItemEnum,
  start: string | null,
  end: string | null,
  limit: number,
) => {
  return useQuery<{ [key: string]: number }>({
    queryKey: ["activity", start, end, limit, type],
    queryFn: async () => {
      const response = await summaryApi.getActivityApiV1SummaryActivityGet(
        type,
        start,
        end,
        limit,
      );
      return response.data;
    },
    staleTime: DASHBOARD_STALE_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
  });
};

export const useRuleError = (
  start: string | null,
  end: string | null,
  limit: number,
) => {
  return useQuery<{ [key: string]: { [key: string]: number } }>({
    queryKey: ["rule-error", start, end, limit],
    queryFn: async () => {
      const response = await summaryApi.getRuleErrorApiV1SummaryRuleErrorGet(
        start,
        end,
        limit,
      );
      return response.data;
    },
    staleTime: DASHBOARD_STALE_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
  });
};

export const useRuleDuration = (
  start: string | null,
  end: string | null,
  limit: number,
) => {
  return useQuery<{ [key: string]: number[] }>({
    queryKey: ["rule-duration", start, end, limit],
    queryFn: async () => {
      const response =
        await summaryApi.getRuleDurationApiV1SummaryRuleDurationGet(
          start,
          end,
          limit,
        );
      return response.data;
    },
    staleTime: DASHBOARD_STALE_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
  });
};

// Hook for SSE Connection Status
export const useSSEStatus = () => {
  const { data, status, error, isConnected } = useSSE({
    filters: "workflow,job",
  });

  return {
    isConnected,
    status,
    lastMessage: data,
    error,
    connectionStatus: isConnected
      ? "Connected"
      : error
        ? "Error"
        : "Connecting",
  };
};

// Combined hook for all dashboard metrics
export const useDashboardMetrics = () => {
  const workflowStats = useRunningWorkflows();
  const jobStats = useRunningJobs();
  const userStats = useRunningUsers();
  const systemStats = useSystemResources();
  const sseStatus = useSSEStatus();

  const isLoading =
    workflowStats.isLoading ||
    jobStats.isLoading ||
    userStats.isLoading ||
    systemStats.isLoading;

  const error =
    workflowStats.error ||
    jobStats.error ||
    userStats.error ||
    systemStats.error ||
    sseStatus.error;

  return {
    // Running Workflows (running/total)
    runningWorkflows: {
      running: workflowStats.data?.running || 0,
      total: workflowStats.data?.total || 0,
      percentage: workflowStats.data?.total
        ? Math.round(
            (workflowStats.data.running / workflowStats.data.total) * 100,
          )
        : 0,
    },

    // Running Jobs (running/total)
    runningJobs: {
      running: jobStats.data?.running || 0,
      total: jobStats.data?.total || 0,
      percentage: jobStats.data?.total
        ? Math.round((jobStats.data.running / jobStats.data.total) * 100)
        : 0,
    },

    // Complete Workflow Status for Charts
    workflowChartData: {
      success: workflowStats.data?.success || 0,
      running: workflowStats.data?.running || 0,
      error: workflowStats.data?.error || 0,
      total: workflowStats.data?.total || 0,
    },

    // Complete Job Status for Charts
    jobChartData: {
      success: jobStats.data?.success || 0,
      running: jobStats.data?.running || 0,
      error: jobStats.data?.error || 0,
      total: jobStats.data?.total || 0,
    },

    // Running Users (running/total)
    runningUsers: {
      running: userStats.data?.running || 0,
      total: userStats.data?.total || 0,
      percentage: userStats.data?.total
        ? Math.round((userStats.data.running / userStats.data.total) * 100)
        : 0,
    },

    // CPU Usage (used/total)
    cpuUsage: {
      used:
        systemStats.data?.cpu_total_cores && systemStats.data?.cpu_idle_cores
          ? Math.round(
              (systemStats.data.cpu_total_cores -
                systemStats.data.cpu_idle_cores) *
                100,
            ) / 100
          : 0,
      total: systemStats.data?.cpu_total_cores || 0,
      idle: systemStats.data?.cpu_idle_cores || 0,
      percentage:
        systemStats.data?.cpu_total_cores && systemStats.data?.cpu_idle_cores
          ? Math.round(
              ((systemStats.data.cpu_total_cores -
                systemStats.data.cpu_idle_cores) /
                systemStats.data.cpu_total_cores) *
                100,
            )
          : 0,
    },

    // Memory Usage (used/total)
    memoryUsage: {
      used:
        systemStats.data?.mem_total_GB && systemStats.data?.mem_available_GB
          ? Math.round(
              (systemStats.data.mem_total_GB -
                systemStats.data.mem_available_GB) *
                100,
            ) / 100
          : 0,
      total: systemStats.data?.mem_total_GB || 0,
      left: systemStats.data?.mem_available_GB || 0,
      percentage:
        systemStats.data?.mem_total_GB && systemStats.data?.mem_available_GB
          ? Math.round(
              ((systemStats.data.mem_total_GB -
                systemStats.data.mem_available_GB) /
                systemStats.data.mem_total_GB) *
                100,
            )
          : 0,
    },

    // SSE Status
    sseStatus: {
      status: sseStatus.connectionStatus,
      isConnected: sseStatus.isConnected,
      connectionState: sseStatus.status,
      lastMessage: sseStatus.lastMessage,
    },

    // Loading and error states
    isLoading,
    error,
  };
};
