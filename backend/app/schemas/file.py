from pydantic import BaseModel, ConfigDict
from typing import List, Optional


class FileResponse(BaseModel):
    input: list[str]
    output: list[str] = None
    log: list[str] = None

    model_config = ConfigDict(from_attributes=True)


class TreeDataNode(BaseModel):
    title: str
    key: str
    icon: Optional[str] = None
    children: Optional[List["TreeDataNode"]] = None
    isLeaf: Optional[bool] = None
