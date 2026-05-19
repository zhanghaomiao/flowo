import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.permissions import assert_workflow_readable, workflow_read_filter
from app.models import (
    Catalog,
    CatalogFile,
    Error,
    File,
    Job,
    Rule,
    Status,
    User,
    Workflow,
)
from app.models.enums import FileType
from app.services.workflow import WorkflowService

TEXT_SUFFIXES = {
    ".bash",
    ".bed",
    ".csv",
    ".err",
    ".html",
    ".json",
    ".log",
    ".md",
    ".out",
    ".py",
    ".r",
    ".sam",
    ".sh",
    ".smk",
    ".svg",
    ".toml",
    ".tsv",
    ".txt",
    ".vcf",
    ".xml",
    ".yaml",
    ".yml",
}
BINARY_SUFFIXES = {
    ".bam",
    ".bai",
    ".bcf",
    ".bin",
    ".gz",
    ".h5",
    ".h5ad",
    ".jpg",
    ".jpeg",
    ".npy",
    ".pdf",
    ".png",
    ".tbi",
    ".webp",
    ".zip",
}
DEFAULT_FILE_TYPES = (FileType.OUTPUT, FileType.LOG, FileType.BENCHMARK)
DEFAULT_PREVIEW_BYTES = 1024 * 1024
DEFAULT_READ_BYTES = 256 * 1024
CATALOG_CONTEXT_FILE_LIMIT = 200
CATALOG_CONTEXT_CONFIG_LIMIT = 5
CATALOG_CONTEXT_RELEVANT_LIMIT = 10
WORKFLOW_LOG_FILE_TYPE = "WORKFLOW_LOG"


def status_value(status: Any) -> str:
    return status.value if hasattr(status, "value") else str(status)


def dt(value: Any) -> str | None:
    return value.isoformat() if value else None


def duration_seconds(started_at: Any, end_time: Any) -> float | None:
    if not started_at or not end_time:
        return None
    return round((end_time - started_at).total_seconds(), 3)


def _file_type(value: str) -> FileType:
    try:
        return FileType(value.upper())
    except ValueError as exc:
        allowed = ", ".join(t.value for t in FileType)
        raise HTTPException(
            status_code=422,
            detail=f"Invalid file_type '{value}'. Expected one of: {allowed}",
        ) from exc


def _parse_file_types(raw: list[str] | None) -> tuple[FileType, ...]:
    if not raw:
        return DEFAULT_FILE_TYPES
    parsed = tuple(_file_type(item) for item in raw)
    disallowed = [item.value for item in parsed if item == FileType.INPUT]
    if disallowed:
        raise HTTPException(
            status_code=422,
            detail="MCP file content tools do not read INPUT files by default",
        )
    return parsed


def _looks_text_path(path: Path) -> bool:
    suffixes = {suffix.lower() for suffix in path.suffixes}
    if suffixes.intersection(BINARY_SUFFIXES):
        return False
    if path.suffix.lower() in TEXT_SUFFIXES:
        return True
    return not path.suffix


def _decode_text(data: bytes) -> str:
    return data.decode("utf-8", errors="replace")


def _is_under(path: Path, root: Path) -> bool:
    try:
        path.relative_to(root)
        return True
    except ValueError:
        return False


def _resolve_recorded_path(workflow: Workflow, recorded_path: str) -> tuple[Path, Path]:
    """Resolve one recorded Snakemake path to a server-visible path and root."""
    source_root = workflow.flowo_working_path or settings.FLOWO_WORKING_PATH
    container_root = Path(settings.CONTAINER_MOUNT_PATH)
    original = Path(recorded_path)

    if workflow.directory:
        workdir = Path(workflow.directory)
        if workdir.is_absolute() and source_root:
            try:
                rel = workdir.resolve(strict=False).relative_to(
                    Path(source_root).resolve(strict=False)
                )
                resolved_workdir = (container_root / rel).resolve(strict=False)
            except ValueError:
                resolved_workdir = workdir.resolve(strict=False)
        elif workdir.is_absolute():
            resolved_workdir = workdir.resolve(strict=False)
        else:
            resolved_workdir = (container_root / workdir).resolve(strict=False)
    else:
        resolved_workdir = container_root.resolve(strict=False)

    if original.is_absolute() and source_root:
        try:
            rel = original.resolve(strict=False).relative_to(
                Path(source_root).resolve(strict=False)
            )
            resolved = (container_root / rel).resolve(strict=False)
        except ValueError:
            resolved = original.resolve(strict=False)
    elif original.is_absolute():
        resolved = original.resolve(strict=False)
    else:
        resolved = (resolved_workdir / original).resolve(strict=False)

    return resolved, resolved_workdir


