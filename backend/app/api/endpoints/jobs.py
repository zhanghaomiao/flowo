from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.session import get_db
from app.schemas import (
    JobDetailResponse,
)
from app.services import JobService

router = APIRouter()


@router.get("/{job_id}/detail", response_model=JobDetailResponse)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
):
    return JobService(db).get_job_details_with_id(job_id)


@router.get("/{job_id}/logs", response_model=dict[str, str])
def get_logs(job_id: int, db: Session = Depends(get_db)):
    return JobService(db).get_job_logs_with_id(job_id=job_id)
