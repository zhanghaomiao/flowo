# SseApi

All URIs are relative to _http://localhost_

| Method                                                                                                    | HTTP request                             | Description            |
| --------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------- |
| [**cleanupConnectionsApiV1SseCleanupConnectionsPost**](#cleanupconnectionsapiv1ssecleanupconnectionspost) | **POST** /api/v1/sse/cleanup-connections | Cleanup Connections    |
| [**debugConnectionsApiV1SseDebugConnectionsGet**](#debugconnectionsapiv1ssedebugconnectionsget)           | **GET** /api/v1/sse/debug/connections    | Debug Connections      |
| [**forceReconnectApiV1SseReconnectPost**](#forcereconnectapiv1ssereconnectpost)                           | **POST** /api/v1/sse/reconnect           | Force Reconnect        |
| [**getSseStatsApiV1SseStatsGet**](#getssestatsapiv1ssestatsget)                                           | **GET** /api/v1/sse/stats                | Get Sse Stats          |
| [**sendTestNotificationApiV1SseTestNotificationPost**](#sendtestnotificationapiv1ssetestnotificationpost) | **POST** /api/v1/sse/test-notification   | Send Test Notification |
| [**sseHealthCheckApiV1SseHealthGet**](#ssehealthcheckapiv1ssehealthget)                                   | **GET** /api/v1/sse/health               | Sse Health Check       |
| [**streamEventsApiV1SseEventsGet**](#streameventsapiv1sseeventsget)                                       | **GET** /api/v1/sse/events               | Stream Events          |

# **cleanupConnectionsApiV1SseCleanupConnectionsPost**

> any cleanupConnectionsApiV1SseCleanupConnectionsPost()

### Example

```typescript
import { SseApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new SseApi(configuration);

const { status, data } =
  await apiInstance.cleanupConnectionsApiV1SseCleanupConnectionsPost();
```

### Parameters

This endpoint does not have any parameters.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description         | Response headers |
| ----------- | ------------------- | ---------------- |
| **200**     | Successful Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **debugConnectionsApiV1SseDebugConnectionsGet**

> any debugConnectionsApiV1SseDebugConnectionsGet()

### Example

```typescript
import { SseApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new SseApi(configuration);

const { status, data } =
  await apiInstance.debugConnectionsApiV1SseDebugConnectionsGet();
```

### Parameters

This endpoint does not have any parameters.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description         | Response headers |
| ----------- | ------------------- | ---------------- |
| **200**     | Successful Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **forceReconnectApiV1SseReconnectPost**

> any forceReconnectApiV1SseReconnectPost()

### Example

```typescript
import { SseApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new SseApi(configuration);

const { status, data } =
  await apiInstance.forceReconnectApiV1SseReconnectPost();
```

### Parameters

This endpoint does not have any parameters.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description         | Response headers |
| ----------- | ------------------- | ---------------- |
| **200**     | Successful Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getSseStatsApiV1SseStatsGet**

> any getSseStatsApiV1SseStatsGet()

### Example

```typescript
import { SseApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new SseApi(configuration);

const { status, data } = await apiInstance.getSseStatsApiV1SseStatsGet();
```

### Parameters

This endpoint does not have any parameters.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description         | Response headers |
| ----------- | ------------------- | ---------------- |
| **200**     | Successful Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **sendTestNotificationApiV1SseTestNotificationPost**

> any sendTestNotificationApiV1SseTestNotificationPost()

### Example

```typescript
import { SseApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new SseApi(configuration);

const { status, data } =
  await apiInstance.sendTestNotificationApiV1SseTestNotificationPost();
```

### Parameters

This endpoint does not have any parameters.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description         | Response headers |
| ----------- | ------------------- | ---------------- |
| **200**     | Successful Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **sseHealthCheckApiV1SseHealthGet**

> any sseHealthCheckApiV1SseHealthGet()

### Example

```typescript
import { SseApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new SseApi(configuration);

const { status, data } = await apiInstance.sseHealthCheckApiV1SseHealthGet();
```

### Parameters

This endpoint does not have any parameters.

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description         | Response headers |
| ----------- | ------------------- | ---------------- |
| **200**     | Successful Response | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **streamEventsApiV1SseEventsGet**

> any streamEventsApiV1SseEventsGet()

Server-Sent Events endpoint for real-time database notifications. 客户端可以连接此端点接收实时通知: - GET /api/v1/sse/events - 接收所有表变化 - GET /api/v1/sse/events?filters=workflows - 只接收workflows表变化 - GET /api/v1/sse/events?filters=jobs&workflow_id=123 - 接收workflows和jobs表变化

### Example

```typescript
import { SseApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new SseApi(configuration);

let filters: string; //Comma-separated list of table names to filter (e.g., \'workflows,jobs\'). Use \'all\' for all tables. (optional) (default to undefined)
let workflowId: string; //Workflow ID to filter events for a specific workflow. (optional) (default to undefined)

const { status, data } = await apiInstance.streamEventsApiV1SseEventsGet(
  filters,
  workflowId,
);
```

### Parameters

| Name           | Type         | Description                                                                                                           | Notes                            |
| -------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **filters**    | [**string**] | Comma-separated list of table names to filter (e.g., \&#39;workflows,jobs\&#39;). Use \&#39;all\&#39; for all tables. | (optional) defaults to undefined |
| **workflowId** | [**string**] | Workflow ID to filter events for a specific workflow.                                                                 | (optional) defaults to undefined |

### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

- **Content-Type**: Not defined
- **Accept**: application/json

### HTTP response details

| Status code | Description         | Response headers |
| ----------- | ------------------- | ---------------- |
| **200**     | Successful Response | -                |
| **422**     | Validation Error    | -                |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
