import {
  getActivityOptions,
  getRuleErrorOptions,
  getStatusOptions,
  getSystemResourcesOptions,
  getUserSummaryOptions,
} from '@/client/@tanstack/react-query.gen';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

const DASHBOARD_STALE_TIME = 5000;
const DASHBOARD_REFETCH_INTERVAL = 5000;

export const useRunningWorkflows = () => {
  return useQuery({
    ...getStatusOptions({ query: { item: 'workflow' } }),
    staleTime: DASHBOARD_STALE_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
  });
};

export const useRunningJobs = () => {
  return useQuery({
    ...getStatusOptions({ query: { item: 'job' } }),
    staleTime: DASHBOARD_STALE_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
  });
};
export const useRunningUsers = () => {
  return useQuery({
    ...getUserSummaryOptions(),
    staleTime: DASHBOARD_STALE_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
  });
};

// Combined hook for System Resources (CPU + Memory)
export const useSystemResources = () => {
  return useQuery({
    ...getSystemResourcesOptions(),
    staleTime: DASHBOARD_STALE_TIME,
    refetchInterval: DASHBOARD_REFETCH_INTERVAL,
  });
};

// export const useActivity = (
//   type: GetActivityApiV1SummaryActivityGetItemEnum,
//   start: string | null,
//   end: string | null,
//   limit: number,
// ) => {
//   return useQuery<{ [key: string]: number }, Error, Array<[string, number]>>({
//     ...getActivityOptions({query: {item: type, start_at: start, end_at: end, limit: limit}}),
//     select: (data: { [key: string]: number }) =>
//       Object.entries(data).map(([name, count]) => [name, count]),
//     // staleTime: DASHBOARD_STALE_TIME,
//     // refetchInterval: DASHBOARD_REFETCH_INTERVAL,
//     staleTime: Infinity,
//     refetchInterval: false,
//     refetchOnWindowFocus: false,
//     refetchOnReconnect: false,
//     refetchOnMount: false,
//   });
// };

// export const useRuleError = (
//   start: string | null,
//   end: string | null,
//   limit: number,
// ) => {
//   return useQuery({
//     ...getRuleErrorOptions({query: {start_at: start, end_at: end, limit: limit}}),
//     select: (data: GetRuleErrorResponse) => {
//       return Object.entries(data).map(([name, counts]) => ({
//         name: name,
//         total: counts.total,
//         error: counts.error,
//       }));
//     },
//     staleTime: DASHBOARD_STALE_TIME,
//     refetchInterval: DASHBOARD_REFETCH_INTERVAL,
//   });
// };

// export const useRuleDuration = (
//   start: string | null,
//   end: string | null,
//   limit: number,
// ) => {
//   return useQuery<{ [key: string]: { [key: string]: number } }>({
//     queryKey: ["rule-duration", start, end, limit],
//     queryFn: async () => {
//       const response =
//         await summaryApi.getRuleDurationApiV1SummaryRuleDurationGet(
//           start,
//           end,
//           limit,
//         );
//       return response.data;
//     },
//     staleTime: DASHBOARD_STALE_TIME,
//     refetchInterval: DASHBOARD_REFETCH_INTERVAL,
//   });
// };

// export const useDatabasePruning = () => {
//   const queryClient = useQueryClient();
//   return useMutation({
//     mutationFn: async () => {
//       const response = await summaryApi.postPruningApiV1SummaryPruningPost();
//       return response.data;
//     },
//     onSuccess: () => {
//       queryClient.invalidateQueries({ queryKey: ["rule-duration"] });
//       queryClient.invalidateQueries({ queryKey: ["running-workflows"] });
//       queryClient.invalidateQueries({ queryKey: ["running-jobs"] });
//       queryClient.invalidateQueries({ queryKey: ["rule-error"] });
//       queryClient.invalidateQueries({ queryKey: ["activity"] });
//       queryClient.invalidateQueries({ queryKey: ["rule-duration"] });
//     },
//     onError: () => {
//       console.error("Database pruning failed");
//     },
//   });
// };

// // Hook for SSE Connection Status
// export const useSSEStatus = () => {
//   const { data, status, error, isConnected } = useSSE({
//     filters: "workflow,job,rule",
//   });

//   return {
//     isConnected,
//     status,
//     lastMessage: data,
//     error,
//     connectionStatus: isConnected
//       ? "Connected"
//       : error
//         ? "Error"
//         : "Connecting",
//   };
// };

// // Separate hook for tag activity (independent of dashboard updates)
// export const useTagActivity = () => {
//   return useActivity(
//     GetActivityApiV1SummaryActivityGetItemEnum.Tag,
//     null,
//     null,
//     10,
//   );
// };

// Combined hook for all dashboard metrics
export const useDashboardMetrics = () => {
  const workflowStats = useRunningWorkflows();
  const jobStats = useRunningJobs();
  const userStats = useRunningUsers();
  const systemStats = useSystemResources();
  const sseStatus = useSSEStatus();
  const ruleActivity = useQuery({
    ...getActivityOptions({ query: { item: 'rule' } }),
    select: (data: GetActivityResponse) => {
      return Object.entries(data).map(([name, count]) => ({
        name: name,
        count: count,
      }));
    },
  });

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
