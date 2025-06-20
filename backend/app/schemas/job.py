from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict
from datetime import datetime
import uuid
from sqlalchemy.orm import Mapped


class JobResponse(BaseModel):
    """Schema for job response"""

    id: int = None
    rule_id: int = None
    rule_name: str = None
    workflow_id: uuid.UUID = None
    status: str = None
    started_at: Optional[datetime] = None
    end_time: Optional[datetime] = None
    threads: Optional[int] = None
    priority: Optional[int] = None
    message: Optional[str] = None
    shellcmd: Optional[str] = None
    wildcards: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None
    resources: Optional[Dict[str, Any]] = None

    model_config = ConfigDict(from_attributes=True)


class JobListResponse(BaseModel):
    """Schema for job list response"""

    jobs: List[JobResponse]
    total: int
    limit: int
    offset: int


class JobDetailResponse(BaseModel):
    rule_name: str
    workflow_id: uuid.UUID = None
    status: str = None
    started_at: Optional[datetime] = None
    end_time: Optional[datetime] = None
    message: Optional[str] = None
    shellcmd: Optional[str] = None
    wildcards: Optional[Dict[str, Any]] = None
    reason: Optional[str] = None
    resources: Optional[Dict[str, Any]] = None
    directory: Optional[str] = None
    input: list[str] = None
    output: list[str]
    log: list[str] = None
