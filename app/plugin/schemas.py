import uuid
from typing import Any

from pydantic import BaseModel, Field


class ErrorSchema(BaseModel):
    exception: str | None = None
    location: str | None = None
    rule: str | None = None
    traceback: str | None = None
    file: str | None = None
    line: str | None = None


class RuleInfoSchema(BaseModel):
    name: str
    code: str | None = None
    language: str | None = None


class WorkflowStartedSchema(BaseModel):
    workflow_id: uuid.UUID
    snakefile: str
    rules: list[RuleInfoSchema] = Field(default_factory=list)


class RunInfoSchema(BaseModel):
    stats: dict[str, Any] = Field(default_factory=dict)


class JobInfoSchema(BaseModel):
    job_id: int
    rule_name: str
    threads: int
    input: list[str] | None = None
    output: list[str] | None = None
    log: list[str] | None = None
    benchmark: list[str] | None = None
    rule_msg: str | None = None
    wildcards: dict[str, Any] = Field(default_factory=dict)
    reason: str | None = None
    shellcmd: str | None = None
    priority: int | None = None
    resources: dict[str, Any] = Field(default_factory=dict)


class JobStartedSchema(BaseModel):
    job_ids: list[int]


class JobFinishedSchema(BaseModel):
    job_id: int


class JobErrorSchema(BaseModel):
    job_id: int


class RuleGraphSchema(BaseModel):
    rulegraph: dict[str, Any]


class GroupInfoSchema(BaseModel):
    group_id: int
    jobs: list[Any] = Field(default_factory=list)


class GroupErrorSchema(BaseModel):
    groupid: int
    aux_logs: list[Any] = Field(default_factory=list)
    job_error_info: dict[str, Any] = Field(default_factory=dict)
