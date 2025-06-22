import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";

import type { RuleStatusResponse, WorkflowListResponse } from "../api/api";
import { Status } from "../api/api";
import { workflowApi } from "../api/client";
import { type DatabaseChangeData, useSSE } from "./useSSE";

const createDebouncer = () => {
  const timeouts = new Map<string, number>();

  return (key: string, fn: () => void, delay: number) => {
    console.log(
      `⏱️ [DEBUG] Debouncer called for key: ${key}, delay: ${delay}ms`,
    );
    const existingTimeout = timeouts.get(key);
    if (existingTimeout) {
      console.log(`🔄 [DEBUG] Clearing existing timeout for key: ${key}`);
      clearTimeout(existingTimeout);
    }

    const timeoutId = setTimeout(() => {
      console.log(`🚀 [DEBUG] Executing debounced function for key: ${key}`);
      fn();
      timeouts.delete(key);
    }, delay);

    timeouts.set(key, timeoutId);
  };
};

const globalDebouncer = createDebouncer();

class EventAggregator {
  private events = new Map<string, Set<string>>();
  private timeouts = new Map<string, number>();

  addEvent(
    type: string,
    workflowId: string,
    callback: () => void,
    delay = 1000,
  ) {
    const key = `${type}_${workflowId}`;

    if (!this.events.has(key)) {
      this.events.set(key, new Set());
    }
    this.events.get(key)!.add(workflowId);

    const existingTimeout = this.timeouts.get(key);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeoutId = setTimeout(() => {
      callback();
      this.events.delete(key);
      this.timeouts.delete(key);
    }, delay);

    this.timeouts.set(key, timeoutId);
  }
}

const eventAggregator = new EventAggregator();

const isSignificantChange = (data: DatabaseChangeData): boolean => {
  if (data.operation === "INSERT" || data.operation === "DELETE") {
    return true;
  }

  if (data.operation === "UPDATE") {
    return data.status_changed === true;
  }

  return false;
};

// Enhanced workflows hook with direct SSE integration and optimization
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
    staleTime: 45000,
    refetchInterval: 90000,
    placeholderData: (previousData) => previousData,
  });

  const sseConnection = useSSE({
    filters: "workflows,jobs",
    onDatabaseChange: (data: DatabaseChangeData) => {
      console.log(
        "📨 [DEBUG] SSE database change received for workflows:",
        data,
      );
      const shouldInvalidate = isSignificantChange(data);
      console.log(
        `🎯 [DEBUG] Should invalidate workflows: ${shouldInvalidate}`,
      );

      if (shouldInvalidate) {
        globalDebouncer(
          "workflows_list",
          () => {
            console.log("🔄 [DEBUG] Invalidating workflows query...");
            const startTime = performance.now();
            queryClient.invalidateQueries({ queryKey: ["workflows"] });
            const endTime = performance.now();
            console.log(
              `✅ [DEBUG] Workflows query invalidated in ${(endTime - startTime).toFixed(2)}ms`,
            );
          },
          1000,
        );
      }
    },
  });

  return {
    ...workflowsQuery,
    sseStatus: sseConnection.status,
    sseError: sseConnection.error,
    isSSEConnected: sseConnection.isConnected,
    sseRetryCount: sseConnection.retryCount,
    reconnectSSE: sseConnection.reconnect,
    disconnectSSE: sseConnection.disconnect,
    latestEvent: sseConnection.data,
  };
};

// Enhanced workflow jobs hook with direct SSE integration and optimization
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
    staleTime: 45000,
    refetchInterval: 90000,
  });

  const sseConnection = useSSE({
    filters: "jobs",
    workflowId: params?.workflowId,
    onJobEvent: (data: DatabaseChangeData) => {
      if (isSignificantChange(data)) {
        eventAggregator.addEvent(
          "jobs",
          params?.workflowId || "",
          () => {
            console.log(
              `🔄 [DEBUG] Invalidating workflow jobs query for workflow: ${params?.workflowId}...`,
            );
            const startTime = performance.now();
            queryClient.invalidateQueries({
              queryKey: ["workflowJobs", params],
            });
            const endTime = performance.now();
            console.log(
              `✅ [DEBUG] Workflow jobs query invalidated in ${(endTime - startTime).toFixed(2)}ms`,
            );
          },
          1000,
        );
      }
    },
  });

  return {
    ...workflowJobsQuery,
    sseStatus: sseConnection.status,
    sseError: sseConnection.error,
    isSSEConnected: sseConnection.isConnected,
    sseRetryCount: sseConnection.retryCount,
    reconnectSSE: sseConnection.reconnect,
    disconnectSSE: sseConnection.disconnect,
    latestEvent: sseConnection.data,
  };
};

// Enhanced workflow progress hook with direct SSE integration and optimization
export const useWorkflowProgressWithSSE = (workflowId: string) => {
  const queryClient = useQueryClient();
  const lastUpdateTimeRef = useRef<number>(0);

  const workflowProgressQuery = useQuery({
    queryKey: ["workflowProgress", workflowId],
    queryFn: async () => {
      const response =
        await workflowApi.getProgressApiV1WorkflowsWorkflowIdProgressGet(
          workflowId,
        );
      return response.data;
    },
    staleTime: 60000,
    refetchInterval: 120000,
    gcTime: 300000,
  });

  const sseConnection = useSSE({
    filters: "jobs",
    workflowId,
    onJobEvent: (data: DatabaseChangeData) => {
      if (!isSignificantChange(data)) {
        return;
      }

      const now = Date.now();
      const timeSinceLastUpdate = now - lastUpdateTimeRef.current;

      if (timeSinceLastUpdate < 3000) {
        return;
      }

      globalDebouncer(
        `progress_${workflowId}`,
        () => {
          console.log(
            `🔄 [DEBUG] Invalidating workflow progress query for workflow: ${workflowId}...`,
          );
          const startTime = performance.now();
          lastUpdateTimeRef.current = Date.now();
          queryClient.invalidateQueries({
            queryKey: ["workflowProgress", workflowId],
          });
          const endTime = performance.now();
          console.log(
            `✅ [DEBUG] Workflow progress query invalidated in ${(endTime - startTime).toFixed(2)}ms`,
          );
        },
        2000,
      );
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

// Enhanced rule status hook with optimization
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
    staleTime: 45000,
    refetchInterval: 90000,
  });

  const sseConnection = useSSE({
    filters: "jobs",
    workflowId,
    onJobEvent: (data: DatabaseChangeData) => {
      if (isSignificantChange(data)) {
        globalDebouncer(
          `rule_status_${workflowId}`,
          () => {
            console.log(
              `🔄 [DEBUG] Invalidating rule status query for workflow: ${workflowId}...`,
            );
            const startTime = performance.now();
            queryClient.invalidateQueries({
              queryKey: ["ruleStatus", workflowId],
            });
            const endTime = performance.now();
            console.log(
              `✅ [DEBUG] Rule status query invalidated in ${(endTime - startTime).toFixed(2)}ms`,
            );
          },
          1500,
        );
      }
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
