from datetime import datetime
from typing import Literal

import psutil
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session import get_async_session
from app.core.users import current_active_user
from app.models import User
from app.schemas import (
    ResourcesSummary,
    StatusSummary,
    SystemHealthResponse,
)
from app.services.summary import SummaryService
from app.services.workflow import WorkflowService

router = APIRouter()


@router.get("/resources", response_model=ResourcesSummary)
async def get_system_resources(
    user: User = Depends(current_active_user),
):
    total_cpus = psutil.cpu_count(logical=True)
    if not total_cpus:
        total_cpus = 1
    cpu_idle_percent = psutil.cpu_times_percent(interval=0.1).idle
    cpu_idle_cores = round(total_cpus * cpu_idle_percent / 100, 2)

    mem = psutil.virtual_memory()
    mem_total = round(mem.total / 1024 / 1024 / 1024, 2)
    mem_available = round(mem.available / 1024 / 1024 / 1024, 2)

    return ResourcesSummary(
        cpu_idle_cores=cpu_idle_cores,
        cpu_total_cores=total_cpus,
        mem_total_GB=mem_total,
        mem_available_GB=mem_available,
    )


@router.get("/status", response_model=StatusSummary)
async def get_status(
    item: Literal["job", "workflow"],
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    return await SummaryService(db).get_status(item, user_id=user.id)


@router.get("/activity", response_model=dict[str, int])
async def get_activity(
    item: Literal["rule", "user", "tag"],
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    return await SummaryService(db).get_activity(
        item=item, start_at=start_at, end_at=end_at, limit=limit, user_id=user.id
    )


@router.get("/rule_error", response_model=dict[str, dict])
async def get_rule_error(
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    return await SummaryService(db).get_rule_error(
        start_at=start_at, end_at=end_at, limit=limit, user_id=user.id
    )


@router.get("/rule_duration", response_model=dict[str, dict[str, float]])
async def get_rule_duration(
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    limit: int = 20,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    data = (
        await SummaryService(db).get_rule_duration(
            start_at=start_at, end_at=end_at, limit=limit, user_id=user.id
        )
        or {}
    )

    return data


@router.post("/pruning", response_model=dict[str, int])
async def post_pruning(
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    # Only superusers can prune
    if not user.is_superuser:
        raise HTTPException(status_code=403, detail="Not authorized to prune")
    return await WorkflowService(db).pruning()


@router.get("/health", response_model=SystemHealthResponse)
async def get_system_health(
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    """检查系统健康状态，包括数据库和SSE服务"""
    return await SummaryService(db).get_system_health()
