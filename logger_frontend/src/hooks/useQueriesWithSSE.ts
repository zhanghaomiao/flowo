import { useQuery, useQueryClient } from '@tanstack/react-query'
import { workflowApi, logsApi } from '../api/client'
import { Status } from '../api/api'
import { useSSE, type DatabaseChangeData } from './useSSE'

// Enhanced workflows hook with direct SSE integration
export const useWorkflowsWithSSE = (params?: {
  limit?: number | null
  offset?: number | null
  orderByStarted?: boolean
  descending?: boolean
  enableSSE?: boolean
  user?: string | null
  status?: Status | null
}) => {
  const queryClient = useQueryClient()

  // Use the main workflows query
  const workflowsQuery = useQuery({
    queryKey: ['workflows', params],
    queryFn: async () => {
      const response = await workflowApi.getWorkflowsApiV1WorkflowsGet(
        params?.limit ?? 20,
        params?.offset ?? 0,
        params?.orderByStarted ?? true,
        params?.descending ?? true,
        params?.user ?? null,
        params?.status ?? null,
      )
      return response.data
    },
    staleTime: 30000,
    refetchInterval: 60000,
    placeholderData: (previousData) => previousData,
  })

  // Direct SSE connection for database changes
  const sseConnection = useSSE({
    filters: 'workflows',
    enabled: params?.enableSSE !== false,
    onDatabaseChange: (data: DatabaseChangeData) => {
      // Invalidate workflows query when workflows table changes
      if (data.table === 'workflows') {
        console.log('Workflows table changed, invalidating query:', data)
        queryClient.invalidateQueries({ queryKey: ['workflows'] })
      }
    }
  })

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
  }
}

// Enhanced workflow jobs hook with direct SSE integration
export const useWorkflowJobsWithSSE = (params?: {
  workflowId: string
  limit?: number | null,
  offset?: number | null,
  orderByStarted?: boolean
  descending?: boolean
  enableSSE?: boolean
  status?: Status | null
  ruleName?: string | null
}) => {
  const queryClient = useQueryClient()

  // Use the main workflow jobs query
  const workflowJobsQuery = useQuery({
    queryKey: ['workflowJobs', params],
    queryFn: async () => {
      const response = await workflowApi.getJobsApiV1WorkflowsWorkflowIdJobsGet(
        params!.workflowId,
        params?.limit,
        params?.offset,
        params?.orderByStarted,
        params?.descending,
        params?.ruleName,
        params?.status,
      )
      return response.data
    },
    staleTime: 30000,
    refetchInterval: 60000,
  })

  // Direct SSE connection for workflow-specific job events
  const sseConnection = useSSE({
    filters: 'jobs',
    workflowId: params?.workflowId,
    enabled: params?.enableSSE !== false,
    onJobEvent: (data: DatabaseChangeData) => {
      // Invalidate jobs query when jobs change for this workflow
      console.log(`Job event for workflow ${params?.workflowId}:`, data)
      queryClient.invalidateQueries({ queryKey: ['workflowJobs', params] })
    }
  })

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
  }
}

// Enhanced workflow progress hook with direct SSE integration
export const useWorkflowProgressWithSSE = (workflowId: string) => {
  const queryClient = useQueryClient()

  const workflowProgressQuery = useQuery({
    queryKey: ['workflowProgress', workflowId],
    queryFn: async () => {
      const response = await workflowApi.getProgressApiV1WorkflowsWorkflowIdProgressGet(workflowId)
      return response.data
    },
    staleTime: 30000,
    refetchInterval: 60000,
  })

  // Direct SSE connection for workflow-specific job events
  const sseConnection = useSSE({
    filters: 'jobs',
    workflowId,
    onJobEvent: (data: DatabaseChangeData) => {
      // Invalidate progress query when jobs change for this workflow
      console.log(`Job progress update for workflow ${workflowId}:`, data)
      queryClient.invalidateQueries({ queryKey: ['workflowProgress', workflowId] })
    }
  })

  return {
    ...workflowProgressQuery,
    sseStatus: sseConnection.status,
    sseError: sseConnection.error,
    isSSEConnected: sseConnection.isConnected,
    sseRetryCount: sseConnection.retryCount,
    reconnectSSE: sseConnection.reconnect,
    disconnectSSE: sseConnection.disconnect,
    latestEvent: sseConnection.data,
  }
}