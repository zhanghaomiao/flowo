import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { JobDetailResponse, TreeDataNode } from "../api/api";
import { Status, WorkflowDetialResponse } from "../api/api";
import {
  jobsApi,
  logsApi,
  outputsApi,
  utilsApi,
  workflowApi,
} from "../api/client";
import { constructApiUrl } from "../api/client";

// Extended TreeDataNode interface with fileSize for Caddy server
interface CaddyTreeDataNode extends TreeDataNode {
  fileSize?: number | null;
}

// Custom hook for fetching workflows with pagination support
export const useWorkflows = (params?: {
  limit?: number | null;
  offset?: number | null;
  orderByStarted?: boolean;
  descending?: boolean;
  user?: string | null;
  status?: Status | null;
  name?: string | null;
  tags?: string | null;
  startedAt?: string | null;
  endAt?: string | null;
}) => {
  return useQuery({
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
        params?.startedAt ?? null,
        params?.endAt ?? null,
      );
      return response.data;
    },
    staleTime: 30000, // Data is fresh for 30 seconds
    refetchInterval: 60000, // Refetch every minute
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  });
};

// Custom hook for deleting workflows (IMPROVED VERSION)
export const useDeleteWorkflow = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (workflowId: string) => {
      const response =
        await workflowApi.deleteWorkflowApiV1WorkflowsWorkflowIdDelete(
          workflowId,
        );
      return response.data;
    },
    onSuccess: () => {
      // Invalidate and refetch workflow queries after successful deletion
      queryClient.invalidateQueries({ queryKey: ["sse", "workflows"] });
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
    onError: (error, workflowId) => {
      console.error(`Error deleting workflow ${workflowId}:`, error);
    },
  });
};

// Custom hook for fetching workflows with pagination (for table)
export const useWorkflowsPaginated = (
  page: number = 1,
  pageSize: number = 20,
  orderByStarted: boolean = true,
  descending: boolean = true,
) => {
  const offset = (page - 1) * pageSize;

  return useQuery({
    queryKey: [
      "workflows",
      "paginated",
      { page, pageSize, orderByStarted, descending },
    ],
    queryFn: async () => {
      const response = await workflowApi.getWorkflowsApiV1WorkflowsGet(
        pageSize,
        offset,
        orderByStarted,
        descending,
      );
      return response.data;
    },
    staleTime: 30000,
    placeholderData: (previousData) => previousData,
  });
};

export const useWorkflowTotalJobs = (workflowId: string) => {
  return useQuery<{ total: number }>({
    queryKey: ["workflowTotalJobs", workflowId],
    queryFn: async () => {
      const response =
        await workflowApi.getProgressApiV1WorkflowsWorkflowIdProgressGet(
          workflowId,
          true,
        );
      return response.data as { total: number };
    },
  });
};

// Custom hook for fetching a specific job
export const useJob = (jobId: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ["job", jobId],
    queryFn: async () => {
      const response = await jobsApi.getJobApiV1JobsJobIdDetailGet(jobId);
      return response.data;
    },
    enabled, // Only fetch when enabled is true
    staleTime: 30000,
  });
};

// Custom hook for fetching job files - Note: This API endpoint may not exist
export const useJobFiles = (jobId: number) => {
  return useQuery({
    queryKey: ["jobFiles", jobId],
    queryFn: async () => {
      // This endpoint may not be available in the current API
      throw new Error("Job files endpoint not available");
    },
    enabled: false, // Disabled since endpoint doesn't exist
    staleTime: 30000,
  });
};

// Custom hook for fetching workflow jobs
export const useWorkflowJobs = (
  workflowId: string,
  limit: number | null = null,
  offset: number | null = null,
  orderByStarted: boolean = true,
  descending: boolean = true,
  ruleName: string | null = null,
  status: Status | null = null,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: [
      "workflowJobs",
      workflowId,
      { limit, offset, orderByStarted, descending, ruleName, status },
    ],
    queryFn: async () => {
      const response = await workflowApi.getJobsApiV1WorkflowsWorkflowIdJobsGet(
        workflowId,
        limit,
        offset,
        orderByStarted,
        descending,
        ruleName, // ruleName
        status as Status, // status
      );
      return response.data;
    },
    staleTime: 30000,
    refetchInterval: 60000,
    enabled,
  });
};

