# OutputsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getJobOutputsApiV1OutputsWorkflowIdRuleOutputsGet**](#getjoboutputsapiv1outputsworkflowidruleoutputsget) | **GET** /api/v1/outputs/{workflow_id}/rule_outputs | Get Job Outputs|
|[**getOutputsApiV1OutputsWorkflowIdOutputsGet**](#getoutputsapiv1outputsworkflowidoutputsget) | **GET** /api/v1/outputs/{workflow_id}/outputs | Get Outputs|

# **getJobOutputsApiV1OutputsWorkflowIdRuleOutputsGet**
> Array<string | null> getJobOutputsApiV1OutputsWorkflowIdRuleOutputsGet()


### Example

```typescript
import {
    OutputsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OutputsApi(configuration);

let workflowId: string; // (default to undefined)
let ruleName: string; // (default to undefined)

const { status, data } = await apiInstance.getJobOutputsApiV1OutputsWorkflowIdRuleOutputsGet(
    workflowId,
    ruleName
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowId** | [**string**] |  | defaults to undefined|
| **ruleName** | [**string**] |  | defaults to undefined|


### Return type

**Array<string | null>**

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

# **getOutputsApiV1OutputsWorkflowIdOutputsGet**
> Array<TreeDataNode> getOutputsApiV1OutputsWorkflowIdOutputsGet()


### Example

```typescript
import {
    OutputsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new OutputsApi(configuration);

let workflowId: string; // (default to undefined)
let maxDepth: number; // (optional) (default to 3)

const { status, data } = await apiInstance.getOutputsApiV1OutputsWorkflowIdOutputsGet(
    workflowId,
    maxDepth
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **workflowId** | [**string**] |  | defaults to undefined|
| **maxDepth** | [**number**] |  | (optional) defaults to 3|


### Return type

**Array<TreeDataNode>**

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

