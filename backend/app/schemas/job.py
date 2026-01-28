import uuid
from datetime import datetime
from typing import Any
from app.models.job import Status

from pydantic import BaseModel, ConfigDict


class JobResponse(BaseModel):
    """Schema for job response"""

    id: int | None = None
    rule_id: int | None = None
    rule_name: str | None = None
    workflow_id: uuid.UUID | None = None
    status: str | None = None
    started_at: datetime | None = None
    end_time: datetime | None = None
    threads: int | None = None
    priority: int | None = None
    message: str | None = None
    shellcmd: str | None = None
    wildcards: dict[str, Any] | None = None
    reason: str | None = None
    resources: dict[str, Any] | None = None

    model_config = ConfigDict(from_attributes=True)


class JobListResponse(BaseModel):
    """Schema for job list response"""

    jobs: list[JobResponse]
    total: int
    limit: int
    offset: int


class JobDetailResponse(BaseModel):
    rule_name: str
    status: Status 
    workflow_id: uuid.UUID | None = None
    started_at: datetime | None = None
    end_time: datetime | None = None
    message: str | None = None
    shellcmd: str | None = None
    wildcards: dict[str, Any] | None = None
    reason: str | None = None
    resources: dict[str, Any] | None = None
    directory: str | None = None
    input: list[str] | None = None
    output: list[str] | None = None
    log: list[str] | None = None
