# JobsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getJobApiV1JobsJobIdDetailGet**](#getjobapiv1jobsjobiddetailget) | **GET** /api/v1/jobs/{job_id}/detail | Get Job|
|[**getLogsApiV1JobsJobIdLogsGet**](#getlogsapiv1jobsjobidlogsget) | **GET** /api/v1/jobs/{job_id}/logs | Get Logs|

# **getJobApiV1JobsJobIdDetailGet**
> JobDetailResponse getJobApiV1JobsJobIdDetailGet()


### Example

```typescript
import {
    JobsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JobsApi(configuration);

let jobId: number; // (default to undefined)

const { status, data } = await apiInstance.getJobApiV1JobsJobIdDetailGet(
    jobId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **jobId** | [**number**] |  | defaults to undefined|


### Return type

**JobDetailResponse**

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

# **getLogsApiV1JobsJobIdLogsGet**
> any getLogsApiV1JobsJobIdLogsGet()


### Example

```typescript
import {
    JobsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new JobsApi(configuration);

let jobId: number; // (default to undefined)

const { status, data } = await apiInstance.getLogsApiV1JobsJobIdLogsGet(
    jobId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **jobId** | [**number**] |  | defaults to undefined|


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

