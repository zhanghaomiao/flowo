import uuid

from sqlalchemy import and_, func, select, case
from sqlalchemy.orm import Session, joinedload

from ..models import File, Job, Rule, Status
from ..schemas import (
    FileResponse,
    JobDetailResponse,
    JobListResponse,
    JobResponse,
)
from .workflow import WorkflowService
from fastapi import HTTPException
from app.utils.paths import  path_resolver
from pathlib import Path


class JobService:
    """Service class for job-related business logic"""

    def __init__(self, db_session: Session):
        self.db_session = db_session

    def get_all_jobs(
        self, limit: int | None = None, offset: int | None = 0
    ) -> list[JobResponse]:
        """Get all jobs"""
        query = select(Job)
        if limit:
            query = query.limit(limit)
        if offset:
            query = query.offset(offset)
        jobs = list(self.db_session.execute(query).scalars())
        return [JobResponse.model_validate(job) for job in jobs]

    def get_job_rule_name_by_job_id(self, job_id: int):
        result = self.db_session.query(Rule.name).join(Job).filter(Job.id == job_id).first()
        return result

    def get_jobs_by_workflow_id(
        self,
        workflow_id: uuid.UUID,
        limit: int | None = None,
        offset: int | None = 0,
        order_by_started: bool = True,
        descending: bool = True,
        rule_name: str | None = None,
        status: Status | None = None,
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

        status_order = case(
            (Job.status == "ERROR", 1),
            (Job.status == "RUNNING", 2),
            (Job.status == "SUCCESS", 3),
            (Job.status == "UNKNOWN", 4),
            else_=5,
        )

        if descending:
            query = query.order_by(status_order, Job.started_at.desc())
        else:
            query = query.order_by(status_order, Job.id)

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
            jobs=results, total=total_jobs, limit=limit or 0, offset=offset or 0
        )

    def _get_jobs_by_workflow_id(self):
        pass

    def get_job_details_with_id(self, job_id: int) -> JobDetailResponse:
        query = (
            select(Job)
            .options(
                joinedload(Job.rule),      
                joinedload(Job.workflow)   
            )
            .where(Job.id == job_id)
        )

        job = self.db_session.execute(query).scalars().one_or_none()
        if not job:
            raise HTTPException(status_code=404, detail=f"Job with id {job_id} not found")

        directory = ""
        if job.workflow_id:
             wf_service = WorkflowService(self.db_session)
             wf_detail = wf_service.get_detail(workflow_id=job.workflow_id)
             directory = wf_detail.directory

        rule_name = job.rule.name 

        return JobDetailResponse(
            **job.__dict__,
            rule_name=rule_name,
            directory=directory,
        )


    def get_job_files_with_id(self, job_id: int) -> dict[str, list[str]]:
        files = self.db_session.query(File).filter(File.job_id == job_id).all()
        results = {}
        for file in files:
            results.setdefault(file.file_type.value.lower(), []).append(file.path)
        return results

    def get_job_logs_with_id(self, job_id: int) -> dict[str, str]:
        files = (
            self.db_session.query(File)
            .filter(and_(File.job_id == job_id, File.file_type == "LOG"))
            .all()
        )

        query = select(Job).where(Job.id == job_id)
        wf = self.db_session.execute(query).scalar_one().workflow
        if not wf or not wf.directory:
            raise HTTPException(status_code=404, detail="Workflow not found")
        results = {}
        for file in files:
            path = path_resolver.resolve(str(Path(wf.directory) / str(file.path)))
            try:
                with open(path) as f:
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
