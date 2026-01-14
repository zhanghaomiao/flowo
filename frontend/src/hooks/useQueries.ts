import type { JobDetailResponse, TreeDataNode } from '@/api/api';
import { Status, WorkflowDetialResponse } from '@/api/api';
import {
  deleteWorkflowMutation,
  getAllTagsOptions,
  getAllUsersOptions,
  getConfigfilesOptions,
  getDetailOptions,
  getJobOptions,
  getJobsOptions,
  getLogsOptions,
  getOutputsOptions,
  getProgressOptions,
  getRuleGraphOptions,
  getSnakefileOptions,
  getTimelinesOptions,
  getWorkflowLogsOptions,
  getWorkflowsOptions,
} from '@/client/@tanstack/react-query.gen';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { constructApiUrl } from '../api/client';

// Extended TreeDataNode interface with fileSize for Caddy server
interface CaddyTreeDataNode extends TreeDataNode {
  fileSize?: number | null;
}

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
    ...getWorkflowsOptions({
      query: {
        limit: params?.limit ?? 20,
        offset: params?.offset ?? 0,
        order_by_started: params?.orderByStarted ?? true,
        descending: params?.descending ?? true,
        user: params?.user ?? null,
        status: params?.status ?? null,
        tags: params?.tags ?? null,
        name: params?.name ?? null,
        start_at: params?.startedAt ?? null,
        end_at: params?.endAt ?? null,
      },
    }),
  });
};

export const useDeleteWorkflow = () => {
  return useMutation({
    ...deleteWorkflowMutation(),
  });
};

export const useWorkflowTotalJobs = (workflowId: string) => {
  return useQuery({
    ...getProgressOptions({
      path: {
        workflow_id: workflowId,
      },
      query: {
        return_total_jobs_number: true,
      },
    }),
  });
};

export const useJob = (jobId: number, enabled: boolean = true) => {
  return useQuery({
    ...getJobOptions({
      path: {
        job_id: jobId,
      },
    }),
  });
};

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
    ...getJobsOptions({
      path: {
        workflow_id: workflowId,
      },
      query: {
        limit,
        offset,
        order_by_started: orderByStarted,
        descending,
        rule_name: ruleName,
        status: status as Status,
      },
    }),
    enabled,
  });
};

export const useWorkflowRuleGraph = (
  workflowId: string,
  enabled: boolean = true,
) => {
  return useQuery({
    ...getRuleGraphOptions({
      path: {
        workflow_id: workflowId,
      },
    }),
    enabled,
  });
};

export const useWorkflowSnakefile = (
  workflowId: string,
  enabled: boolean = true,
) => {
  return useQuery({
    ...getSnakefileOptions({
      path: {
        workflow_id: workflowId,
      },
    }),
    enabled,
  });
};

export const useWorkFlowUsers = () => {
  return useQuery({
    ...getAllUsersOptions(),
  });
};

export const useWorkflowLogs = (
  workflowId: string,
  enabled: boolean = true,
) => {
  return useQuery({
    ...getWorkflowLogsOptions({
      path: {
        workflow_id: workflowId,
      },
    }),
    enabled,
  });
};

export const useWorkflowTimeline = (workflowId: string) => {
  return useQuery({
    ...getTimelinesOptions({
      path: {
        workflow_id: workflowId,
      },
    }),
  });
};

export const useWorkflowConfig = (
  workflowId: string,
  enabled: boolean = true,
) => {
  return useQuery({
    ...getConfigfilesOptions({
      path: {
        workflow_id: workflowId,
      },
    }),
    enabled,
  });
};

export const useJobDetail = (jobId: number, enabled: boolean = true) => {
  return useQuery({
    ...getJobOptions({
      path: {
        job_id: jobId,
      },
    }),
    enabled,
  });
};

export const useJobLogs = (jobId: number, enabled: boolean = true) => {
  return useQuery({
    ...getLogsOptions({
      path: {
        job_id: jobId,
      },
    }),
    enabled,
  });
};

export const useAllTags = () => {
  return useQuery({
    ...getAllTagsOptions(),
  });
};

export const useWorkflowDetail = (
  workflowId: string,
  enabled: boolean = true,
) => {
  return useQuery({
    ...getDetailOptions({
      path: {
        workflow_id: workflowId,
      },
    }),
    enabled,
  });
};

export const useCaddyDirectoryTree = (
  directory: string | null,
  enabled: boolean = true,
) => {
  return useQuery<Array<CaddyTreeDataNode>>({
    queryKey: ['caddyDirectoryTree', directory],
    queryFn: async () => {
      if (!directory) {
        return [];
      }

      const response = await fetch(constructApiUrl(`/files/${directory}`), {
        headers: {
          Accept: 'application/json',
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
          if (item.name === '..' || item.name === '.') {
            continue;
          }

          const isDirectory = item.is_dir || false;

          nodes.push({
            title: item.name,
            key: `${directory}/${item.name}`,
            icon: isDirectory ? 'folder' : 'file',
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
        return (a.title || '').localeCompare(b.title || '');
      });

      return nodes;
    },
    enabled,
    staleTime: 120000,
    refetchInterval: 600000,
    refetchOnWindowFocus: false,
  });
};

// Hook for lazy loading directory contents when expanding a directory
export const useLazyDirectoryLoad = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (directoryPath: string) => {
      const response = await fetch(constructApiUrl(`/files/${directoryPath}`), {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch directory: ${response.statusText}`);
      }

      const jsonData = await response.json();
      const nodes: CaddyTreeDataNode[] = [];

      if (Array.isArray(jsonData)) {
        for (const item of jsonData) {
          if (item.name === '..' || item.name === '.') {
            continue;
          }

          const isDirectory = item.is_dir || false;

          nodes.push({
            title: item.name,
            key: `${directoryPath}/${item.name}`,
            icon: isDirectory ? 'folder' : 'file',
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
        return (a.title || '').localeCompare(b.title || '');
      });

      return nodes;
    },
    onSuccess: (data, directoryPath) => {
      queryClient.setQueryData(['caddyDirectoryTree', directoryPath], data);
    },
  });
};

// export const useRule
export const useRuleOutput = (workflowId: string, ruleName: string) => {
  return useQuery({
    queryKey: ['ruleOutput', workflowId, ruleName],
    queryFn: async () => {
      const response =
        await outputsApi.getJobOutputsApiV1OutputsWorkflowIdRuleOutputsGet(
          workflowId,
          ruleName,
        );
      return response.data;
    },
    staleTime: 60000,
    refetchInterval: 300000,
    enabled: !!workflowId && !!ruleName,
  });
};

export const useWorkFlowIdByName = (name: string) => {
  return useQuery({
    queryKey: ['workflowIdByName', name],
    queryFn: async () => {
      if (!name) return null;
      const response =
        await workflowApi.getWorkflowIdByNameApiV1WorkflowsByNameGet(name);
      return response.data && response.data !== '' ? response.data : null;
    },
    staleTime: 60000,
    refetchInterval: false,
    enabled: !!name,
  });
};
