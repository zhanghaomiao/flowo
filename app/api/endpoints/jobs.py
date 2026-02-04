from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session import get_async_session
from app.core.users import current_active_user
from app.models import User
from app.schemas import (
    JobDetailResponse,
)
from app.services.job import JobService
from app.services.workflow import WorkflowService

router = APIRouter()


@router.get("/{job_id}/detail", response_model=JobDetailResponse)
async def get_job(
    job_id: int,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = JobService(db)
    # Check ownership via workflow
    query = await service.get_job_details_with_id(job_id)
    wf_service = WorkflowService(db)
    wf = await wf_service.get_workflow(query.workflow_id)
    if not wf or (wf.user_id != user.id and not user.is_superuser):
        raise HTTPException(status_code=404, detail="Job not found")

    return query


@router.get("/{job_id}/logs", response_model=dict[str, str])
async def get_logs(
    job_id: int,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = JobService(db)
    # Check ownership
    query = await service.get_job_details_with_id(job_id)
    wf_service = WorkflowService(db)
    wf = await wf_service.get_workflow(query.workflow_id)
    if not wf or (wf.user_id != user.id and not user.is_superuser):
        raise HTTPException(status_code=404, detail="Job not found")

    return await service.get_job_logs_with_id(job_id=job_id)
