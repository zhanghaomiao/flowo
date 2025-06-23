# WorkflowApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**deleteWorkflowApiV1WorkflowsWorkflowIdDelete**](#deleteworkflowapiv1workflowsworkflowiddelete) | **DELETE** /api/v1/workflows/{workflow_id} | Delete Workflow|
|[**getAllUsersApiV1WorkflowsUsersGet**](#getallusersapiv1workflowsusersget) | **GET** /api/v1/workflows/users | Get All Users|
|[**getConfigfilesApiV1WorkflowsWorkflowIdConfigfilesGet**](#getconfigfilesapiv1workflowsworkflowidconfigfilesget) | **GET** /api/v1/workflows/{workflow_id}/configfiles | Get Configfiles|
|[**getDetailApiV1WorkflowsWorkflowIdDetailGet**](#getdetailapiv1workflowsworkflowiddetailget) | **GET** /api/v1/workflows/{workflow_id}/detail | Get Detail|
|[**getJobsApiV1WorkflowsWorkflowIdJobsGet**](#getjobsapiv1workflowsworkflowidjobsget) | **GET** /api/v1/workflows/{workflow_id}/jobs | Get Jobs|
|[**getProgressApiV1WorkflowsWorkflowIdProgressGet**](#getprogressapiv1workflowsworkflowidprogressget) | **GET** /api/v1/workflows/{workflow_id}/progress | Get Progress|
|[**getRuleGraphApiV1WorkflowsWorkflowIdRuleGraphGet**](#getrulegraphapiv1workflowsworkflowidrulegraphget) | **GET** /api/v1/workflows/{workflow_id}/rule_graph | Get Rule Graph|
|[**getRuleStatusApiV1WorkflowsWorkflowIdRuleStatusGet**](#getrulestatusapiv1workflowsworkflowidrulestatusget) | **GET** /api/v1/workflows/{workflow_id}/rule_status | Get Rule Status|
|[**getSnakefileApiV1WorkflowsWorkflowIdSnakefileGet**](#getsnakefileapiv1workflowsworkflowidsnakefileget) | **GET** /api/v1/workflows/{workflow_id}/snakefile | Get Snakefile|
|[**getTimelinesApiV1WorkflowsWorkflowIdTimelinesGet**](#gettimelinesapiv1workflowsworkflowidtimelinesget) | **GET** /api/v1/workflows/{workflow_id}/timelines | Get Timelines|
|[**getWorkflowsApiV1WorkflowsGet**](#getworkflowsapiv1workflowsget) | **GET** /api/v1/workflows/ | Get Workflows|

# **deleteWorkflowApiV1WorkflowsWorkflowIdDelete**
> any deleteWorkflowApiV1WorkflowsWorkflowIdDelete()


### Example

```typescript
import {
    WorkflowApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WorkflowApi(configuration);

let workflowId: string; // (default to undefined)

const { status, data } = await apiInstance.deleteWorkflowApiV1WorkflowsWorkflowIdDelete(
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

# **getAllUsersApiV1WorkflowsUsersGet**
> Array<string> getAllUsersApiV1WorkflowsUsersGet()


### Example

```typescript
import {
    WorkflowApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WorkflowApi(configuration);

const { status, data } = await apiInstance.getAllUsersApiV1WorkflowsUsersGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**Array<string>**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getConfigfilesApiV1WorkflowsWorkflowIdConfigfilesGet**
> { [key: string]: string | null; } getConfigfilesApiV1WorkflowsWorkflowIdConfigfilesGet()


### Example

```typescript
import {
    WorkflowApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WorkflowApi(configuration);

let workflowId: string; // (default to undefined)

const { status, data } = await apiInstance.getConfigfilesApiV1WorkflowsWorkflowIdConfigfilesGet(
    workflowId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowId** | [**string**] |  | defaults to undefined|


### Return type

**{ [key: string]: string | null; }**

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

# **getDetailApiV1WorkflowsWorkflowIdDetailGet**
> WorkflowDetialResponse getDetailApiV1WorkflowsWorkflowIdDetailGet()


### Example

```typescript
import {
    WorkflowApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WorkflowApi(configuration);

let workflowId: string; // (default to undefined)

const { status, data } = await apiInstance.getDetailApiV1WorkflowsWorkflowIdDetailGet(
    workflowId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowId** | [**string**] |  | defaults to undefined|


### Return type

**WorkflowDetialResponse**

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

# **getJobsApiV1WorkflowsWorkflowIdJobsGet**
> JobListResponse getJobsApiV1WorkflowsWorkflowIdJobsGet()


### Example

```typescript
import {
    WorkflowApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WorkflowApi(configuration);

let workflowId: string; // (default to undefined)
let limit: number; //Maximum number of jobs to return (optional) (default to undefined)
let offset: number; //Number of jobs to skip (optional) (default to undefined)
let orderByStarted: boolean; //Order by start time (True) or ID (False) (optional) (default to true)
let descending: boolean; //Order in descending order (newest first) (optional) (default to true)
let ruleName: string; //Filter jobs by rule_name (optional) (default to undefined)
let status: Status; //Filter jobs by status (optional) (default to undefined)

const { status, data } = await apiInstance.getJobsApiV1WorkflowsWorkflowIdJobsGet(
    workflowId,
    limit,
    offset,
    orderByStarted,
    descending,
    ruleName,
    status
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowId** | [**string**] |  | defaults to undefined|
| **limit** | [**number**] | Maximum number of jobs to return | (optional) defaults to undefined|
| **offset** | [**number**] | Number of jobs to skip | (optional) defaults to undefined|
| **orderByStarted** | [**boolean**] | Order by start time (True) or ID (False) | (optional) defaults to true|
| **descending** | [**boolean**] | Order in descending order (newest first) | (optional) defaults to true|
| **ruleName** | [**string**] | Filter jobs by rule_name | (optional) defaults to undefined|
| **status** | **Status** | Filter jobs by status | (optional) defaults to undefined|


### Return type

**JobListResponse**

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

# **getProgressApiV1WorkflowsWorkflowIdProgressGet**
> { [key: string]: number; } getProgressApiV1WorkflowsWorkflowIdProgressGet()


### Example

```typescript
import {
    WorkflowApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WorkflowApi(configuration);

let workflowId: string; // (default to undefined)
let returnTotalJobsNumber: boolean; // (optional) (default to false)

const { status, data } = await apiInstance.getProgressApiV1WorkflowsWorkflowIdProgressGet(
    workflowId,
    returnTotalJobsNumber
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowId** | [**string**] |  | defaults to undefined|
| **returnTotalJobsNumber** | [**boolean**] |  | (optional) defaults to false|


### Return type

**{ [key: string]: number; }**

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

# **getRuleGraphApiV1WorkflowsWorkflowIdRuleGraphGet**
> { [key: string]: any; } getRuleGraphApiV1WorkflowsWorkflowIdRuleGraphGet()


### Example

```typescript
import {
    WorkflowApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WorkflowApi(configuration);

let workflowId: string; // (default to undefined)

const { status, data } = await apiInstance.getRuleGraphApiV1WorkflowsWorkflowIdRuleGraphGet(
    workflowId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowId** | [**string**] |  | defaults to undefined|


### Return type

**{ [key: string]: any; }**

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

# **getRuleStatusApiV1WorkflowsWorkflowIdRuleStatusGet**
> { [key: string]: RuleStatusResponse; } getRuleStatusApiV1WorkflowsWorkflowIdRuleStatusGet()


### Example

```typescript
import {
    WorkflowApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WorkflowApi(configuration);

let workflowId: string; // (default to undefined)

const { status, data } = await apiInstance.getRuleStatusApiV1WorkflowsWorkflowIdRuleStatusGet(
    workflowId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowId** | [**string**] |  | defaults to undefined|


### Return type

**{ [key: string]: RuleStatusResponse; }**

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

# **getSnakefileApiV1WorkflowsWorkflowIdSnakefileGet**
> any getSnakefileApiV1WorkflowsWorkflowIdSnakefileGet()


### Example

```typescript
import {
    WorkflowApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WorkflowApi(configuration);

let workflowId: string; // (default to undefined)

const { status, data } = await apiInstance.getSnakefileApiV1WorkflowsWorkflowIdSnakefileGet(
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

# **getTimelinesApiV1WorkflowsWorkflowIdTimelinesGet**
> { [key: string]: Array<any>; } getTimelinesApiV1WorkflowsWorkflowIdTimelinesGet()


### Example

```typescript
import {
    WorkflowApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WorkflowApi(configuration);

let workflowId: string; // (default to undefined)

const { status, data } = await apiInstance.getTimelinesApiV1WorkflowsWorkflowIdTimelinesGet(
    workflowId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowId** | [**string**] |  | defaults to undefined|


### Return type

**{ [key: string]: Array<any>; }**

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

# **getWorkflowsApiV1WorkflowsGet**
> WorkflowListResponse getWorkflowsApiV1WorkflowsGet()


### Example

```typescript
import {
    WorkflowApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new WorkflowApi(configuration);

let limit: number; //Maximum number of workflows to return (optional) (default to undefined)
let offset: number; //Number of workflows to skip (optional) (default to undefined)
let orderByStarted: boolean; //Order by start time (True) or ID (False) (optional) (default to true)
let descending: boolean; //Order in descending order (newest first) (optional) (default to true)
let user: string; //Filter by user who started the workflow (optional) (default to undefined)
let status: Status; //Filter by workflow status (RUNNING, SUCCESS, ERROR, UNKNOWN) (optional) (default to undefined)
let tags: string; //Filter by tags (comma-separated) (optional) (default to undefined)
let name: string; //Filter by workflow name (optional) (default to undefined)
let startAt: string; //Filter workflows started after this time (optional) (default to undefined)
let endAt: string; //Filter workflows ended before this time (optional) (default to undefined)

const { status, data } = await apiInstance.getWorkflowsApiV1WorkflowsGet(
    limit,
    offset,
    orderByStarted,
    descending,
    user,
    status,
    tags,
    name,
    startAt,
    endAt
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **limit** | [**number**] | Maximum number of workflows to return | (optional) defaults to undefined|
| **offset** | [**number**] | Number of workflows to skip | (optional) defaults to undefined|
| **orderByStarted** | [**boolean**] | Order by start time (True) or ID (False) | (optional) defaults to true|
| **descending** | [**boolean**] | Order in descending order (newest first) | (optional) defaults to true|
| **user** | [**string**] | Filter by user who started the workflow | (optional) defaults to undefined|
| **status** | **Status** | Filter by workflow status (RUNNING, SUCCESS, ERROR, UNKNOWN) | (optional) defaults to undefined|
| **tags** | [**string**] | Filter by tags (comma-separated) | (optional) defaults to undefined|
| **name** | [**string**] | Filter by workflow name | (optional) defaults to undefined|
| **startAt** | [**string**] | Filter workflows started after this time | (optional) defaults to undefined|
| **endAt** | [**string**] | Filter workflows ended before this time | (optional) defaults to undefined|


### Return type

**WorkflowListResponse**

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

