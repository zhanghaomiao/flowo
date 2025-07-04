# SummaryApi

All URIs are relative to *http://localhost*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**getActivityApiV1SummaryActivityGet**](#getactivityapiv1summaryactivityget) | **GET** /api/v1/summary/activity | Get Activity|
|[**getRuleDurationApiV1SummaryRuleDurationGet**](#getruledurationapiv1summaryruledurationget) | **GET** /api/v1/summary/rule_duration | Get Rule Duration|
|[**getRuleErrorApiV1SummaryRuleErrorGet**](#getruleerrorapiv1summaryruleerrorget) | **GET** /api/v1/summary/rule_error | Get Rule Error|
|[**getStatusApiV1SummaryStatusGet**](#getstatusapiv1summarystatusget) | **GET** /api/v1/summary/status | Get Status|
|[**getSystemResourcesApiV1SummaryResourcesGet**](#getsystemresourcesapiv1summaryresourcesget) | **GET** /api/v1/summary/resources | Get System Resources|
|[**getUserSummaryApiV1SummaryUserGet**](#getusersummaryapiv1summaryuserget) | **GET** /api/v1/summary/user | Get User Summary|
|[**postPruningApiV1SummaryPruningPost**](#postpruningapiv1summarypruningpost) | **POST** /api/v1/summary/pruning | Post Pruning|

# **getActivityApiV1SummaryActivityGet**
> { [key: string]: number; } getActivityApiV1SummaryActivityGet()


### Example

```typescript
import {
    SummaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SummaryApi(configuration);

let item: 'rule' | 'user' | 'tag'; // (default to undefined)
let startAt: string; // (optional) (default to undefined)
let endAt: string; // (optional) (default to undefined)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.getActivityApiV1SummaryActivityGet(
    item,
    startAt,
    endAt,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **item** | [**&#39;rule&#39; | &#39;user&#39; | &#39;tag&#39;**]**Array<&#39;rule&#39; &#124; &#39;user&#39; &#124; &#39;tag&#39;>** |  | defaults to undefined|
| **startAt** | [**string**] |  | (optional) defaults to undefined|
| **endAt** | [**string**] |  | (optional) defaults to undefined|
| **limit** | [**number**] |  | (optional) defaults to 20|


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

# **getRuleDurationApiV1SummaryRuleDurationGet**
> { [key: string]: { [key: string]: number; }; } getRuleDurationApiV1SummaryRuleDurationGet()


### Example

```typescript
import {
    SummaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SummaryApi(configuration);

let startAt: string; // (optional) (default to undefined)
let endAt: string; // (optional) (default to undefined)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.getRuleDurationApiV1SummaryRuleDurationGet(
    startAt,
    endAt,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **startAt** | [**string**] |  | (optional) defaults to undefined|
| **endAt** | [**string**] |  | (optional) defaults to undefined|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**{ [key: string]: { [key: string]: number; }; }**

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

# **getRuleErrorApiV1SummaryRuleErrorGet**
> { [key: string]: { [key: string]: any; }; } getRuleErrorApiV1SummaryRuleErrorGet()


### Example

```typescript
import {
    SummaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SummaryApi(configuration);

let startAt: string; // (optional) (default to undefined)
let endAt: string; // (optional) (default to undefined)
let limit: number; // (optional) (default to 20)

const { status, data } = await apiInstance.getRuleErrorApiV1SummaryRuleErrorGet(
    startAt,
    endAt,
    limit
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **startAt** | [**string**] |  | (optional) defaults to undefined|
| **endAt** | [**string**] |  | (optional) defaults to undefined|
| **limit** | [**number**] |  | (optional) defaults to 20|


### Return type

**{ [key: string]: { [key: string]: any; }; }**

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

# **getStatusApiV1SummaryStatusGet**
> StatusSummary getStatusApiV1SummaryStatusGet()


### Example

```typescript
import {
    SummaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SummaryApi(configuration);

let item: 'job' | 'workflow'; // (default to undefined)

const { status, data } = await apiInstance.getStatusApiV1SummaryStatusGet(
    item
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **item** | [**&#39;job&#39; | &#39;workflow&#39;**]**Array<&#39;job&#39; &#124; &#39;workflow&#39;>** |  | defaults to undefined|


### Return type

**StatusSummary**

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

# **getSystemResourcesApiV1SummaryResourcesGet**
> any getSystemResourcesApiV1SummaryResourcesGet()


### Example

```typescript
import {
    SummaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SummaryApi(configuration);

const { status, data } = await apiInstance.getSystemResourcesApiV1SummaryResourcesGet();
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
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Successful Response |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getUserSummaryApiV1SummaryUserGet**
> UserSummary getUserSummaryApiV1SummaryUserGet()


### Example

```typescript
import {
    SummaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SummaryApi(configuration);

const { status, data } = await apiInstance.getUserSummaryApiV1SummaryUserGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**UserSummary**

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

# **postPruningApiV1SummaryPruningPost**
> { [key: string]: number; } postPruningApiV1SummaryPruningPost()


### Example

```typescript
import {
    SummaryApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new SummaryApi(configuration);

const { status, data } = await apiInstance.postPruningApiV1SummaryPruningPost();
```

### Parameters
This endpoint does not have any parameters.


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

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