// Custom hook for fetching workflow rule graph
export const useWorkflowRuleGraph = (
  workflowId: string,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["workflowRuleGraph", workflowId],
    queryFn: async () => {
      const response =
        await workflowApi.getRuleGraphApiV1WorkflowsWorkflowIdRuleGraphGet(
          workflowId,
        );
      return response.data;
    },
    enabled,
    staleTime: 300000, // Rule graph is relatively static, cache for 5 minutes
  });
};

// Custom hook for fetching workflow Snakefile content
export const useWorkflowSnakefile = (
  workflowId: string,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["workflowSnakefile", workflowId],
    queryFn: async () => {
      const response =
        await workflowApi.getSnakefileApiV1WorkflowsWorkflowIdSnakefileGet(
          workflowId,
        );
      return response.data;
    },
    enabled,
    staleTime: 300000, // Snakefile content is static, cache for 5 minutes
  });
};

export const useWorkFlowUsers = () => {
  return useQuery({
    queryKey: ["workflowUsers"],
    queryFn: async () => {
      const response = await workflowApi.getAllUsersApiV1WorkflowsUsersGet();
      return response.data;
    },
  });
};

export const useWorkflowLogs = (
  workflowId: string,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["workflowLogs", workflowId],
    queryFn: async () => {
      const response =
        await logsApi.getWorkflowLogsApiV1LogsWorkflowIdGet(workflowId);
      return response.data;
    },
    enabled,
  });
};

// Custom hook for fetching a single workflow
export const useWorkflow = (workflowId: string) => {
  return useQuery({
    queryKey: ["workflow", workflowId],
    queryFn: async () => {
      // Get the workflow by searching for it with ID
      const response = await workflowApi.getWorkflowsApiV1WorkflowsGet(
        1, // limit: only get 1 workflow
        0, // offset: start from beginning
        true, // orderByStarted
        true, // descending
        null, // user
        null, // status
      );
      // Find the workflow with matching ID
      const workflow = response.data.workflows?.find(
        (w) => w.id === workflowId,
      );
      return workflow || null; // Return null instead of undefined if not found
    },
    staleTime: 30000,
    refetchInterval: (query) => {
      // Only refetch if workflow is running, otherwise use static data
      const workflow = query.state.data;
      return workflow?.status === "RUNNING" || workflow?.status === "WAITING"
        ? 60000
        : false;
    },
  });
};

