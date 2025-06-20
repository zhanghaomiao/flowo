from fastapi import APIRouter, Depends, Query, HTTPException
from typing import List, Optional, Dict, Any, Union
from sqlalchemy.orm import Session
from datetime import datetime
import uuid
import logging
from app.schemas import (
    JobListResponse,
    Message,
    WorkflowListResponse,
    WorkflowDetialResponse,
    RuleStatusResponse,
)
from app.models import Status
from app.services import JobService, WorkflowService
from app.core.session import get_db

router = APIRouter()


@router.get("/users", response_model=list[str])
def get_all_users(db: Session = Depends(get_db)):
    return WorkflowService(db).get_all_users()


@router.get("/{workflow_id}/jobs", response_model=JobListResponse)
def get_jobs(
    workflow_id: uuid.UUID,
    limit: Optional[int] = Query(
        50, ge=1, description="Maximum number of jobs to return"
    ),
    offset: Optional[int] = Query(0, ge=0, description="Number of jobs to skip"),
    order_by_started: bool = Query(
        True, description="Order by start time (True) or ID (False)"
    ),
    descending: bool = Query(
        True, description="Order in descending order (newest first)"
    ),
    db: Session = Depends(get_db),
    rule_name: Optional[str] = Query(None, description="Filter jobs by rule_name"),
    status: Optional[Status] = Query(None, description="Filter jobs by status"),
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
    limit: Optional[int] = Query(
        50, ge=1, description="Maximum number of workflows to return"
    ),
    offset: Optional[int] = Query(0, ge=0, description="Number of workflows to skip"),
    order_by_started: bool = Query(
        True, description="Order by start time (True) or ID (False)"
    ),
    descending: bool = Query(
        True, description="Order in descending order (newest first)"
    ),
    user: Optional[str] = Query(
        None, description="Filter by user who started the workflow"
    ),
    status: Optional[Status] = Query(
        None, description="Filter by workflow status (RUNNING, SUCCESS, ERROR, UNKNOWN)"
    ),
    tags: Optional[str] = Query(None, description="Filter by tags (comma-separated)"),
    name: Optional[str] = Query(None, description="Filter by workflow name"),
    start_at: Optional[datetime] = Query(
        None, description="Filter workflows started after this time"
    ),
    end_at: Optional[datetime] = Query(
        None, description="Filter workflows ended before this time"
    ),
):
    return WorkflowService(db).list_all_workflows_dev(
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


@router.get("/{workflow_id}/rule_graph", response_model=Dict[str, Any])
def get_rule_graph(workflow_id: str, db: Session = Depends(get_db)):
    return WorkflowService(db).get_workflow_rule_graph_data(workflow_id)


@router.get("/{workflow_id}/detail", response_model=WorkflowDetialResponse)
def get_detail(workflow_id: str, db: Session = Depends(get_db)):
    return WorkflowService(db).get_detail(workflow_id=workflow_id)


@router.get("/{workflow_id}/rule_status", response_model=Dict[str, RuleStatusResponse])
def get_rule_status(workflow_id: str, db: Session = Depends(get_db)):
    return WorkflowService(db).get_rule_status(workflow_id=workflow_id)


@router.get("/{workflow_id}/snakefile")
def get_snakefile(workflow_id: str, db: Session = Depends(get_db)):
    return WorkflowService(db).get_snakefile(workflow_id)


@router.get("/{workflow_id}/configfiles", response_model=Dict[str, str])
def get_configfiles(workflow_id: str, db: Session = Depends(get_db)):
    return WorkflowService(db).get_configfiles(workflow_id=workflow_id)


@router.get("/{workflow_id}/progress", response_model=Dict[str, float])
def get_progress(
    workflow_id: str,
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


@router.get("/{workflow_id}/timelines", response_model=Dict[str, list])
def get_timelines(workflow_id: str, db: Session = Depends(get_db)):
    return WorkflowService(db).get_timelines_with_id(workflow_id=workflow_id)


@router.delete("/{workflow_id}")
def delete_workflow(workflow_id: uuid.UUID, db: Session = Depends(get_db)):
    try:
        JobService(db).delete_jobs(workflow_id)
        WorkflowService(db).delete_workflow(workflow_id)
        return Message(message="Workflow and its jobs have been successfully deleted.")
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))
