import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowApi, jobsApi, logsApi } from '../api/client'

// Custom hook for fetching workflows with pagination support
export const useWorkflows = (params?: {
  limit?: number | null
  offset?: number | null
  orderByStarted?: boolean
  descending?: boolean
}) => {
  return useQuery({
    queryKey: ['workflows', params],
    queryFn: async () => {
      const response = await workflowApi.getWorkflowsApiV1WorkflowsGet(
        params?.limit ?? 20,
        params?.offset ?? 0,
        params?.orderByStarted ?? true,
        params?.descending ?? true,
      )
      return response.data
    },
    staleTime: 30000, // Data is fresh for 30 seconds
    refetchInterval: 60000, // Refetch every minute
    placeholderData: (previousData) => previousData, // Keep previous data while loading
  })
}

// Custom hook for deleting workflows (IMPROVED VERSION)
export const useDeleteWorkflow = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (workflowId: string) => {
      const response = await workflowApi.deleteWorkflowApiV1WorkflowsWorkflowIdDelete(workflowId)
      return response.data
    },
    onSuccess: (_, workflowId) => {
      // Invalidate and refetch workflow queries after successful deletion
      queryClient.invalidateQueries({ queryKey: ['sse', 'workflows'] })
      queryClient.invalidateQueries({ queryKey: ['workflows'] })
    },
    onError: (error, workflowId) => {
      console.error(`Error deleting workflow ${workflowId}:`, error)
    }
  })
}

// Custom hook for fetching workflows with pagination (for table)
export const useWorkflowsPaginated = (
  page: number = 1,
  pageSize: number = 20,
  orderByStarted: boolean = true,
  descending: boolean = true
) => {
  const offset = (page - 1) * pageSize

  return useQuery({
    queryKey: ['workflows', 'paginated', { page, pageSize, orderByStarted, descending }],
    queryFn: async () => {
      const response = await workflowApi.getWorkflowsApiV1WorkflowsGet(
        pageSize,
        offset,
        orderByStarted,
        descending,
      )
      return response.data
    },
    staleTime: 30000,
    placeholderData: (previousData) => previousData,
  })
}

// Custom hook for fetching a specific job
export const useJob = (jobId: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      const response = await jobsApi.getJobApiV1JobsJobIdGet(jobId)
      return response.data
    },
    enabled, // Only fetch when enabled is true
    staleTime: 30000,
  })
}

// Custom hook for fetching job files
export const useJobFiles = (jobId: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['jobFiles', jobId],
    queryFn: async () => {
      const response = await jobsApi.getFilesApiV1JobsFilesJobIdGet(jobId)
      return response.data
    },
    enabled,
    staleTime: 30000,
  })
}

// Custom hook for fetching workflow jobs
export const useWorkflowJobs = (workflowId: string, status?: string | null) => {
  return useQuery({
    queryKey: ['workflowJobs', workflowId, status],
    queryFn: async () => {
      const response = await workflowApi.getJobsApiV1WorkflowsWorkflowIdJobsGet(
        workflowId,
        null, // limit
        null, // offset
        true, // orderByStarted
        true, // descending
        null, // ruleName
        status as any, // status
      )
      return response.data
    },
    staleTime: 30000,
    refetchInterval: 60000,
  })
}

// Custom hook for fetching workflow rule graph
export const useWorkflowRuleGraph = (workflowId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['workflowRuleGraph', workflowId],
    queryFn: async () => {
      const response = await workflowApi.getRuleGraphApiV1WorkflowsWorkflowIdRuleGraphGet(
        workflowId,
      )
      return response.data
    },
    enabled,
    staleTime: 300000, // Rule graph is relatively static, cache for 5 minutes
  })
}

// Custom hook for fetching workflow Snakefile content
export const useWorkflowSnakefile = (workflowId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['workflowSnakefile', workflowId],
    queryFn: async () => {
      const response = await workflowApi.getSnakefileApiV1WorkflowsWorkflowIdSnakefileGet(
        workflowId,
      )
      return response.data
    },
    enabled,
    staleTime: 300000, // Snakefile content is static, cache for 5 minutes
  })
}


export const useWorkFlowUsers = () => {
  return useQuery({
    queryKey: ['workflowUsers'],
    queryFn: async () => {
      const response = await workflowApi.getAllUsersApiV1WorkflowsUsersGet()
      return response.data
    },
  })
}


export const useWorkflowLogs = (workflowId: string, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['workflowLogs', workflowId],
    queryFn: async () => {
      const response = await logsApi.getWorkflowLogsApiV1LogsWorkflowIdGet(workflowId)
      return response.data
    },
    enabled,
  })
}