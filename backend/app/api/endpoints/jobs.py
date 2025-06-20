from fastapi import APIRouter, Depends, Query
from typing import List, Optional
from sqlalchemy.orm import Session
import uuid

from app.services import JobService
from app.schemas import (
    JobResponse,
    FileResponse,
    JobDetailResponse,
)
from app.core.session import get_db

router = APIRouter()


@router.get("/{job_id}/detail", response_model=JobDetailResponse)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
):
    return JobService(db).get_job_details_with_id(job_id)


# @router.get("/{job_id}/files", response_model=FileResponse)
# def get_files(job_id: int, db: Session = Depends(get_db)):
#     return JobService(db).get_job_files_with_id(job_id=job_id)


@router.get("/{job_id}/logs")
def get_logs(job_id: int, db: Session = Depends(get_db)):
    return JobService(db).get_job_logs_with_id(job_id=job_id)
