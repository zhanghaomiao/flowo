import uuid
from pathlib import Path

from fastapi import HTTPException
from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from ..models import File, Job, Rule, Status
from ..schemas import (
    JobDetailResponse,
    JobListResponse,
    JobResponse,
)
from ..utils.paths import path_resolver
from .workflow import WorkflowService


class JobService:
    """Service class for job-related business logic"""

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session

    async def get_all_jobs(
        self, limit: int | None = None, offset: int | None = 0
    ) -> list[JobResponse]:
        """Get all jobs"""
        query = select(Job)
        if limit:
            query = query.limit(limit)
        if offset:
            query = query.offset(offset)
        result = await self.db_session.execute(query)
        jobs = result.scalars().all()
        return [JobResponse.model_validate(job) for job in jobs]

    async def get_job_rule_name_by_job_id(self, job_id: int):
        query = (
            select(Rule.name).join(Job, Job.rule_id == Rule.id).where(Job.id == job_id)
        )
        result = await self.db_session.execute(query)
        return result.scalar_one_or_none()

    async def get_jobs_by_workflow_id(
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

        total_jobs_result = await self.db_session.execute(count_query)
        total_jobs = total_jobs_result.scalar() or 0

        result = await self.db_session.execute(query)
        rows = result.all()

        results = [
            JobResponse(**job.__dict__, rule_name=rule_name) for job, rule_name in rows
        ]

        return JobListResponse(
            jobs=results, total=total_jobs, limit=limit or 0, offset=offset or 0
        )

    def _get_jobs_by_workflow_id(self):
        pass

    async def get_job_details_with_id(self, job_id: int) -> JobDetailResponse:
        query = (
            select(Job)
            .options(joinedload(Job.rule), joinedload(Job.workflow))
            .where(Job.id == job_id)
        )

        result = await self.db_session.execute(query)
        job = result.scalars().one_or_none()
        if not job:
            raise HTTPException(
                status_code=404, detail=f"Job with id {job_id} not found"
            )

        directory = ""
        if job.workflow_id:
            wf_service = WorkflowService(self.db_session)
            wf_detail = await wf_service.get_detail(workflow_id=job.workflow_id)
            directory = wf_detail.directory

        rule_name = job.rule.name

        return JobDetailResponse(
            **job.__dict__,
            rule_name=rule_name,
            directory=directory,
        )

    async def get_job_files_with_id(self, job_id: int) -> dict[str, list[str]]:
        query = select(File).where(File.job_id == job_id)
        result = await self.db_session.execute(query)
        files = result.scalars().all()
        results = {}
        for file in files:
            results.setdefault(file.file_type.value.lower(), []).append(file.path)
        return results

    async def get_job_logs_with_id(self, job_id: int) -> dict[str, str]:
        files_query = select(File).where(
            and_(File.job_id == job_id, File.file_type == "LOG")
        )
        files_result = await self.db_session.execute(files_query)
        files = files_result.scalars().all()

        query = select(Job).options(joinedload(Job.workflow)).where(Job.id == job_id)
        result = await self.db_session.execute(query)
        job = result.scalar_one()
        wf = job.workflow
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

    async def delete_jobs(self, workflow_id: uuid.UUID):
        from sqlalchemy import delete

        query_job_ids = select(Job.id).where(Job.workflow_id == workflow_id)
        result = await self.db_session.execute(query_job_ids)
        job_ids = result.scalars().all()

        await self.db_session.execute(delete(File).where(File.job_id.in_(job_ids)))
        await self.db_session.execute(delete(Job).where(Job.workflow_id == workflow_id))
        await self.db_session.execute(
            delete(Rule).where(Rule.workflow_id == workflow_id)
        )
        await self.db_session.commit()
