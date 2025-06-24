# JobDetailResponse


## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**rule_name** | **string** |  | [default to undefined]
**workflow_id** | **string** |  | [optional] [default to undefined]
**status** | **string** |  | [optional] [default to undefined]
**started_at** | **string** |  | [optional] [default to undefined]
**end_time** | **string** |  | [optional] [default to undefined]
**message** | **string** |  | [optional] [default to undefined]
**shellcmd** | **string** |  | [optional] [default to undefined]
**wildcards** | **{ [key: string]: any; }** |  | [optional] [default to undefined]
**reason** | **string** |  | [optional] [default to undefined]
**resources** | **{ [key: string]: any; }** |  | [optional] [default to undefined]
**directory** | **string** |  | [optional] [default to undefined]
**input** | **Array&lt;string&gt;** |  | [optional] [default to undefined]
**output** | **Array&lt;string&gt;** |  | [default to undefined]
**log** | **Array&lt;string&gt;** |  | [optional] [default to undefined]

## Example

```typescript
import { JobDetailResponse } from './api';

const instance: JobDetailResponse = {
    rule_name,
    workflow_id,
    status,
    started_at,
    end_time,
    message,
    shellcmd,
    wildcards,
    reason,
    resources,
    directory,
    input,
    output,
    log,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
