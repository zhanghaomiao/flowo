# Snakemake Workflow Manager API Client & SSE Integration

## Overview

This project includes a TypeScript API client and Server-Sent Events (SSE) integration for the Snakemake Workflow Manager. The client provides both traditional HTTP API calls and real-time event streaming capabilities.

## Features

- **Generated TypeScript Client**: Auto-generated from OpenAPI specification
- **Server-Sent Events (SSE)**: Real-time notifications for workflow and job updates
- **React Query Integration**: Seamless caching and state management
- **TypeScript Support**: Full type safety and IntelliSense
- **Automatic Reconnection**: Robust SSE connection handling with retry logic
- **Flexible Filtering**: Filter SSE events by table types (workflows, jobs, etc.)

## Generated API Client

### Installation

The API client is automatically generated from the OpenAPI specification using OpenAPI Generator:

```bash
npx @openapitools/openapi-generator-cli generate -i openapi.json -g typescript-axios -o src/api
```

### Basic Usage

```typescript
import { workflowApi, jobsApi, sseApi } from './api/client';

// Get workflows
const workflows = await workflowApi.listWorkflowsApiV1WorkflowsGet(20, 0, true, true);

// Get jobs
const jobs = await jobsApi.getJobsApiV1JobsGet(10, 0);

// Get specific job
const job = await jobsApi.getJobApiV1JobsJobIdGet(123);

// Get workflow jobs
const workflowJobs = await workflowApi.listWorkflowJobsApiV1WorkflowsWorkflowIdJobsGet(
  'workflow-id', 
  'running'
);

// Get workflow rule graph
const ruleGraph = await workflowApi.getWorkflowRuleGraphApiV1WorkflowsWorkflowIdRuleGraphGet(
  'workflow-id'
);

// SSE health check
const health = await sseApi.sseHealthCheckApiV1SseHealthGet();

// SSE statistics
const stats = await sseApi.getSseStatsApiV1SseStatsGet();
```

### Available APIs

- **WorkflowApi**: Manage workflows and their jobs
- **JobsApi**: Access job information
- **SseApi**: Server-Sent Events management

## Server-Sent Events (SSE) Integration

### Basic SSE Hooks

```typescript
import { useSSE, useWorkflowSSE, useJobSSE, useAllSSE } from './hooks/useSSE';

// Connect to all events
const { data, status, isConnected, reconnect, disconnect } = useSSE({
  filters: 'all',
  enabled: true,
  reconnectInterval: 3000,
  maxRetries: 5
});

// Specific event types
const workflowEvents = useWorkflowSSE({ enabled: true });
const jobEvents = useJobSSE({ enabled: true });
const allEvents = useAllSSE({ enabled: true });

// Custom filters
const customEvents = useSSE({ 
  filters: 'workflows,jobs',
  baseUrl: 'http://localhost:8001',
  reconnectInterval: 5000
});
```

### SSE Hook Return Values

```typescript
interface UseSSEReturn {
  data: SSEEvent | null;           // Latest received event
  status: SSEConnectionStatus;     // 'connecting' | 'connected' | 'disconnected' | 'error'
  error: string | null;            // Error message if any
  isConnected: boolean;            // Connection status
  reconnect: () => void;           // Manual reconnection
  disconnect: () => void;          // Manual disconnection
  retryCount: number;              // Number of retry attempts
}

interface SSEEvent {
  id?: string;                     // Event ID
  event?: string;                  // Event type (e.g., 'workflow_update', 'job_update')
  data: any;                       // Event payload
  timestamp?: string;              // When the event was received
}
```

### Integrated Query + SSE Hooks

These hooks combine React Query data fetching with SSE real-time updates:

```typescript
import { 
  useWorkflowsWithSSE, 
  useJobsWithSSE, 
  useWorkflowJobsWithSSE 
} from './hooks/useQueries';

// Workflows with automatic SSE updates
const {
  data,                    // Workflow data from React Query
  isLoading,              // Loading state
  error,                  // Query error
  sseStatus,              // SSE connection status
  isSSEConnected,         // SSE connection boolean
  sseError,               // SSE error
  sseRetryCount,          // SSE retry count
  reconnectSSE,           // Reconnect SSE function
  disconnectSSE           // Disconnect SSE function
} = useWorkflowsWithSSE({ 
  limit: 20, 
  enableSSE: true 
});

// Jobs with SSE integration
const jobsWithSSE = useJobsWithSSE({ 
  limit: 10, 
  enableSSE: true 
});

// Workflow-specific jobs with SSE
const workflowJobsWithSSE = useWorkflowJobsWithSSE(
  'workflow-id',
  undefined,  // status filter
  true        // enable SSE
);
```

## Components

### SSEStatusIndicator

A React component for displaying SSE connection status:

