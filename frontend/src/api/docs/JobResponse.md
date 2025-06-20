# JobResponse

Schema for job response

## Properties

| Name            | Type                        | Description | Notes                             |
| --------------- | --------------------------- | ----------- | --------------------------------- |
| **id**          | **number**                  |             | [optional] [default to undefined] |
| **rule_id**     | **number**                  |             | [optional] [default to undefined] |
| **rule_name**   | **string**                  |             | [optional] [default to undefined] |
| **workflow_id** | **string**                  |             | [optional] [default to undefined] |
| **status**      | **string**                  |             | [optional] [default to undefined] |
| **started_at**  | **string**                  |             | [optional] [default to undefined] |
| **end_time**    | **string**                  |             | [optional] [default to undefined] |
| **threads**     | **number**                  |             | [optional] [default to undefined] |
| **priority**    | **number**                  |             | [optional] [default to undefined] |
| **message**     | **string**                  |             | [optional] [default to undefined] |
| **shellcmd**    | **string**                  |             | [optional] [default to undefined] |
| **wildcards**   | **{ [key: string]: any; }** |             | [optional] [default to undefined] |
| **reason**      | **string**                  |             | [optional] [default to undefined] |
| **resources**   | **{ [key: string]: any; }** |             | [optional] [default to undefined] |

## Example

```typescript
import { JobResponse } from "./api";

const instance: JobResponse = {
  id,
  rule_id,
  rule_name,
  workflow_id,
  status,
  started_at,
  end_time,
  threads,
  priority,
  message,
  shellcmd,
  wildcards,
  reason,
  resources,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