def _file_metadata(
    file_row: File,
    resolved_path: Path,
    *,
    exists: bool,
    size: int | None = None,
    text_like: bool | None = None,
) -> dict[str, Any]:
    return {
        "path": file_row.path,
        "file_type": status_value(file_row.file_type),
        "resolved_path": str(resolved_path),
        "exists": exists,
        "size_bytes": size,
        "extension": resolved_path.suffix.lower(),
        "text_like": text_like,
    }


def _path_metadata(
    path: str,
    file_type: str,
    resolved_path: Path,
    *,
    exists: bool,
    size: int | None = None,
    text_like: bool | None = None,
) -> dict[str, Any]:
    return {
        "path": path,
        "file_type": file_type,
        "resolved_path": str(resolved_path),
        "exists": exists,
        "size_bytes": size,
        "extension": resolved_path.suffix.lower(),
        "text_like": text_like,
    }


def _catalog_file_kind(path: str) -> str:
    lowered = path.lower()
    name = Path(path).name
    suffix = Path(path).suffix.lower()
    if name == "Snakefile" or lowered.endswith("/snakefile"):
        return "entrypoint"
    if suffix in {".yaml", ".yml", ".json", ".toml"} or "config" in lowered:
        return "config"
    if suffix in {".smk", ".snakefile"}:
        return "rule"
    if suffix in {".py", ".r", ".sh", ".bash", ".jl", ".pl"}:
        return "script"
    return "other"


