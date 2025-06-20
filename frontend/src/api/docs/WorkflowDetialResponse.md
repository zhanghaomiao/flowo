# WorkflowDetialResponse

## Properties

| Name            | Type                        | Description | Notes                             |
| --------------- | --------------------------- | ----------- | --------------------------------- |
| **workflow_id** | **string**                  |             | [default to undefined]            |
| **name**        | **string**                  |             | [optional] [default to undefined] |
| **user**        | **string**                  |             | [optional] [default to undefined] |
| **tags**        | **Array&lt;string&gt;**     |             | [optional] [default to undefined] |
| **started_at**  | **string**                  |             | [default to undefined]            |
| **end_time**    | **string**                  |             | [default to undefined]            |
| **status**      | **string**                  |             | [default to undefined]            |
| **progress**    | **number**                  |             | [optional] [default to undefined] |
| **config**      | **{ [key: string]: any; }** |             | [optional] [default to undefined] |
| **snakefile**   | **string**                  |             | [default to undefined]            |
| **directory**   | **string**                  |             | [optional] [default to undefined] |
| **configfiles** | **Array&lt;string&gt;**     |             | [optional] [default to undefined] |

## Example

```typescript
import { WorkflowDetialResponse } from "./api";

const instance: WorkflowDetialResponse = {
  workflow_id,
  name,
  user,
  tags,
  started_at,
  end_time,
  status,
  progress,
  config,
  snakefile,
  directory,
  configfiles,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
