
from pydantic import BaseModel, ConfigDict


class FileResponse(BaseModel):
    input: list[str]
    output: list[str] = None
    log: list[str] = None

    model_config = ConfigDict(from_attributes=True)


class TreeDataNode(BaseModel):
    title: str
    key: str
    icon: str | None = None
    children: list["TreeDataNode"] | None = None
    isLeaf: bool | None = None
