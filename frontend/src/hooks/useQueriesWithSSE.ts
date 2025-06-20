import { useQuery, useQueryClient } from "@tanstack/react-query";

import type { RuleStatusResponse, WorkflowListResponse } from "../api/api";
import { Status } from "../api/api";
import { workflowApi } from "../api/client";
import { type DatabaseChangeData, useSSE } from "./useSSE";

// Enhanced workflows hook with direct SSE integration
export const useWorkflowsWithSSE = (params?: {
  limit?: number | null;
  offset?: number | null;
  orderByStarted?: boolean;
  descending?: boolean;
  user?: string | null;
  status?: Status | null;
  tags?: string | null;
  name?: string | null;
  startAt?: string | null;
  endAt?: string | null;
}) => {
  const queryClient = useQueryClient();

  // Use the main workflows query
  const workflowsQuery = useQuery<WorkflowListResponse>({
    queryKey: ["workflows", params],
    queryFn: async () => {
      const response = await workflowApi.getWorkflowsApiV1WorkflowsGet(
        params?.limit ?? 20,
        params?.offset ?? 0,
        params?.orderByStarted ?? true,
        params?.descending ?? true,
        params?.user ?? null,
        params?.status ?? null,
        params?.tags ?? null,
        params?.name ?? null,
        params?.startAt ?? null,
        params?.endAt ?? null,
      );
      return response.data as WorkflowListResponse;
    },
    staleTime: 30000,
    refetchInterval: 60000,
    placeholderData: (previousData) => previousData,
  });

  // Direct SSE connection for database changes
  const sseConnection = useSSE({
    filters: "workflows,jobs",
    onDatabaseChange: (data: DatabaseChangeData) => {
      if (data.table === "workflows") {
        console.log(
          "Workflows table changed, invalidating workflows query:",
          data,
        );
        queryClient.invalidateQueries({ queryKey: ["workflows"] });
      } else if (data.table === "jobs") {
        console.log("Jobs table changed, might affect workflows list:", data);
        queryClient.invalidateQueries({ queryKey: ["workflows"] });
      }
    },
  });

  return {
    ...workflowsQuery,
    // SSE connection data
    sseStatus: sseConnection.status,
    sseError: sseConnection.error,
    isSSEConnected: sseConnection.isConnected,
    sseRetryCount: sseConnection.retryCount,
    reconnectSSE: sseConnection.reconnect,
    disconnectSSE: sseConnection.disconnect,
    latestEvent: sseConnection.data,
  };
};

// Enhanced workflow jobs hook with direct SSE integration
export const useWorkflowJobsWithSSE = (params?: {
  workflowId: string;
  limit?: number | null;
  offset?: number | null;
  orderByStarted?: boolean;
  descending?: boolean;
  status?: Status | null;
  ruleName?: string | null;
}) => {
  const queryClient = useQueryClient();

  // Use the main workflow jobs query
  const workflowJobsQuery = useQuery({
    queryKey: ["workflowJobs", params],
    queryFn: async () => {
      const response = await workflowApi.getJobsApiV1WorkflowsWorkflowIdJobsGet(
        params!.workflowId,
        params?.limit,
        params?.offset,
        params?.orderByStarted,
        params?.descending,
        params?.ruleName,
        params?.status,
      );
      return response.data;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Direct SSE connection for workflow-specific job events
  const sseConnection = useSSE({
    filters: "jobs",
    workflowId: params?.workflowId,
    onJobEvent: (data: DatabaseChangeData) => {
      // Invalidate jobs query when jobs change for this workflow
      console.log(`Job event for workflow ${params?.workflowId}:`, data);
      queryClient.invalidateQueries({ queryKey: ["workflowJobs", params] });
    },
  });

  return {
    ...workflowJobsQuery,
    // SSE connection data
    sseStatus: sseConnection.status,
    sseError: sseConnection.error,
    isSSEConnected: sseConnection.isConnected,
    sseRetryCount: sseConnection.retryCount,
    reconnectSSE: sseConnection.reconnect,
    disconnectSSE: sseConnection.disconnect,
    latestEvent: sseConnection.data,
  };
};

// Enhanced workflow progress hook with direct SSE integration
export const useWorkflowProgressWithSSE = (workflowId: string) => {
  const queryClient = useQueryClient();

  const workflowProgressQuery = useQuery({
    queryKey: ["workflowProgress", workflowId],
    queryFn: async () => {
      const response =
        await workflowApi.getProgressApiV1WorkflowsWorkflowIdProgressGet(
          workflowId,
        );
      return response.data;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  // Direct SSE connection for workflow-specific job events
  const sseConnection = useSSE({
    filters: "jobs",
    workflowId,
    onJobEvent: (data: DatabaseChangeData) => {
      // Invalidate progress query when jobs change for this workflow
      console.log(`Job progress update for workflow ${workflowId}:`, data);
      queryClient.invalidateQueries({
        queryKey: ["workflowProgress", workflowId],
      });
    },
  });

  return {
    ...workflowProgressQuery,
    sseStatus: sseConnection.status,
    sseError: sseConnection.error,
    isSSEConnected: sseConnection.isConnected,
    sseRetryCount: sseConnection.retryCount,
    reconnectSSE: sseConnection.reconnect,
    disconnectSSE: sseConnection.disconnect,
    latestEvent: sseConnection.data,
  };
};

export const useRuleStatusWithSSE = (workflowId: string) => {
  const queryClient = useQueryClient();

  const ruleStatusQuery = useQuery<{ [key: string]: RuleStatusResponse }>({
    queryKey: ["ruleStatus", workflowId],
    queryFn: async () => {
      const response =
        await workflowApi.getRuleStatusApiV1WorkflowsWorkflowIdRuleStatusGet(
          workflowId,
        );
      return response.data as { [key: string]: RuleStatusResponse };
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const sseConnection = useSSE({
    filters: "jobs",
    workflowId,
    onJobEvent: (data: DatabaseChangeData) => {
      console.log(`Rule status update for workflow ${workflowId}:`, data);
      queryClient.invalidateQueries({ queryKey: ["ruleStatus", workflowId] });
    },
  });

  return {
    ...ruleStatusQuery,
    sseStatus: sseConnection.status,
    sseError: sseConnection.error,
    isSSEConnected: sseConnection.isConnected,
    sseRetryCount: sseConnection.retryCount,
    reconnectSSE: sseConnection.reconnect,
    disconnectSSE: sseConnection.disconnect,
    latestEvent: sseConnection.data,
  };
};
