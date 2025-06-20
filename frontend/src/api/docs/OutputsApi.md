# OutputsApi

All URIs are relative to _http://localhost_

| Method                                                                                        | HTTP request                                  | Description |
| --------------------------------------------------------------------------------------------- | --------------------------------------------- | ----------- |
| [**getOutputsApiV1OutputsWorkflowIdOutputsGet**](#getoutputsapiv1outputsworkflowidoutputsget) | **GET** /api/v1/outputs/{workflow_id}/outputs | Get Outputs |

# **getOutputsApiV1OutputsWorkflowIdOutputsGet**

> Array<TreeDataNode> getOutputsApiV1OutputsWorkflowIdOutputsGet()

### Example

```typescript
import { OutputsApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new OutputsApi(configuration);

let workflowId: string; // (default to undefined)
let maxDepth: number; // (optional) (default to 3)

const { status, data } =
  await apiInstance.getOutputsApiV1OutputsWorkflowIdOutputsGet(
    workflowId,
    maxDepth,
  );
```

### Parameters

| Name           | Type         | Description | Notes                    |
| -------------- | ------------ | ----------- | ------------------------ |
| **workflowId** | [**string**] |             | defaults to undefined    |
| **maxDepth**   | [**number**] |             | (optional) defaults to 3 |

### Return type

**Array<TreeDataNode>**

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
