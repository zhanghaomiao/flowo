# LogsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getWorkflowLogsApiV1LogsWorkflowIdGet**](#getworkflowlogsapiv1logsworkflowidget) | **GET** /api/v1/logs/{workflow_id} | Get Workflow Logs|
|[**streamWorkflowLogsSseApiV1LogsWorkflowIdSseGet**](#streamworkflowlogssseapiv1logsworkflowidsseget) | **GET** /api/v1/logs/{workflow_id}/sse | Stream Workflow Logs Sse|

# **getWorkflowLogsApiV1LogsWorkflowIdGet**
> any getWorkflowLogsApiV1LogsWorkflowIdGet()


### Example

```typescript
import {
    LogsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LogsApi(configuration);

let workflowId: string; // (default to undefined)

const { status, data } = await apiInstance.getWorkflowLogsApiV1LogsWorkflowIdGet(
    workflowId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **streamWorkflowLogsSseApiV1LogsWorkflowIdSseGet**
> any streamWorkflowLogsSseApiV1LogsWorkflowIdSseGet()

使用Server-Sent Events格式的实时日志流

### Example

```typescript
import {
    LogsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new LogsApi(configuration);

let workflowId: string; // (default to undefined)

const { status, data } = await apiInstance.streamWorkflowLogsSseApiV1LogsWorkflowIdSseGet(
    workflowId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowId** | [**string**] |  | defaults to undefined|


### Return type

**any**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |
|**422** | Validation Error |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

