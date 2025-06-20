# WorkflowResponse

Schema for workflow response

## Properties

Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **string** |  | [default to undefined]
**snakefile** | **string** |  | [optional] [default to undefined]
**started_at** | **string** |  | [optional] [default to undefined]
**end_time** | **string** |  | [optional] [default to undefined]
**status** | **string** |  | [default to undefined]
**command_line** | **string** |  | [optional] [default to undefined]
**dryrun** | **boolean** |  | [default to undefined]
**run_info** | **{ [key: string]: number; }** |  | [optional] [default to undefined]
**user** | **string** |  | [optional] [default to undefined]
**name** | **string** |  | [optional] [default to undefined]
**configfiles** | **Array&lt;string&gt;** |  | [optional] [default to undefined]
**directory** | **string** |  | [optional] [default to undefined]
**logfile** | **string** |  | [optional] [default to undefined]

## Example

```typescript
import { WorkflowResponse } from './api';

const instance: WorkflowResponse = {
    id,
    snakefile,
    started_at,
    end_time,
    status,
    command_line,
    dryrun,
    run_info,
    user,
    name,
    configfiles,
    directory,
    logfile,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
