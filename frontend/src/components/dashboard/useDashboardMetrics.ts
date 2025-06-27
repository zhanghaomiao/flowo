import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  GetActivityApiV1SummaryActivityGetItemEnum,
  StatusSummary,
  UserSummary,
} from "../../api/api";
import { summaryApi } from "../../api/client";
import { useSSE } from "../../hooks/useSSE";

const DASHBOARD_STALE_TIME = 3000;
const DASHBOARD_REFETCH_INTERVAL = 3000;

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
  return useQuery<{ [key: string]: number }, Error, Array<[string, number]>>({
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
    select: (data: { [key: string]: number }) =>
      Object.entries(data).map(([name, count]) => [name, count]),
    staleTime: DASHBOARD_STALE_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
  });
};

export const useRuleError = (
  start: string | null,
  end: string | null,
  limit: number,
) => {
  return useQuery<
    { [key: string]: { [key: string]: number } },
    Error,
    Array<{ name: string; total: number; error: number }>
  >({
    queryKey: ["rule-error", start, end, limit],
    queryFn: async () => {
      const response = await summaryApi.getRuleErrorApiV1SummaryRuleErrorGet(
        start,
        end,
        limit,
      );
      return response.data;
    },
    select: (data: { [key: string]: { [key: string]: number } }) => {
      const result: { name: string; total: number; error: number }[] = [];
      for (const [name, counts] of Object.entries(data)) {
        result.push({ name, total: counts.total, error: counts.error });
      }
      return result;
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
  return useQuery<{ [key: string]: { [key: string]: number } }>({
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

export const useDatabasePruning = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await summaryApi.postPruningApiV1SummaryPruningPost();
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rule-duration"] });
      queryClient.invalidateQueries({ queryKey: ["running-workflows"] });
      queryClient.invalidateQueries({ queryKey: ["running-jobs"] });
      queryClient.invalidateQueries({ queryKey: ["rule-error"] });
      queryClient.invalidateQueries({ queryKey: ["activity"] });
      queryClient.invalidateQueries({ queryKey: ["rule-duration"] });
    },
    onError: () => {
      console.error("Database pruning failed");
    },
  });
};

// Hook for SSE Connection Status
export const useSSEStatus = () => {
  const { data, status, error, isConnected } = useSSE({
    filters: "workflow,job,rule",
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
  const tagActivity = useActivity(
    GetActivityApiV1SummaryActivityGetItemEnum.Tag,
    null,
    null,
    10,
  );
  const ruleActivity = useActivity(
    GetActivityApiV1SummaryActivityGetItemEnum.Rule,
    null,
    null,
    10,
  );

  const ruleError = useRuleError(null, null, 10);
  const ruleDuration = useRuleDuration(null, null, 10);

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
      loading: workflowStats.isLoading,
      error: workflowStats.error,
    },

    // Running Jobs (running/total)
    runningJobs: {
      running: jobStats.data?.running || 0,
      total: jobStats.data?.total || 0,
      percentage: jobStats.data?.total
        ? Math.round((jobStats.data.running / jobStats.data.total) * 100)
        : 0,
      loading: jobStats.isLoading,
      error: jobStats.error,
    },

    // Complete Workflow Status for Charts
    workflowChartData: {
      success: workflowStats.data?.success || 0,
      running: workflowStats.data?.running || 0,
      error: workflowStats.data?.error || 0,
      total: workflowStats.data?.total || 0,
      loading: workflowStats.isLoading,
      requestError: workflowStats.error,
    },

    // Complete Job Status for Charts
    jobChartData: {
      success: jobStats.data?.success || 0,
      running: jobStats.data?.running || 0,
      error: jobStats.data?.error || 0,
      total: jobStats.data?.total || 0,
      loading: jobStats.isLoading,
      requestError: jobStats.error,
    },

    // Running Users (running/total)
    runningUsers: {
      running: userStats.data?.running || 0,
      total: userStats.data?.total || 0,
      percentage: userStats.data?.total
        ? Math.round((userStats.data.running / userStats.data.total) * 100)
        : 0,
      loading: userStats.isLoading,
      error: userStats.error,
    },

    // CPU Usage (used/total)
    cpuUsage: {
      used:
        (systemStats.data?.cpu_total_cores || 0) -
        (systemStats.data?.cpu_idle_cores || 0),
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
      loading: systemStats.isLoading,
      error: systemStats.error,
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
      loading: systemStats.isLoading,
      error: systemStats.error,
    },

    sseStatus: {
      status: sseStatus.connectionStatus,
      isConnected: sseStatus.isConnected,
      connectionState: sseStatus.status,
      lastMessage: sseStatus.lastMessage,
      error: sseStatus.error,
    },

    tagActivity: {
      data: tagActivity.data || [],
      loading: tagActivity.isLoading,
      error: tagActivity.error,
    },

    ruleActivity: {
      data: ruleActivity.data || [],
      loading: ruleActivity.isLoading,
      error: ruleActivity.error,
    },
    ruleError: {
      data: ruleError.data || {},
      loading: ruleError.isLoading,
      error: ruleError.error,
    },
    ruleDuration: {
      data: ruleDuration.data || {},
      loading: ruleDuration.isLoading,
      error: ruleDuration.error,
    },
  };
};
