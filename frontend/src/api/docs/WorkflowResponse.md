# WorkflowResponse

Schema for workflow response

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** |  | [default to undefined]
**directory** | **string** |  | [optional] [default to undefined]
**snakefile** | **boolean** |  | [default to undefined]
**started_at** | **string** |  | [optional] [default to undefined]
**end_time** | **string** |  | [optional] [default to undefined]
**status** | **string** |  | [default to undefined]
**user** | **string** |  | [optional] [default to undefined]
**name** | **string** |  | [optional] [default to undefined]
**configfiles** | **boolean** |  | [default to undefined]
**tags** | **Array&lt;string&gt;** |  | [optional] [default to undefined]
**progress** | **number** |  | [optional] [default to undefined]
**total_jobs** | **number** |  | [default to undefined]

## Example

```typescript
import { WorkflowResponse } from './api';

const instance: WorkflowResponse = {
    id,
    directory,
    snakefile,
    started_at,
    end_time,
    status,
    user,
    name,
    configfiles,
    tags,
    progress,
    total_jobs,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
