import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import type { RuleStatusResponse, WorkflowListResponse } from "../api/api";
import { Status } from "../api/api";
import { workflowApi } from "../api/client";
import { type DatabaseChangeData } from "./useSSE";
import { useSharedSSE } from "./useSSEManager.tsx";

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
    refetchInterval: 300000,
    placeholderData: (previousData) => previousData,
  });

  // Stable callback for SSE events
  const handleWorkflowsEvent = useCallback(
    (data: DatabaseChangeData) => {
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
    [queryClient],
  );

  // Use shared SSE connection
  const { status: sseStatus, isConnected } = useSharedSSE("workflows_list", {
    filters: "workflows,jobs",
    onEvent: handleWorkflowsEvent,
  });

  return {
    ...workflowsQuery,
    sseStatus,
    sseError: null,
    isSSEConnected: isConnected,
  };
};

// Enhanced workflow jobs hook with shared SSE connection
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
    refetchInterval: 300000,
  });

  // Stable callback for SSE events
  const handleJobEvent = useCallback(
    (data: DatabaseChangeData) => {
      if (isSignificantChange(data)) {
        eventAggregator.addEvent(
          "jobs",
          params?.workflowId || "",
          () => {
            console.log(
              `🔄 [DEBUG] Invalidating workflow jobs query for workflow: ${params?.workflowId}...`,
            );
            queryClient.invalidateQueries({
              queryKey: ["workflowJobs", params],
            });
          },
          500,
        );
      }
    },
    [params?.workflowId, queryClient, params],
  );

  // Use shared SSE connection
  const { status: sseStatus, isConnected } = useSharedSSE(
    `workflowJobs-${params?.workflowId}`,
    {
      filters: "jobs",
      workflowId: params?.workflowId,
      onEvent: handleJobEvent,
    },
  );

  return {
    ...workflowJobsQuery,
    sseStatus,
    sseError: null,
    isSSEConnected: isConnected,
  };
};

// Enhanced workflow progress hook with shared SSE connection
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
    staleTime: 45000,
    refetchInterval: 300000,
  });

  // Stable callback for SSE events
  const handleProgressEvent = useCallback(
    (data: DatabaseChangeData) => {
      if (isSignificantChange(data)) {
        eventAggregator.addEvent(
          "progress",
          workflowId,
          () => {
            console.log(
              `🔄 [DEBUG] Invalidating workflow progress query for workflow: ${workflowId}...`,
            );
            queryClient.invalidateQueries({
              queryKey: ["workflowProgress", workflowId],
            });
          },
          500,
        );
      }
    },
    [workflowId, queryClient],
  );

  // Use shared SSE connection
  const { status: sseStatus, isConnected } = useSharedSSE(
    `workflowProgress-${workflowId}`,
    {
      filters: "jobs",
      workflowId,
      onEvent: handleProgressEvent,
    },
  );

  return {
    ...workflowProgressQuery,
    sseStatus,
    sseError: null,
    isSSEConnected: isConnected,
  };
};

// Enhanced rule status hook with shared SSE connection
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
    refetchInterval: 300000,
  });

  // Stable callback for SSE events
  const handleRuleStatusEvent = useCallback(
    (data: DatabaseChangeData) => {
      if (isSignificantChange(data)) {
        eventAggregator.addEvent(
          "ruleStatus",
          workflowId,
          () => {
            console.log(
              `🔄 [DEBUG] Invalidating rule status query for workflow: ${workflowId}...`,
            );
            queryClient.invalidateQueries({
              queryKey: ["ruleStatus", workflowId],
            });
          },
          500,
        );
      }
    },
    [workflowId, queryClient],
  );

  // Use shared SSE connection
  const { status: sseStatus, isConnected } = useSharedSSE(
    `ruleStatus-${workflowId}`,
    {
      filters: "jobs",
      workflowId,
      onEvent: handleRuleStatusEvent,
    },
  );

  return {
    ...ruleStatusQuery,
    sseStatus,
    sseError: null,
    isSSEConnected: isConnected,
  };
};