```typescript
import SSEStatusIndicator from './components/SSEStatusIndicator';

// Simple status badge
<SSEStatusIndicator filters="all" />

// Detailed status card with controls
<SSEStatusIndicator 
  filters="workflows,jobs"
  showDetails={true}
  showStats={true}
/>
```

### SSEExample

A comprehensive example component demonstrating all SSE features:

```typescript
import SSEExample from './examples/SSEExample';

// Full-featured example with controls and event history
<SSEExample />
```

## SSE Event Types

The SSE endpoint supports filtering by table types:

- `all`: All database changes
- `workflows`: Only workflow table changes
- `jobs`: Only job table changes
- `workflows,jobs`: Multiple table types (comma-separated)

### Event Structure

Events follow the Server-Sent Events specification:

```
data: {"table": "workflows", "action": "INSERT", "data": {...}}

data: {"table": "jobs", "action": "UPDATE", "data": {...}}
```

Custom event types may include:
- `workflow_update`: Workflow state changes
- `job_update`: Job state changes

## Configuration

### API Base URL

Configure the API base URL in `src/api/client.ts`:

```typescript
const configuration = new Configuration({
  basePath: 'http://127.0.0.1:8001',  // Update this URL
});
```

### SSE Configuration

SSE hooks accept these configuration options:

```typescript
interface UseSSEOptions {
  baseUrl?: string;           // API base URL (default: 'http://127.0.0.1:8001')
  filters?: string;           // Table filters (default: undefined)
  enabled?: boolean;          // Enable/disable connection (default: true)
  reconnectInterval?: number; // Reconnection delay in ms (default: 3000)
  maxRetries?: number;        // Maximum retry attempts (default: 5)
}
```

## Error Handling

### SSE Error Handling

SSE connections automatically handle errors and attempt reconnection:

```typescript
const { status, error, retryCount, reconnect } = useSSE({ filters: 'all' });

if (status === 'error') {
  console.error('SSE Error:', error);
  console.log('Retry count:', retryCount);
  
  // Manual reconnection
  reconnect();
}
```

### API Error Handling

Use React Query's error handling for API calls:

```typescript
const { data, error, isError } = useWorkflows();

if (isError) {
  console.error('API Error:', error);
}
```

## Development

### Regenerating the API Client

When the OpenAPI specification changes:

1. Update `openapi.json` with the new specification
2. Regenerate the client:
   ```bash
   npx @openapitools/openapi-generator-cli generate -i openapi.json -g typescript-axios -o src/api
   ```
3. Update `src/api/client.ts` if new APIs are added

### Testing SSE Connection

Use the SSE test endpoint to verify connectivity:

```typescript
// Send a test notification
await sseApi.sendTestNotificationApiV1SseTestNotificationPost();

// Check SSE health
const health = await sseApi.sseHealthCheckApiV1SseHealthGet();

// Get SSE statistics
const stats = await sseApi.getSseStatsApiV1SseStatsGet();
```

## Examples

### Real-time Workflow Dashboard

```typescript
import { useWorkflowsWithSSE } from './hooks/useQueries';
import SSEStatusIndicator from './components/SSEStatusIndicator';

const WorkflowDashboard = () => {
  const { 
    data: workflows, 
    isLoading, 
    isSSEConnected 
  } = useWorkflowsWithSSE({ enableSSE: true });

  return (
    <div>
      <SSEStatusIndicator filters="workflows" />
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div>
          {workflows?.workflows?.map(workflow => (
            <div key={workflow.id}>
              {workflow.id} - {workflow.status}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

### Event History Tracker

```typescript
import { useAllSSE } from './hooks/useSSE';

const EventTracker = () => {
  const [events, setEvents] = useState([]);
  const { data: sseEvent } = useAllSSE();

  useEffect(() => {
    if (sseEvent) {
      setEvents(prev => [sseEvent, ...prev.slice(0, 99)]); // Keep last 100 events
    }
  }, [sseEvent]);

  return (
    <div>
      {events.map((event, index) => (
        <div key={index}>
          {event.event}: {JSON.stringify(event.data)}
        </div>
      ))}
    </div>
  );
};
```

## Troubleshooting

### SSE Connection Issues

1. **CORS Issues**: Ensure the backend allows cross-origin requests for SSE endpoints
2. **Network Timeouts**: Check `reconnectInterval` and `maxRetries` settings
3. **Event Parsing**: SSE events should be valid JSON for automatic parsing

### API Client Issues

1. **Base URL**: Verify the `basePath` in the configuration matches your backend
2. **Authentication**: Add authentication headers if required
3. **Type Errors**: Regenerate the client if the OpenAPI spec has changed

### Browser Support

- SSE is supported in all modern browsers
- For older browsers, consider a polyfill
- Check browser developer tools for SSE connection status

## License

This project is part of the Snakemake ecosystem and follows the same licensing terms. 