# TreeDataNode

## Properties

| Name         | Type                                             | Description | Notes                             |
| ------------ | ------------------------------------------------ | ----------- | --------------------------------- |
| **title**    | **string**                                       |             | [default to undefined]            |
| **key**      | **string**                                       |             | [default to undefined]            |
| **icon**     | **string**                                       |             | [optional] [default to undefined] |
| **children** | [**Array&lt;TreeDataNode&gt;**](TreeDataNode.md) |             | [optional] [default to undefined] |
| **isLeaf**   | **boolean**                                      |             | [optional] [default to undefined] |

## Example

```typescript
import { TreeDataNode } from "./api";

const instance: TreeDataNode = {
  title,
  key,
  icon,
  children,
  isLeaf,
};
```

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)
