# UtilsApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getAllTagsApiV1UtilsTagsGet**](#getalltagsapiv1utilstagsget) | **GET** /api/v1/utils/tags | Get All Tags|

# **getAllTagsApiV1UtilsTagsGet**
> Array<string | null> getAllTagsApiV1UtilsTagsGet()


### Example

```typescript
import {
    UtilsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new UtilsApi(configuration);

const { status, data } = await apiInstance.getAllTagsApiV1UtilsTagsGet();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

