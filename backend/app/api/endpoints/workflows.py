import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.session import get_db
from app.models import Status
from app.schemas import (
    JobListResponse,
    Message,
    RuleStatusResponse,
    WorkflowDetialResponse,
    WorkflowListResponse,
)
from app.services import JobService, WorkflowService

router = APIRouter()


@router.get("/users", response_model=list[str])
def get_all_users(db: Session = Depends(get_db)):
    return WorkflowService(db).get_all_users()


@router.get("/{workflow_id}/jobs", response_model=JobListResponse)
def get_jobs(
    workflow_id: uuid.UUID,
    limit: int | None = Query(50, ge=1, description="Maximum number of jobs to return"),
    offset: int | None = Query(0, ge=0, description="Number of jobs to skip"),
    order_by_started: bool = Query(
        True, description="Order by start time (True) or ID (False)"
    ),
    descending: bool = Query(
        True, description="Order in descending order (newest first)"
    ),
    db: Session = Depends(get_db),
    rule_name: str | None = Query(None, description="Filter jobs by rule_name"),
    status: Status | None = Query(None, description="Filter jobs by status"),
):
    return JobService(db).get_jobs_by_workflow_id(
        workflow_id=workflow_id,
        limit=limit,
        offset=offset,
        order_by_started=order_by_started,
        descending=descending,
        rule_name=rule_name,
        status=status,
    )


@router.get("/", response_model=WorkflowListResponse)
def get_workflows(
    db: Session = Depends(get_db),
    limit: int | None = Query(
        50, ge=1, description="Maximum number of workflows to return"
    ),
    offset: int | None = Query(0, ge=0, description="Number of workflows to skip"),
    order_by_started: bool = Query(
        True, description="Order by start time (True) or ID (False)"
    ),
    descending: bool = Query(
        True, description="Order in descending order (newest first)"
    ),
    user: str | None = Query(
        None, description="Filter by user who started the workflow"
    ),
    status: Status | None = Query(
        None, description="Filter by workflow status (RUNNING, SUCCESS, ERROR, UNKNOWN)"
    ),
    tags: str | None = Query(None, description="Filter by tags (comma-separated)"),
    name: str | None = Query(None, description="Filter by workflow name"),
    start_at: datetime | None = Query(
        None, description="Filter workflows started after this time"
    ),
    end_at: datetime | None = Query(
        None, description="Filter workflows ended before this time"
    ),
):
    return WorkflowService(db).list_all_workflows(
        limit=limit,
        offset=offset,
        order_by_started=order_by_started,
        descending=descending,
        user=user,
        tags=tags,
        status=status,
        name=name,
        start_at=start_at,
        end_at=end_at,
    )


@router.get("/{workflow_id}/rule_graph", response_model=dict[str, Any])
def get_rule_graph(workflow_id: uuid.UUID, db: Session = Depends(get_db)):
    return WorkflowService(db).get_workflow_rule_graph_data(workflow_id)


@router.get("/{workflow_id}/detail", response_model=WorkflowDetialResponse)
def get_detail(workflow_id: uuid.UUID, db: Session = Depends(get_db)):
    return WorkflowService(db).get_detail(workflow_id=workflow_id)


@router.get("/{workflow_id}/rule_status", response_model=dict[str, RuleStatusResponse])
def get_rule_status(workflow_id: uuid.UUID, db: Session = Depends(get_db)):
    return WorkflowService(db).get_rule_status(workflow_id=workflow_id)


@router.get("/{workflow_id}/snakefile")
def get_snakefile(workflow_id: uuid.UUID, db: Session = Depends(get_db)):
    return WorkflowService(db).get_snakefile(workflow_id)


@router.get("/{workflow_id}/configfiles", response_model=dict[str, str])
def get_configfiles(workflow_id: uuid.UUID, db: Session = Depends(get_db)):
    return WorkflowService(db).get_configfiles(workflow_id=workflow_id)


@router.get("/{workflow_id}/progress", response_model=dict[str, float])
def get_progress(
    workflow_id: uuid.UUID,
    return_total_jobs_number: bool = False,
    db: Session = Depends(get_db),
):
    data = WorkflowService(db).get_progress(workflow_id=workflow_id)
    if return_total_jobs_number:
        return {"total": data.get("total")}
    else:
        data["progress"] = round(
            data.get("completed", 0) / data.get("total", 1) * 100, 2
        )
        data.pop("total")
        return data


@router.get("/{workflow_id}/timelines", response_model=dict[str, list])
def get_timelines(workflow_id: uuid.UUID, db: Session = Depends(get_db)):
    return WorkflowService(db).get_timelines_with_id(workflow_id=workflow_id)


@router.delete("/{workflow_id}")
def delete_workflow(workflow_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        JobService(db).delete_jobs(workflow_id)
        WorkflowService(db).delete_workflow(workflow_id)
        return Message(message="Workflow and its jobs have been successfully deleted.")
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to delete workflow: " + str(e),
        ) from e


@router.get("/workflow_id_by_name/{name}")
def get_workflow_id_by_name(
    name: str, db: Session = Depends(get_db)
) -> uuid.UUID | str:
    workflow_id = WorkflowService(db).get_workflow_id_by_name(name)
    return workflow_id if workflow_id else ""
