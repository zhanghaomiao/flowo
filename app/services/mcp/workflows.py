import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import Catalog, Error, File, Job, Status, User, Workflow
from app.models.enums import FileType
from app.services.workflow import WorkflowService


def status_value(status: Any) -> str:
    return status.value if hasattr(status, "value") else str(status)


def dt(value: Any) -> str | None:
    return value.isoformat() if value else None


def duration_seconds(started_at: Any, end_time: Any) -> float | None:
    if not started_at or not end_time:
        return None
    return round((end_time - started_at).total_seconds(), 3)


class McpWorkflowService:
    """Query workflows in the shapes that MCP clients can use directly."""

    def __init__(self, db: AsyncSession, user: User):
        self.db = db
        self.user = user
        self.workflow_service = WorkflowService(db)

    def _scope_workflows(self, stmt):
        if self.user.is_superuser:
            return stmt
        return stmt.where(Workflow.user_id == self.user.id)

    async def get_readable_workflow(self, workflow_id: uuid.UUID) -> Workflow:
        stmt = (
            select(Workflow)
            .options(selectinload(Workflow.catalog))
            .where(Workflow.id == workflow_id)
        )
        stmt = self._scope_workflows(stmt)
        workflow = (await self.db.execute(stmt)).scalar_one_or_none()
        if workflow is None:
            raise HTTPException(status_code=404, detail="Workflow not found")
        return workflow

    def _workflow_row(self, workflow: Workflow, progress: dict[str, int] | None = None):
        total_jobs = progress.get("total", 0) if progress else None
        completed_jobs = progress.get("completed", 0) if progress else None
        running_jobs = progress.get("running", 0) if progress else None
        progress_percent = None
        if total_jobs:
            progress_percent = round((completed_jobs or 0) / total_jobs * 100)

        return {
            "id": str(workflow.id),
            "name": workflow.name,
            "status": status_value(workflow.status),
            "started_at": dt(workflow.started_at),
            "end_time": dt(workflow.end_time),
            "duration_seconds": duration_seconds(
                workflow.started_at, workflow.end_time
            ),
            "user": workflow.user,
            "tags": workflow.tags or [],
            "catalog_id": str(workflow.catalog_id) if workflow.catalog_id else None,
            "catalog_slug": workflow.catalog.slug if workflow.catalog else None,
            "directory": workflow.directory,
            "snakefile": workflow.snakefile,
            "logfile": workflow.logfile,
            "progress": progress_percent,
            "completed_jobs": completed_jobs,
            "running_jobs": running_jobs,
            "total_jobs": total_jobs,
        }

    def _parse_status(self, status: str | None) -> Status | None:
        if not status:
            return None
        normalized = status.upper()
        try:
            return Status(normalized)
        except ValueError as exc:
            allowed = ", ".join(s.value for s in Status)
            raise HTTPException(
                status_code=422,
                detail=f"Invalid status '{status}'. Expected one of: {allowed}",
            ) from exc

    def _workflow_filters(
        self,
        *,
        status: str | None = None,
        name_query: str | None = None,
        catalog_slug: str | None = None,
        tag: str | None = None,
        since_hours: int | None = None,
    ):
        filters = []
        parsed_status = self._parse_status(status)
        if parsed_status:
            filters.append(Workflow.status == parsed_status)

        if name_query:
            like = f"%{name_query}%"
            filters.append(
                or_(
                    Workflow.name.ilike(like),
                    Workflow.directory.ilike(like),
                    Workflow.snakefile.ilike(like),
                )
            )

        if catalog_slug:
            filters.append(Catalog.slug == catalog_slug)

        if tag:
            filters.append(func.array_position(Workflow.tags, tag) > 0)

        if since_hours:
            cutoff = datetime.now(UTC) - timedelta(hours=since_hours)
            filters.append(Workflow.started_at >= cutoff)

        return filters

    async def list_workflows(
        self,
        *,
        status: str | None = None,
        name_query: str | None = None,
        catalog_slug: str | None = None,
        tag: str | None = None,
        since_hours: int | None = None,
        limit: int = 10,
    ) -> dict[str, Any]:
        stmt = select(Workflow).options(selectinload(Workflow.catalog))
        count_stmt = select(func.count(Workflow.id))
        if catalog_slug:
            stmt = stmt.outerjoin(Catalog, Workflow.catalog_id == Catalog.id)
            count_stmt = count_stmt.outerjoin(
                Catalog, Workflow.catalog_id == Catalog.id
            )

        filters = self._workflow_filters(
            status=status,
            name_query=name_query,
            catalog_slug=catalog_slug,
            tag=tag,
            since_hours=since_hours,
        )
        if filters:
            stmt = stmt.where(and_(*filters))
            count_stmt = count_stmt.where(and_(*filters))

        stmt = self._scope_workflows(stmt)
        count_stmt = self._scope_workflows(count_stmt)
        stmt = stmt.order_by(desc(Workflow.started_at)).limit(limit)

        workflows = (await self.db.execute(stmt)).scalars().all()
        total = (await self.db.execute(count_stmt)).scalar() or 0
        rows = []
        for workflow in workflows:
            progress = await self.workflow_service.get_progress(workflow.id)
            rows.append(self._workflow_row(workflow, progress))

        return {
            "total_matches": total,
            "returned": len(rows),
            "workflows": rows,
        }

    async def get_latest_workflow(
        self,
        *,
        status: str | None = None,
        name_query: str | None = None,
        catalog_slug: str | None = None,
        tag: str | None = None,
        since_hours: int | None = None,
    ) -> dict[str, Any]:
        result = await self.list_workflows(
            status=status,
            name_query=name_query,
            catalog_slug=catalog_slug,
            tag=tag,
            since_hours=since_hours,
            limit=1,
        )
        workflow = result["workflows"][0] if result["workflows"] else None
        return {"workflow": workflow, "matched_count": result["total_matches"]}

    async def summarize_workflow(self, workflow_id: uuid.UUID) -> dict[str, Any]:
        workflow = await self.get_readable_workflow(workflow_id)
        detail = await self.workflow_service.get_detail(workflow_id)
        rules = await self.workflow_service.get_rules(workflow_id)

        jobs_stmt = select(Job).where(Job.workflow_id == workflow_id)
        jobs = (await self.db.execute(jobs_stmt)).scalars().all()
        progress = await self.workflow_service.get_progress(workflow_id)

        counts: dict[str, int] = {}
        for job in jobs:
            key = status_value(job.status)
            counts[key] = counts.get(key, 0) + 1

        errors_stmt = (
            select(Error)
            .options(selectinload(Error.rule))
            .where(Error.workflow_id == workflow_id)
            .order_by(desc(Error.timestamp))
            .limit(5)
        )
        errors = (await self.db.execute(errors_stmt)).scalars().all()

        return {
            "workflow": {
                "id": str(workflow.id),
                "name": workflow.name,
                "status": status_value(workflow.status),
                "progress": detail.progress,
                "started_at": dt(workflow.started_at),
                "end_time": dt(workflow.end_time),
                "duration_seconds": duration_seconds(
                    workflow.started_at, workflow.end_time
                ),
                "tags": workflow.tags or [],
                "catalog_id": str(workflow.catalog_id) if workflow.catalog_id else None,
                "catalog_slug": workflow.catalog.slug if workflow.catalog else None,
                "directory": workflow.directory,
                "snakefile": workflow.snakefile,
                "logfile": workflow.logfile,
            },
            "jobs": {
                "total": len(jobs),
                "by_status": counts,
                "completed": progress.get("completed", 0),
                "total_expected": progress.get("total", len(jobs)),
            },
            "rules": [
                {"name": r.name, "has_code": bool(r.code), "language": r.language}
                for r in rules
            ],
            "recent_errors": [
                {
                    "exception": err.exception,
                    "rule": err.rule.name if err.rule else None,
                    "file": err.file,
                    "line": err.line,
                    "timestamp": dt(err.timestamp),
                }
                for err in errors
            ],
            "files": {
                "has_snakefile": bool(workflow.snakefile),
                "has_log": bool(workflow.logfile),
                "configfiles": workflow.configfiles or [],
            },
        }

    async def summarize_latest_workflow(
        self,
        *,
        status: str | None = None,
        name_query: str | None = None,
        catalog_slug: str | None = None,
        tag: str | None = None,
        since_hours: int | None = None,
    ) -> dict[str, Any]:
        latest = await self.get_latest_workflow(
            status=status,
            name_query=name_query,
            catalog_slug=catalog_slug,
            tag=tag,
            since_hours=since_hours,
        )
        workflow = latest["workflow"]
        if not workflow:
            return {"workflow": None, "matched_count": 0, "summary": None}
        return {
            "matched_count": latest["matched_count"],
            "summary": await self.summarize_workflow(uuid.UUID(workflow["id"])),
        }

    async def diagnose_workflow_failure(self, workflow_id: uuid.UUID) -> dict[str, Any]:
        workflow = await self.get_readable_workflow(workflow_id)

        jobs_stmt = (
            select(Job)
            .options(selectinload(Job.rule), selectinload(Job.files))
            .where(Job.workflow_id == workflow_id, Job.status == Status.ERROR)
            .order_by(Job.started_at)
        )
        failed_jobs = (await self.db.execute(jobs_stmt)).scalars().all()

        errors_stmt = (
            select(Error)
            .options(selectinload(Error.rule))
            .where(Error.workflow_id == workflow_id)
            .order_by(desc(Error.timestamp))
        )
        errors = (await self.db.execute(errors_stmt)).scalars().all()

        return {
            "workflow": {
                "id": str(workflow.id),
                "name": workflow.name,
                "status": status_value(workflow.status),
                "directory": workflow.directory,
                "logfile": workflow.logfile,
                "started_at": dt(workflow.started_at),
                "end_time": dt(workflow.end_time),
            },
            "failed_jobs": [
                {
                    "id": job.id,
                    "snakemake_id": job.snakemake_id,
                    "rule": job.rule.name if job.rule else None,
                    "message": job.message,
                    "reason": job.reason,
                    "wildcards": job.wildcards,
                    "resources": job.resources,
                    "threads": job.threads,
                    "shellcmd": job.shellcmd,
                    "started_at": dt(job.started_at),
                    "end_time": dt(job.end_time),
                    "files": [
                        {"path": f.path, "file_type": status_value(f.file_type)}
                        for f in job.files
                    ],
                }
                for job in failed_jobs
            ],
            "errors": [
                {
                    "exception": err.exception,
                    "location": err.location,
                    "traceback": err.traceback,
                    "file": err.file,
                    "line": err.line,
                    "rule": err.rule.name if err.rule else None,
                    "timestamp": dt(err.timestamp),
                }
                for err in errors
            ],
        }

    async def diagnose_latest_failed_workflow(
        self,
        *,
        name_query: str | None = None,
        catalog_slug: str | None = None,
        tag: str | None = None,
        since_hours: int | None = None,
    ) -> dict[str, Any]:
        latest = await self.get_latest_workflow(
            status=Status.ERROR.value,
            name_query=name_query,
            catalog_slug=catalog_slug,
            tag=tag,
            since_hours=since_hours,
        )
        workflow = latest["workflow"]
        if not workflow:
            return {"workflow": None, "matched_count": 0, "diagnosis": None}
        return {
            "matched_count": latest["matched_count"],
            "diagnosis": await self.diagnose_workflow_failure(
                uuid.UUID(workflow["id"])
            ),
        }

    async def get_workflow_timeline(
        self, workflow_id: uuid.UUID, limit: int = 200
    ) -> dict[str, Any]:
        workflow = await self.get_readable_workflow(workflow_id)
        stmt = (
            select(Job)
            .options(selectinload(Job.rule))
            .where(Job.workflow_id == workflow_id)
            .order_by(Job.started_at)
            .limit(limit)
        )
        jobs = (await self.db.execute(stmt)).scalars().all()
        now = datetime.now(UTC)

        timeline = []
        for job in jobs:
            end_time = job.end_time
            if not end_time and job.status == Status.RUNNING:
                end_time = now
            timeline.append(
                {
                    "job_id": job.id,
                    "snakemake_id": job.snakemake_id,
                    "rule": job.rule.name if job.rule else None,
                    "status": status_value(job.status),
                    "started_at": dt(job.started_at),
                    "end_time": dt(job.end_time),
                    "duration_seconds": duration_seconds(job.started_at, end_time),
                    "threads": job.threads,
                    "resources": job.resources,
                }
            )

        slowest = sorted(
            [row for row in timeline if row["duration_seconds"] is not None],
            key=lambda row: row["duration_seconds"],
            reverse=True,
        )[:10]

        return {
            "workflow": self._workflow_row(workflow),
            "returned": len(timeline),
            "timeline": timeline,
            "slowest_jobs": slowest,
        }

    async def list_workflow_outputs(
        self,
        workflow_id: uuid.UUID,
        *,
        suffix: str | None = None,
        limit: int = 100,
    ) -> dict[str, Any]:
        workflow = await self.get_readable_workflow(workflow_id)
        stmt = (
            select(File)
            .options(selectinload(File.job).selectinload(Job.rule))
            .join(Job, File.job_id == Job.id)
            .where(Job.workflow_id == workflow_id, File.file_type == FileType.OUTPUT)
        )
        if suffix:
            normalized = suffix if suffix.startswith(".") else f".{suffix}"
            stmt = stmt.where(File.path.ilike(f"%{normalized}"))
        stmt = stmt.order_by(File.path).limit(limit)
        files = (await self.db.execute(stmt)).scalars().all()

        return {
            "workflow": self._workflow_row(workflow),
            "returned": len(files),
            "outputs": [
                {
                    "path": file_row.path,
                    "rule": file_row.job.rule.name
                    if file_row.job and file_row.job.rule
                    else None,
                    "job_id": file_row.job_id,
                    "job_status": status_value(file_row.job.status)
                    if file_row.job
                    else None,
                }
                for file_row in files
            ],
        }

    async def trace_output(self, workflow_id: uuid.UUID, path: str) -> dict[str, Any]:
        workflow = await self.get_readable_workflow(workflow_id)

        stmt = (
            select(File)
            .options(
                selectinload(File.job).selectinload(Job.rule),
                selectinload(File.job).selectinload(Job.files),
            )
            .join(Job, File.job_id == Job.id)
            .where(Job.workflow_id == workflow_id)
        )
        files = (await self.db.execute(stmt)).scalars().all()
        matches = [f for f in files if f.path == path or f.path.endswith(path)]

        if not matches:
            raise HTTPException(status_code=404, detail="Output path not found")

        traced = []
        for file_row in matches:
            job = file_row.job
            traced.append(
                {
                    "matched_path": file_row.path,
                    "matched_file_type": status_value(file_row.file_type),
                    "workflow": {
                        "id": str(workflow.id),
                        "name": workflow.name,
                        "directory": workflow.directory,
                    },
                    "job": {
                        "id": job.id,
                        "snakemake_id": job.snakemake_id,
                        "status": status_value(job.status),
                        "rule": job.rule.name if job.rule else None,
                        "wildcards": job.wildcards,
                        "reason": job.reason,
                        "resources": job.resources,
                        "threads": job.threads,
                        "shellcmd": job.shellcmd,
                        "started_at": dt(job.started_at),
                        "end_time": dt(job.end_time),
                    },
                    "files": [
                        {"path": f.path, "file_type": status_value(f.file_type)}
                        for f in job.files
                    ],
                    "rule_code": job.rule.code if job.rule else None,
                }
            )

        return {"matches": traced}
