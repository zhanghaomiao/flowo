from typing import Optional, Dict, List
from pydantic import BaseModel, ConfigDict
from datetime import datetime
import uuid


class WorkflowResponse(BaseModel):
    """Schema for workflow response"""

    id: uuid.UUID
    snakefile: bool
    started_at: Optional[datetime] = None
    end_time: Optional[datetime] = None
    status: str
    # command_line: Optional[str] = None
    # dryrun: bool
    # run_info: Optional[Dict[str, int]] = None
    user: Optional[str] = None
    name: Optional[str] = None
    configfiles: bool
    # directory: Optional[str] = None
    # logfile: Optional[str] = None
    tags: Optional[List[str]] = None
    progress: Optional[float] = None

    model_config = ConfigDict(from_attributes=True)


class WorkflowListResponse(BaseModel):
    """Schema for workflow list response"""

    workflows: List[WorkflowResponse]
    total: int
    limit: int
    offset: int


class WorkflowDetialResponse(BaseModel):
    workflow_id: uuid.UUID
    name: Optional[str] = None
    user: Optional[str] = None
    tags: Optional[List[str]] = None

    started_at: Optional[datetime]
    end_time: Optional[datetime]
    status: str
    progress: Optional[float] = None

    config: dict | None = None
    snakefile: Optional[str]
    directory: Optional[str] = None
    configfiles: Optional[List[str]] = None


class RuleStatusResponse(BaseModel):
    success: str
    running: str
    error: str
    total: str
    status: str
