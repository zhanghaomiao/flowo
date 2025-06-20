from typing import List, Optional
import uuid
from sqlalchemy.orm import Session
from sqlalchemy import select, and_, func
from pathlib import Path
from ..models import Job, Rule, File, Status
from ..schemas import (
    JobResponse,
    FileResponse,
    JobListResponse,
    Message,
    JobDetailResponse,
)
from fastapi import HTTPException
from .workflow import WorkflowService
import logging


class JobService:
    """Service class for job-related business logic"""

    def __init__(self, db_session: Session):
        self.db_session = db_session

    def get_all_jobs(
        self, limit: Optional[int] = None, offset: Optional[int] = 0
    ) -> List[JobResponse]:
        """Get all jobs"""
        query = select(Job)
        if limit:
            query = query.limit(limit)
        if offset:
            query = query.offset(offset)
        jobs = list(self.db_session.execute(query).scalars())
        return [JobResponse.model_validate(job) for job in jobs]

    def get_job_rule_name_by_job_id(self, job_id: int) -> Optional[str]:
        result = (
            self.db_session.query(Rule.name).join(Job).filter(Job.id == job_id).first()
        )
        return result

    def get_jobs_by_workflow_id(
        self,
        workflow_id: uuid.UUID,
        limit: Optional[int] = None,
        offset: Optional[int] = 0,
        order_by_started: bool = True,
        descending: bool = True,
        rule_name: Optional[str] = None,
        status: Optional[Status] = None,
    ) -> JobListResponse:
        """
        Get jobs for a specific workflow with optional filtering by rule name

        Args:
            workflow_id: UUID of the workflow to filter jobs by
            rule_name_filter: Optional rule name to filter jobs by

        Returns:
            List of JobResponse objects
        """

        query = (
            select(Job, Rule.name.label("rule_name"))
            .join(Rule)
            .where(Job.workflow_id == workflow_id)
        )

        if order_by_started:
            order_column = Job.started_at
        else:
            order_column = Job.id

        if descending:
            query = query.order_by(order_column.desc())
        else:
            query = query.order_by(order_column)

        if rule_name:
            query = query.filter(Rule.name == rule_name)

        if status:
            query = query.filter(Job.status == status)

        if offset:
            query = query.offset(offset)

        if limit:
            query = query.limit(limit)

        count_query = (
            select(func.count())
            .select_from(Job)
            .join(Rule)
            .filter(Job.workflow_id == workflow_id)
        )
        if rule_name:
            count_query = count_query.filter(Rule.name == rule_name)
        if status:
            count_query = count_query.filter(Job.status == status)

        total_jobs = self.db_session.execute(count_query).scalar() or 0

        results = list(self.db_session.execute(query).all())

        results = [
            JobResponse(**job.__dict__, rule_name=rule_name)
            for job, rule_name in results
        ]

        return JobListResponse(
            jobs=results, total=total_jobs, limit=limit or 0, offset=offset
        )

    def _get_jobs_by_workflow_id(self):
        pass

    # def jobs_append(self, jobs: list[JobResponse]) -> list[JobResponse]:
    #     rule_count_total = WorkflowService(self.db_session).get_workflow_run_info(
    #         dict(jobs[0])["workflow_id"]
    #     )

    #     rule_count_current = {}
    #     for job in jobs:
    #         rule_name = dict(job)["rule_name"]
    #         rule_count_current[rule_name] = rule_count_current.get(rule_name, 0) + 1

    #     results = {
    #         k: rule_count_total[k] - rule_count_current.get(k, 0)
    #         for k in rule_count_total.keys()
    #         if rule_count_total[k] - rule_count_current.get(k, 0) > 0
    #     }

    #     for rule_name, count in results.items():
    #         for _ in range(count):
    #             if rule_name == "total":
    #                 continue
    #             jobs.append(JobResponse(rule_name=rule_name, status="waiting"))

    #     return jobs
    def get_job_details_with_id(self, job_id: int) -> JobDetailResponse:
        """Retrieves a job by its unique identifier."""
        rule_name = self.get_job_rule_name_by_job_id(job_id=job_id)
        query = select(Job).where(Job.id == job_id)
        files = self.get_job_files_with_id(job_id=job_id)
        job = self.db_session.execute(query).scalar_one_or_none()
        wf = WorkflowService(self.db_session).get_detail(workflow_id=job.workflow_id)
        return JobDetailResponse.model_validate(
            {
                **job.__dict__,
                **files,
                "rule_name": rule_name[0],
                "directory": wf.directory,
            }
        )

    def get_job_files_with_id(self, job_id: int) -> FileResponse:
        files = self.db_session.query(File).filter(File.job_id == job_id).all()
        results = {}
        for file in files:
            results.setdefault(file.file_type.value.lower(), []).append(file.path)

        return results

    def get_job_logs_with_id(self, job_id: int):
        files = (
            self.db_session.query(File)
            .filter(and_(File.job_id == job_id, File.file_type == "LOG"))
            .all()
        )

        query = select(Job).where(Job.id == job_id)
        wf = self.db_session.execute(query).scalar_one_or_none().workflow

        results = {}
        for file in files:

            if not wf.flowo_working_path or not wf.directory:
                return {file: "logs not found, please set flowo_working_path and directory"}

            file_path = (
                wf.directory.replace(wf.flowo_working_path, "/work_dir/") + "/" + file.path
            )

            try:
                with open(file_path, "r") as f:
                    results[file.path] = f.read()
            except Exception as e:
                results[file.path] = f"Failed to oepn file: {str(e)}"

        return results

    def delete_jobs(self, workflow_id: uuid.UUID):
        job_ids = (
            self.db_session.query(Job.id).filter(Job.workflow_id == workflow_id).all()
        )
        job_ids = [job.id for job in job_ids]
        self.db_session.query(File).filter(File.job_id.in_(job_ids)).delete(
            synchronize_session=False
        )
        self.db_session.query(Job).filter(Job.workflow_id == workflow_id).delete(
            synchronize_session=False
        )
        self.db_session.query(Rule).filter(Rule.workflow_id == workflow_id).delete(
            synchronize_session=False
        )
        self.db_session.commit()
