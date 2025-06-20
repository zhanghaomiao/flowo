import { Configuration, JobsApi, WorkflowApi, SseApi, LogsApi } from './index';

export const getApiBasePath = (): string => {
  // Check for Vite environment variables
  if (import.meta.env.VITE_API_BASE_PATH) {
    return import.meta.env.VITE_API_BASE_PATH;
  }

  // Check for traditional environment variables (for SSR/Node.js environments)
  if (typeof window === 'undefined' && typeof globalThis !== 'undefined' &&
    (globalThis as any).process?.env?.API_BASE_PATH) {
    return (globalThis as any).process.env.API_BASE_PATH;
  }

  // Default fallback
  return 'http://127.0.0.1:8000';
  // return 'http://172.16.3.8:8000';

};

// Create configuration with the backend base URL from environment
const configuration = new Configuration({
  basePath: getApiBasePath(),
});

// Create API instances
export const jobsApi = new JobsApi(configuration);
export const workflowApi = new WorkflowApi(configuration);
export const sseApi = new SseApi(configuration);
export const logsApi = new LogsApi(configuration);

// Export types for use in components
export type {
  JobResponse,
  WorkflowResponse,
  WorkflowListResponse,
  HTTPValidationError,
  ValidationError,
  ValidationErrorLocInner,
} from './index'; 