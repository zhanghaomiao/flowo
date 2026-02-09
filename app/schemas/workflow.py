import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class WorkflowResponse(BaseModel):
    """Schema for workflow response"""

    id: uuid.UUID
    directory: str | None = None
    snakefile: bool
    started_at: datetime | None = None
    end_time: datetime | None = None
    status: str
    user: str | None = None
    name: str | None = None
    configfiles: bool
    tags: list[str] | None = None
    progress: float | None = None
    total_jobs: int

    model_config = ConfigDict(from_attributes=True)


class WorkflowListResponse(BaseModel):
    """Schema for workflow list response"""

    workflows: list[WorkflowResponse]
    total: int | None
    limit: int | None
    offset: int | None


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
    flowo_directory: str | None = None


class RuleStatusResponse(BaseModel):
    success: str
    running: str
    error: str
    total: str
    status: str
