import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session import get_async_session
from app.core.users import current_active_user
from app.models import Status, User
from app.schemas import (
    JobListResponse,
    Message,
    RuleStatusResponse,
    WorkflowDetialResponse,
    WorkflowListResponse,
)
from app.services.job import JobService
from app.services.workflow import WorkflowService
from app.utils.paths import PathContent

router = APIRouter()


@router.get("/", response_model=WorkflowListResponse)
async def get_workflows(
    db: AsyncSession = Depends(get_async_session),
    current_user: User = Depends(current_active_user),
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
    user: str | None = Query(None, description="Filter by user string (legacy)"),
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
    # Only show current user's workflows unless superuser
    filter_user_id = current_user.id if not current_user.is_superuser else None

    return await WorkflowService(db).list_all_workflows(
        limit=limit,
        offset=offset,
        order_by_started=order_by_started,
        descending=descending,
        user=user,
        user_id=filter_user_id,
        tags=tags,
        status=status,
        name=name,
        start_at=start_at,
        end_at=end_at,
    )


@router.get("/{workflow_id}/jobs", response_model=JobListResponse)
async def get_jobs(
    workflow_id: uuid.UUID,
    limit: int | None = Query(50, ge=1, description="Maximum number of jobs to return"),
    offset: int | None = Query(0, ge=0, description="Number of jobs to skip"),
    order_by_started: bool = Query(
        True, description="Order by start time (True) or ID (False)"
    ),
    descending: bool = Query(
        True, description="Order in descending order (newest first)"
    ),
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
    rule_name: str | None = Query(None, description="Filter jobs by rule_name"),
    status: Status | None = Query(None, description="Filter jobs by status"),
):
    # Verify workflow ownership or allow if user is superuser
    service = WorkflowService(db)
    wf = await service.get_workflow(workflow_id)
    if not wf or (wf.user_id != user.id and not user.is_superuser):
        raise HTTPException(status_code=404, detail="Workflow not found")

    return await JobService(db).get_jobs_by_workflow_id(
        workflow_id=workflow_id,
        limit=limit,
        offset=offset,
        order_by_started=order_by_started,
        descending=descending,
        rule_name=rule_name,
        status=status,
    )


@router.get("/{workflow_id}/rule_graph", response_model=dict[str, Any])
async def get_rule_graph(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = WorkflowService(db)
    wf = await service.get_workflow(workflow_id)
    if not wf or (wf.user_id != user.id and not user.is_superuser):
        raise HTTPException(status_code=404, detail="Workflow not found")
    return await service.get_workflow_rule_graph_data(workflow_id)


@router.get("/{workflow_id}/detail", response_model=WorkflowDetialResponse)
async def get_detail(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = WorkflowService(db)
    wf = await service.get_workflow(workflow_id)
    if not wf or (wf.user_id != user.id and not user.is_superuser):
        raise HTTPException(status_code=404, detail="Workflow not found")
    return await service.get_detail(workflow_id=workflow_id)


@router.get("/{workflow_id}/rule_status", response_model=dict[str, RuleStatusResponse])
async def get_rule_status(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = WorkflowService(db)
    wf = await service.get_workflow(workflow_id)
    if not wf or (wf.user_id != user.id and not user.is_superuser):
        raise HTTPException(status_code=404, detail="Workflow not found")
    return await service.get_rule_status(workflow_id=workflow_id)


@router.get("/{workflow_id}/snakefile", response_model=PathContent)
async def get_snakefile(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = WorkflowService(db)
    wf = await service.get_workflow(workflow_id)
    if not wf or (wf.user_id != user.id and not user.is_superuser):
        raise HTTPException(status_code=404, detail="Workflow not found")
    return await service.get_snakefile(workflow_id)


@router.get("/{workflow_id}/log", response_model=PathContent)
async def get_workflow_log(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = WorkflowService(db)
    wf = await service.get_workflow(workflow_id)
    if not wf or (wf.user_id != user.id and not user.is_superuser):
        raise HTTPException(status_code=404, detail="Workflow not found")
    return await service.get_workflow_log(workflow_id)


@router.get("/{workflow_id}/configfiles", response_model=dict[str, str])
async def get_configfiles(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = WorkflowService(db)
    wf = await service.get_workflow(workflow_id)
    if not wf or (wf.user_id != user.id and not user.is_superuser):
        raise HTTPException(status_code=404, detail="Workflow not found")
    return await service.get_configfiles(workflow_id=workflow_id)


@router.get("/{workflow_id}/progress", response_model=dict[str, float])
async def get_progress(
    workflow_id: uuid.UUID,
    return_total_jobs_number: bool = False,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = WorkflowService(db)
    wf = await service.get_workflow(workflow_id)
    if not wf or (wf.user_id != user.id and not user.is_superuser):
        raise HTTPException(status_code=404, detail="Workflow not found")

    data = await service.get_progress(workflow_id=workflow_id)
    if return_total_jobs_number:
        return {"total": data.get("total")}
    else:
        data["progress"] = round(
            data.get("completed", 0) / data.get("total", 1) * 100, 2
        )
        data.pop("total")
        return data


@router.get("/{workflow_id}/timelines", response_model=dict[str, list])
async def get_timelines(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = WorkflowService(db)
    wf = await service.get_workflow(workflow_id)
    if not wf or (wf.user_id != user.id and not user.is_superuser):
        raise HTTPException(status_code=404, detail="Workflow not found")
    return await service.get_timelines_with_id(workflow_id=workflow_id)


@router.delete("/{workflow_id}")
async def delete_workflow(
    workflow_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    wf_service = WorkflowService(db)
    wf = await wf_service.get_workflow(workflow_id)
    if not wf or (wf.user_id != user.id and not user.is_superuser):
        raise HTTPException(status_code=404, detail="Workflow not found")

    try:
        await JobService(db).delete_jobs(workflow_id)
        await wf_service.delete_workflow(workflow_id)
        return Message(message="Workflow and its jobs have been successfully deleted.")
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to delete workflow: " + str(e),
        ) from e


@router.get("/by_name", response_model=uuid.UUID | str)
async def get_workflow_id_by_name(
    name: str = Query(..., description="Workflow name to search for"),
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
) -> uuid.UUID | str:
    workflow_id = await WorkflowService(db).get_workflow_id_by_name(name)
    return workflow_id if workflow_id else ""
