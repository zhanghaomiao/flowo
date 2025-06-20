import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class WorkflowResponse(BaseModel):
    """Schema for workflow response"""

    id: uuid.UUID
    snakefile: bool
    started_at: datetime | None = None
    end_time: datetime | None = None
    status: str
    # command_line: Optional[str] = None
    # dryrun: bool
    # run_info: Optional[Dict[str, int]] = None
    user: str | None = None
    name: str | None = None
    configfiles: bool
    # directory: Optional[str] = None
    # logfile: Optional[str] = None
    tags: list[str] | None = None
    progress: float | None = None

    model_config = ConfigDict(from_attributes=True)


class WorkflowListResponse(BaseModel):
    """Schema for workflow list response"""

    workflows: list[WorkflowResponse]
    total: int
    limit: int
    offset: int


class WorkflowDetialResponse(BaseModel):
    workflow_id: uuid.UUID
    name: str | None = None
    user: str | None = None
    tags: list[str] | None = None

    started_at: datetime | None
    end_time: datetime | None
    status: str
    progress: float | None = None

    config: dict | None = None
    snakefile: str | None
    directory: str | None = None
    configfiles: list[str] | None = None


class RuleStatusResponse(BaseModel):
    success: str
    running: str
    error: str
    total: str
    status: str
