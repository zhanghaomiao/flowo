import {
  Configuration,
  JobsApi,
  WorkflowApi,
  SseApi,
  LogsApi,
  UtilsApi,
  OutputsApi,
} from "./index";

// Helper function to safely construct URLs
export const constructApiUrl = (path: string, basePath?: string): string => {
  const apiBasePath = basePath || getApiBasePath();

  // If basePath is relative (starts with /), use current origin
  if (apiBasePath.startsWith('/')) {
    return `${window.location.origin}${path}`;
  }

  // If basePath is absolute, construct URL normally
  try {
    const url = new URL(path, apiBasePath);
    return url.toString();
  } catch (error) {
    console.error('Failed to construct URL:', { path, apiBasePath, error });
    // Fallback: if apiBasePath looks like a complete URL, append path directly
    if (apiBasePath.includes('://')) {
      const cleanBasePath = apiBasePath.endsWith('/') ? apiBasePath.slice(0, -1) : apiBasePath;
      const cleanPath = path.startsWith('/') ? path : `/${path}`;
      return `${cleanBasePath}${cleanPath}`;
    }
    // Final fallback to relative URL construction
    return `${window.location.origin}${path}`;
  }
};

export const getApiBasePath = (): string => {
  // Check for custom API base path from environment variable (for development)
  const envApiBasePath = (import.meta as any).env?.VITE_API_BASE_PATH;

  if (envApiBasePath) {
    console.log('Using custom API base path from VITE_API_BASE_PATH:', envApiBasePath);
    return envApiBasePath;
  }

  // Use current origin for proxy setup (default behavior)
  const defaultPath = window.location.origin;
  console.log('Using API base path (current origin):', defaultPath);
  return defaultPath;
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
export const utilsApi = new UtilsApi(configuration);
export const outputsApi = new OutputsApi(configuration);

// Export types for use in components
export type {
  JobResponse,
  WorkflowResponse,
  WorkflowListResponse,
  HTTPValidationError,
  ValidationError,
  ValidationErrorLocInner,
} from "./index";
