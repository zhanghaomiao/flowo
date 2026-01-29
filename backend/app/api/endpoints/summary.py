from datetime import datetime
from typing import Literal

import psutil
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.session import get_db
from app.schemas import (
    ResourcesSummary,
    StatusSummary,
    SystemHealthResponse,
    UserSummary,
)
from app.services import SummaryService, WorkflowService

router = APIRouter()


@router.get("/resources", response_model=ResourcesSummary)
def get_system_resources():
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


@router.get("/user", response_model=UserSummary)
def get_user_summary(db: Session = Depends(get_db)):
    return SummaryService(db).get_user_summary()


@router.get("/status", response_model=StatusSummary)
def get_status(item: Literal["job", "workflow"], db: Session = Depends(get_db)):
    return SummaryService(db).get_status(item)


@router.get("/activity", response_model=dict[str, int])
def get_activity(
    item: Literal["rule", "user", "tag"],
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    return SummaryService(db).get_activity(
        item=item, start_at=start_at, end_at=end_at, limit=limit
    )


@router.get("/rule_error", response_model=dict[str, dict])
def get_rule_error(
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    return SummaryService(db).get_rule_error(
        start_at=start_at, end_at=end_at, limit=limit
    )


@router.get("/rule_duration", response_model=dict[str, dict[str, float]])
def get_rule_duration(
    start_at: datetime | None = None,
    end_at: datetime | None = None,
    limit: int = 20,
    db: Session = Depends(get_db),
):
    data = (
        SummaryService(db).get_rule_duration(
            start_at=start_at, end_at=end_at, limit=limit
        )
        or {}
    )

    return data


@router.post("/pruning", response_model=dict[str, int])
def post_pruning(db: Session = Depends(get_db)):
    return WorkflowService(db).pruning()


@router.get("/health", response_model=SystemHealthResponse)
def get_system_health(db: Session = Depends(get_db)):
    """检查系统健康状态，包括数据库和SSE服务（同步版本）"""
    return SummaryService(db).get_system_health()


@router.get("/health/async", response_model=SystemHealthResponse)
async def get_system_health_async(db: Session = Depends(get_db)):
    """检查系统健康状态，包括数据库和SSE服务（异步版本，包含完整SSE检查）"""
    service = SummaryService(db)

    # 检查数据库（同步）
    db_status = service.check_database_health()

    # 检查SSE（异步）
    sse_status = await service.check_sse_health()

    # 确定整体状态
    services = [db_status, sse_status]
    if all(s.status == "healthy" for s in services):
        overall_status = "healthy"
    elif any(s.status == "unhealthy" for s in services):
        overall_status = "unhealthy"
    else:
        overall_status = "degraded"

    return SystemHealthResponse(
        database=db_status, sse=sse_status, overall_status=overall_status
    )
