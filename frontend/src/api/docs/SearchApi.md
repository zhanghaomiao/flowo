# SearchApi

All URIs are relative to _http://localhost_

| Method                                                                                | HTTP request                     | Description      |
| ------------------------------------------------------------------------------------- | -------------------------------- | ---------------- |
| [**searchJobsApiV1SearchJobsGet**](#searchjobsapiv1searchjobsget)                     | **GET** /api/v1/search/jobs      | Search Jobs      |
| [**searchWorkflowsApiV1SearchWorkflowsGet**](#searchworkflowsapiv1searchworkflowsget) | **GET** /api/v1/search/workflows | Search Workflows |

# **searchJobsApiV1SearchJobsGet**

> any searchJobsApiV1SearchJobsGet()

### Example

```typescript
import { SearchApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

const { status, data } = await apiInstance.searchJobsApiV1SearchJobsGet();
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

# **searchWorkflowsApiV1SearchWorkflowsGet**

> WorkflowListResponse searchWorkflowsApiV1SearchWorkflowsGet()

Search workflows with filters and pagination.

### Example

```typescript
import { SearchApi, Configuration } from "./api";

const configuration = new Configuration();
const apiInstance = new SearchApi(configuration);

let tags: string; //Filter by tags (comma-separated) (optional) (default to undefined)
let name: string; //Filter by workflow name (optional) (default to undefined)
let startAt: string; //Filter workflows started after this time (optional) (default to undefined)
let endAt: string; //Filter workflows ended before this time (optional) (default to undefined)
let offset: number; //Number of records to skip (optional) (default to 0)
let limit: number; //Maximum number of records to return (optional) (default to 50)

const { status, data } =
  await apiInstance.searchWorkflowsApiV1SearchWorkflowsGet(
    tags,
    name,
    startAt,
    endAt,
    offset,
    limit,
  );
```

### Parameters

| Name        | Type         | Description                              | Notes                            |
| ----------- | ------------ | ---------------------------------------- | -------------------------------- |
| **tags**    | [**string**] | Filter by tags (comma-separated)         | (optional) defaults to undefined |
| **name**    | [**string**] | Filter by workflow name                  | (optional) defaults to undefined |
| **startAt** | [**string**] | Filter workflows started after this time | (optional) defaults to undefined |
| **endAt**   | [**string**] | Filter workflows ended before this time  | (optional) defaults to undefined |
| **offset**  | [**number**] | Number of records to skip                | (optional) defaults to 0         |
| **limit**   | [**number**] | Maximum number of records to return      | (optional) defaults to 50        |

### Return type

**WorkflowListResponse**

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