class McpWorkflowService:
    """Query workflows in the shapes that MCP clients can use directly."""

    def __init__(self, db: AsyncSession, user: User):
        self.db = db
        self.user = user
        self.workflow_service = WorkflowService(db)

    def _scope_workflows(self, stmt):
        return stmt.where(workflow_read_filter(self.user))

    async def get_readable_workflow(self, workflow_id: uuid.UUID) -> Workflow:
        stmt = (
            select(Workflow)
            .options(selectinload(Workflow.catalog))
            .where(Workflow.id == workflow_id)
        )
        workflow = (await self.db.execute(stmt)).scalar_one_or_none()
        return assert_workflow_readable(workflow, self.user)

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

    async def _catalog_context(
        self,
        workflow: Workflow,
        *,
        failed_rule_names: set[str] | None = None,
    ) -> dict[str, Any] | None:
        catalog = workflow.catalog
        if catalog is None:
            return None

        stmt = (
            select(
                CatalogFile.path,
                CatalogFile.language,
                CatalogFile.lines,
                CatalogFile.size,
            )
            .where(CatalogFile.catalog_id == catalog.id)
            .order_by(CatalogFile.path)
            .limit(CATALOG_CONTEXT_FILE_LIMIT)
        )
        rows = (await self.db.execute(stmt)).all()
        file_summaries = [
            {
                "path": path,
                "kind": _catalog_file_kind(path),
                "language": language,
                "lines": lines,
                "size": size,
            }
            for path, language, lines, size in rows
        ]
        entrypoints: list[str] = []
        configs: list[str] = []
        relevant: list[dict[str, Any]] = []
        failed_rules = {name.lower() for name in failed_rule_names or set() if name}
        for item in file_summaries:
            if item["kind"] == "entrypoint":
                entrypoints.append(item["path"])
            elif item["kind"] == "config":
                configs.append(item["path"])

            path_lower = item["path"].lower()
            reason = None
            if item["kind"] == "entrypoint":
                reason = "entrypoint"
            elif failed_rules and any(rule in path_lower for rule in failed_rules):
                reason = "path_matches_failed_rule"
            elif item["kind"] == "rule" and len(relevant) < 3:
                reason = "rule_file_candidate"
            if reason:
                relevant.append(
                    {"path": item["path"], "kind": item["kind"], "reason": reason}
                )

        deduped_relevant = []
        seen_paths = set()
        for item in relevant:
            if item["path"] in seen_paths:
                continue
            seen_paths.add(item["path"])
            deduped_relevant.append(item)
            if len(deduped_relevant) >= CATALOG_CONTEXT_RELEVANT_LIMIT:
                break

        return {
            "id": str(catalog.id),
            "slug": catalog.slug,
            "name": catalog.name,
            "description": catalog.description or "",
            "tags": catalog.tags or [],
            "source_url": catalog.source_url,
            "workspace_status": catalog.workspace_status,
            "workspace_ready": catalog.workspace_status in {"fresh", "ready"},
            "last_export_error": catalog.last_export_error,
            "entrypoints": entrypoints,
            "configs": configs[:CATALOG_CONTEXT_CONFIG_LIMIT],
            "likely_relevant_files": deduped_relevant,
            "suggested_mcp_tools": {
                "overview": "get_catalog_workflow_overview",
                "read_file": "read_catalog_workflow_file",
                "search_files": "search_catalog_workflow_files",
                "materialize_workspace": "materialize_catalog_workflow_workspace",
            },
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
        failed_rule_names = {
            job.rule.name for job in failed_jobs if job.rule and job.rule.name
        }
        catalog_context = await self._catalog_context(
            workflow,
            failed_rule_names=failed_rule_names,
        )

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
                "catalog_id": str(workflow.catalog_id) if workflow.catalog_id else None,
                "catalog_slug": workflow.catalog.slug if workflow.catalog else None,
                "directory": workflow.directory,
                "logfile": workflow.logfile,
                "started_at": dt(workflow.started_at),
                "end_time": dt(workflow.end_time),
            },
            "catalog": catalog_context,
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

    async def _recorded_files(
        self,
        workflow_id: uuid.UUID,
        *,
        path: str | None = None,
        file_types: tuple[FileType, ...] = DEFAULT_FILE_TYPES,
    ) -> list[File]:
        stmt = (
            select(File)
            .options(selectinload(File.job).selectinload(Job.rule))
            .join(Job, File.job_id == Job.id)
            .where(Job.workflow_id == workflow_id, File.file_type.in_(file_types))
        )
        rows = (await self.db.execute(stmt)).scalars().all()
        if path is None:
            return list(rows)
        return [row for row in rows if row.path == path or row.path.endswith(path)]

    async def _one_recorded_file(
        self,
        workflow: Workflow,
        path: str,
        *,
        file_types: tuple[FileType, ...] = DEFAULT_FILE_TYPES,
    ) -> File:
        rows = await self._recorded_files(
            workflow.id,
            path=path,
            file_types=file_types,
        )
        if not rows:
            raise HTTPException(
                status_code=404,
                detail="Recorded workflow file not found for this run",
            )
        if len(rows) > 1:
            raise HTTPException(
                status_code=409,
                detail="Multiple recorded files match this path; use the exact path",
            )
        return rows[0]

    def _resolve_safe_recorded_file(
        self,
        workflow: Workflow,
        file_row: File,
    ) -> tuple[Path, dict[str, Any]]:
        resolved_path, workdir = _resolve_recorded_path(workflow, file_row.path)
        allowed_roots = [
            Path(settings.CONTAINER_MOUNT_PATH).resolve(strict=False),
            workdir.resolve(strict=False),
        ]
        resolved_final = (
            resolved_path.resolve(strict=True)
            if resolved_path.exists()
            else resolved_path
        )
        if not any(_is_under(resolved_final, root) for root in allowed_roots):
            raise HTTPException(
                status_code=403,
                detail="Resolved file path is outside the allowed workflow roots",
            )
        if not resolved_path.exists():
            return resolved_path, _file_metadata(file_row, resolved_path, exists=False)
        if not resolved_path.is_file():
            raise HTTPException(status_code=400, detail="Recorded path is not a file")
        size = resolved_path.stat().st_size
        text_like = _looks_text_path(resolved_path)
        return resolved_path, _file_metadata(
            file_row,
            resolved_path,
            exists=True,
            size=size,
            text_like=text_like,
        )

    def _resolve_safe_workflow_log(
        self,
        workflow: Workflow,
    ) -> tuple[Path | None, dict[str, Any], list[str]]:
        warnings: list[str] = []
        if not workflow.logfile:
            return (
                None,
                _path_metadata(
                    "",
                    WORKFLOW_LOG_FILE_TYPE,
                    Path(""),
                    exists=False,
                ),
                ["workflow_logfile_not_recorded"],
            )

        resolved_path, workdir = _resolve_recorded_path(workflow, workflow.logfile)
        allowed_roots = [
            Path(settings.CONTAINER_MOUNT_PATH).resolve(strict=False),
            workdir.resolve(strict=False),
        ]
        resolved_final = (
            resolved_path.resolve(strict=True)
            if resolved_path.exists()
            else resolved_path
        )
        if not any(_is_under(resolved_final, root) for root in allowed_roots):
            raise HTTPException(
                status_code=403,
                detail="Resolved workflow log path is outside the allowed workflow roots",
            )
        if not resolved_path.exists():
            warnings.append("workflow_log_missing_on_server")
            return (
                resolved_path,
                _path_metadata(
                    workflow.logfile,
                    WORKFLOW_LOG_FILE_TYPE,
                    resolved_path,
                    exists=False,
                ),
                warnings,
            )
        if not resolved_path.is_file():
            raise HTTPException(
                status_code=400,
                detail="Recorded workflow log path is not a file",
            )
        size = resolved_path.stat().st_size
        return (
            resolved_path,
            _path_metadata(
                workflow.logfile,
                WORKFLOW_LOG_FILE_TYPE,
                resolved_path,
                exists=True,
                size=size,
                text_like=_looks_text_path(resolved_path),
            ),
            warnings,
        )

    def _producer(self, file_row: File) -> dict[str, Any]:
        job = file_row.job
        return {
            "job_id": job.id if job else None,
            "snakemake_id": job.snakemake_id if job else None,
            "rule": job.rule.name if job and job.rule else None,
            "job_status": status_value(job.status) if job else None,
        }

    async def preview_run_file(
        self,
        workflow_id: uuid.UUID,
        path: str,
        *,
        file_types: list[str] | None = None,
        head_lines: int = 40,
        tail_lines: int = 20,
        max_bytes: int = DEFAULT_PREVIEW_BYTES,
    ) -> dict[str, Any]:
        workflow = await self.get_readable_workflow(workflow_id)
        parsed_file_types = _parse_file_types(file_types)
        file_row = await self._one_recorded_file(
            workflow,
            path,
            file_types=parsed_file_types,
        )
        resolved_path, metadata = self._resolve_safe_recorded_file(workflow, file_row)
        warnings: list[str] = []
        preview: dict[str, Any] | None = None

        if not metadata["exists"]:
            warnings.append("file_missing_on_server")
        elif not metadata["text_like"]:
            warnings.append("binary_or_unsupported_text_preview")
        else:
            size = metadata["size_bytes"] or 0
            truncated_by_bytes = size > max_bytes
            raw = resolved_path.read_bytes()[:max_bytes]
            lines = _decode_text(raw).splitlines()
            head = lines[:head_lines]
            tail = lines[-tail_lines:] if tail_lines and len(lines) > head_lines else []
            preview = {
                "mode": "head_tail",
                "head": head,
                "tail": tail,
                "sampled_lines": len(lines),
                "truncated": truncated_by_bytes,
            }
            if truncated_by_bytes:
                warnings.append("preview_truncated_by_max_bytes")

        return {
            "workflow": self._workflow_row(workflow),
            "file": metadata,
            "producer": self._producer(file_row),
            "preview": preview,
            "warnings": warnings,
        }

    async def read_run_text_file(
        self,
        workflow_id: uuid.UUID,
        path: str,
        *,
        file_types: list[str] | None = None,
        max_bytes: int = DEFAULT_READ_BYTES,
    ) -> dict[str, Any]:
        workflow = await self.get_readable_workflow(workflow_id)
        parsed_file_types = _parse_file_types(file_types)
        file_row = await self._one_recorded_file(
            workflow,
            path,
            file_types=parsed_file_types,
        )
        resolved_path, metadata = self._resolve_safe_recorded_file(workflow, file_row)
        if not metadata["exists"]:
            return {
                "workflow": self._workflow_row(workflow),
                "file": metadata,
                "producer": self._producer(file_row),
                "content": None,
                "truncated": False,
                "warnings": ["file_missing_on_server"],
            }
        if not metadata["text_like"]:
            return {
                "workflow": self._workflow_row(workflow),
                "file": metadata,
                "producer": self._producer(file_row),
                "content": None,
                "truncated": False,
                "warnings": ["binary_or_unsupported_text_read"],
            }

        size = metadata["size_bytes"] or 0
        data = resolved_path.read_bytes()[:max_bytes]
        truncated = size > max_bytes
        return {
            "workflow": self._workflow_row(workflow),
            "file": metadata,
            "producer": self._producer(file_row),
            "content": _decode_text(data),
            "truncated": truncated,
            "warnings": ["content_truncated_by_max_bytes"] if truncated else [],
        }

    async def preview_job_logs(
        self,
        workflow_id: uuid.UUID,
        *,
        job_id: int | None = None,
        rule: str | None = None,
        tail_lines: int = 120,
        max_bytes: int = DEFAULT_PREVIEW_BYTES,
    ) -> dict[str, Any]:
        workflow = await self.get_readable_workflow(workflow_id)
        stmt = (
            select(File)
            .options(selectinload(File.job).selectinload(Job.rule))
            .join(Job, File.job_id == Job.id)
            .where(Job.workflow_id == workflow_id, File.file_type == FileType.LOG)
        )
        if job_id is not None:
            stmt = stmt.where(Job.id == job_id)
        if rule:
            stmt = stmt.join(Rule, Job.rule_id == Rule.id).where(Rule.name == rule)
        stmt = stmt.order_by(Job.status, File.path)
        logs = (await self.db.execute(stmt)).scalars().all()

        previews = []
        for file_row in logs[:20]:
            resolved_path, metadata = self._resolve_safe_recorded_file(
                workflow,
                file_row,
            )
            warnings: list[str] = []
            tail: list[str] = []
            if not metadata["exists"]:
                warnings.append("file_missing_on_server")
            elif not metadata["text_like"]:
                warnings.append("binary_or_unsupported_text_preview")
            else:
                size = metadata["size_bytes"] or 0
                raw = resolved_path.read_bytes()[-max_bytes:]
                tail = _decode_text(raw).splitlines()[-tail_lines:]
                if size > max_bytes:
                    warnings.append("tail_truncated_by_max_bytes")
            previews.append(
                {
                    "file": metadata,
                    "producer": self._producer(file_row),
                    "tail": tail,
                    "warnings": warnings,
                }
            )

        return {
            "workflow": self._workflow_row(workflow),
            "returned": len(previews),
            "logs": previews,
        }

    async def preview_workflow_log(
        self,
        workflow_id: uuid.UUID,
        *,
        head_lines: int = 40,
        tail_lines: int = 120,
        max_bytes: int = DEFAULT_PREVIEW_BYTES,
    ) -> dict[str, Any]:
        workflow = await self.get_readable_workflow(workflow_id)
        resolved_path, metadata, warnings = self._resolve_safe_workflow_log(workflow)
        preview: dict[str, Any] | None = None

        if metadata["exists"] and resolved_path is not None:
            if not metadata["text_like"]:
                warnings.append("binary_or_unsupported_text_preview")
            else:
                size = metadata["size_bytes"] or 0
                truncated_by_bytes = size > max_bytes
                raw = resolved_path.read_bytes()
                if truncated_by_bytes:
                    head_raw = raw[: max_bytes // 2]
                    tail_raw = raw[-(max_bytes // 2) :]
                    sampled_text = (
                        f"{_decode_text(head_raw)}\n...\n{_decode_text(tail_raw)}"
                    )
                else:
                    sampled_text = _decode_text(raw)
                lines = sampled_text.splitlines()
                preview = {
                    "mode": "workflow_log_head_tail",
                    "head": lines[:head_lines],
                    "tail": lines[-tail_lines:] if tail_lines else [],
                    "sampled_lines": len(lines),
                    "truncated": truncated_by_bytes,
                }
                if truncated_by_bytes:
                    warnings.append("preview_truncated_by_max_bytes")

        return {
            "workflow": self._workflow_row(workflow),
            "file": metadata,
            "preview": preview,
            "warnings": warnings,
        }

    async def read_workflow_log_text(
        self,
        workflow_id: uuid.UUID,
        *,
        max_bytes: int = DEFAULT_READ_BYTES,
    ) -> dict[str, Any]:
        workflow = await self.get_readable_workflow(workflow_id)
        resolved_path, metadata, warnings = self._resolve_safe_workflow_log(workflow)
        if not metadata["exists"] or resolved_path is None:
            return {
                "workflow": self._workflow_row(workflow),
                "file": metadata,
                "content": None,
                "truncated": False,
                "warnings": warnings,
            }
        if not metadata["text_like"]:
            warnings.append("binary_or_unsupported_text_read")
            return {
                "workflow": self._workflow_row(workflow),
                "file": metadata,
                "content": None,
                "truncated": False,
                "warnings": warnings,
            }

        size = metadata["size_bytes"] or 0
        data = resolved_path.read_bytes()[:max_bytes]
        truncated = size > max_bytes
        if truncated:
            warnings.append("content_truncated_by_max_bytes")
        return {
            "workflow": self._workflow_row(workflow),
            "file": metadata,
            "content": _decode_text(data),
            "truncated": truncated,
            "warnings": warnings,
        }

    async def search_run_files(
        self,
        workflow_id: uuid.UUID,
        *,
        query: str,
        file_types: list[str] | None = None,
        limit: int = 20,
        max_file_bytes: int = DEFAULT_PREVIEW_BYTES,
    ) -> dict[str, Any]:
        if not query.strip():
            raise HTTPException(status_code=422, detail="query must not be empty")
        workflow = await self.get_readable_workflow(workflow_id)
        parsed_file_types = _parse_file_types(file_types)
        rows = await self._recorded_files(workflow_id, file_types=parsed_file_types)
        needle = query.lower()
        matches = []
        skipped = []

        for file_row in rows:
            if len(matches) >= limit:
                break
            resolved_path, metadata = self._resolve_safe_recorded_file(
                workflow,
                file_row,
            )
            if not metadata["exists"]:
                skipped.append({"path": file_row.path, "reason": "missing"})
                continue
            if not metadata["text_like"]:
                skipped.append({"path": file_row.path, "reason": "non_text"})
                continue
            if (metadata["size_bytes"] or 0) > max_file_bytes:
                skipped.append({"path": file_row.path, "reason": "too_large"})
                continue

            line_hits = []
            for line_no, line in enumerate(
                _decode_text(resolved_path.read_bytes()).splitlines(),
                start=1,
            ):
                idx = line.lower().find(needle)
                if idx < 0:
                    continue
                start = max(0, idx - 80)
                end = min(len(line), idx + len(query) + 80)
                line_hits.append(
                    {
                        "line": line_no,
                        "snippet": f"{'...' if start else ''}{line[start:end]}{'...' if end < len(line) else ''}",
                    }
                )
                if len(line_hits) >= 3:
                    break
            if line_hits:
                matches.append(
                    {
                        "file": metadata,
                        "producer": self._producer(file_row),
                        "matches": line_hits,
                    }
                )

        return {
            "workflow": self._workflow_row(workflow),
            "query": query,
            "returned": len(matches),
            "matches": matches,
            "skipped": skipped[:20],
        }