export const useWorkflowTimeline = (workflowId: string) => {
  return useQuery({
    queryKey: ["workflowTimeline", workflowId],
    queryFn: async () => {
      const response =
        await workflowApi.getTimelinesApiV1WorkflowsWorkflowIdTimelinesGet(
          workflowId,
        );
      return response.data;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
};

export const useWorkflowConfig = (
  workflowId: string,
  enabled: boolean = true,
) => {
  return useQuery({
    queryKey: ["workflowConfig", workflowId],
    queryFn: async () => {
      const response =
        await workflowApi.getConfigfilesApiV1WorkflowsWorkflowIdConfigfilesGet(
          workflowId,
        );
      return response.data;
    },
    enabled,
  });
};

export const useJobDetail = (jobId: number, enabled: boolean = true) => {
  return useQuery<JobDetailResponse>({
    queryKey: ["jobDetail", jobId],
    queryFn: async () => {
      const response = await jobsApi.getJobApiV1JobsJobIdDetailGet(jobId);
      return response.data as JobDetailResponse;
    },
    staleTime: 30000,
    refetchInterval: 60000,
    enabled,
  });
};

export const useJobLogs = (jobId: number, enabled: boolean = true) => {
  return useQuery<Record<string, string>>({
    queryKey: ["jobLogs", jobId],
    queryFn: async () => {
      const response = await jobsApi.getLogsApiV1JobsJobIdLogsGet(jobId);
      return response.data as Record<string, string>;
    },
    enabled,
    staleTime: 30000,
    refetchInterval: 60000,
  });
};

export const useAllTags = () => {
  return useQuery<string[]>({
    queryKey: ["allTags"],
    queryFn: async () => {
      const response = await utilsApi.getAllTagsApiV1UtilsTagsGet();
      return response.data as string[];
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
};

export const useOutPutsTree = (workflowId: string, depth: number = 2) => {
  return useQuery<Array<TreeDataNode>>({
    queryKey: ["outputsTree", workflowId, depth],
    queryFn: async () => {
      const response =
        await outputsApi.getOutputsApiV1OutputsWorkflowIdOutputsGet(
          workflowId,
          depth,
        );
      return response.data;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
};

export const useWorkflowDetail = (
  workflowId: string,
  enabled: boolean = true,
) => {
  return useQuery<WorkflowDetialResponse>({
    queryKey: ["workflowDetail", workflowId],
    queryFn: async () => {
      const response =
        await workflowApi.getDetailApiV1WorkflowsWorkflowIdDetailGet(
          workflowId,
        );
      return response.data;
    },
    staleTime: 30000,
    refetchInterval: 60000,
    enabled,
  });
};

// New hook for querying Caddy server directory listing
export const useCaddyDirectoryTree = (directory: string | null) => {
  return useQuery<Array<CaddyTreeDataNode>>({
    queryKey: ["caddyDirectoryTree", directory],
    queryFn: async () => {
      if (!directory) {
        return [];
      }

      const response = await fetch(constructApiUrl(`/files/${directory}`), {
        headers: {
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch directory: ${response.statusText}`);
      }

      // Parse JSON directory listing from Caddy
      const jsonData = await response.json();
      const nodes: CaddyTreeDataNode[] = [];

      if (Array.isArray(jsonData)) {
        for (const item of jsonData) {
          // Skip parent directory links
          if (item.name === ".." || item.name === ".") {
            continue;
          }

          const isDirectory = item.is_dir || false;

          nodes.push({
            title: item.name,
            key: `${directory}/${item.name}`,
            icon: isDirectory ? "folder" : "file",
            children: isDirectory ? [] : undefined,
            isLeaf: !isDirectory,
            fileSize: isDirectory ? null : item.size || null,
          });
        }
      }

      nodes.sort((a, b) => {
        const aIsDir = !a.isLeaf;
        const bIsDir = !b.isLeaf;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return (a.title || "").localeCompare(b.title || "");
      });

      return nodes;
    },
    enabled: !!directory,
    staleTime: 30000,
    refetchInterval: 60000,
  });
};

// Hook for lazy loading directory contents when expanding a directory
export const useLazyDirectoryLoad = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (directoryPath: string) => {
      const VITE_FLOWO_WORKING_PATH = import.meta.env.VITE_FLOWO_WORKING_PATH;
      const directoryWithoutViteFlowoWorkingPath = directoryPath.replace(
        VITE_FLOWO_WORKING_PATH,
        "",
      );

      const response = await fetch(
        constructApiUrl(`/files/${directoryWithoutViteFlowoWorkingPath}`),
        {
          headers: {
            Accept: "application/json",
          },
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch directory: ${response.statusText}`);
      }

      const jsonData = await response.json();
      const nodes: CaddyTreeDataNode[] = [];

      if (Array.isArray(jsonData)) {
        for (const item of jsonData) {
          if (item.name === ".." || item.name === ".") {
            continue;
          }

          const isDirectory = item.is_dir || false;

          nodes.push({
            title: item.name,
            key: `${directoryPath}/${item.name}`,
            icon: isDirectory ? "folder" : "file",
            children: isDirectory ? [] : undefined,
            isLeaf: !isDirectory,
            fileSize: isDirectory ? null : item.size || null,
          });
        }
      }

      nodes.sort((a, b) => {
        const aIsDir = !a.isLeaf;
        const bIsDir = !b.isLeaf;
        if (aIsDir && !bIsDir) return -1;
        if (!aIsDir && bIsDir) return 1;
        return (a.title || "").localeCompare(b.title || "");
      });

      return nodes;
    },
    onSuccess: (data, directoryPath) => {
      // Update the cache with the loaded directory contents
      queryClient.setQueryData(["caddyDirectoryTree", directoryPath], data);
    },
  });
};
