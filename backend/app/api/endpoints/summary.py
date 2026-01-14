from datetime import datetime
from typing import Literal

import psutil
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.session import get_db
from app.schemas import ResourcesSummary, StatusSummary, UserSummary
from app.services import SummaryService, WorkflowService

router = APIRouter()


@router.get("/resources")
def get_system_resources():
    total_cpus = psutil.cpu_count(logical=True)
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
