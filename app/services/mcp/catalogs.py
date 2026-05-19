from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.permissions import (
    assert_catalog_readable_for_user,
    is_viewer,
    workflow_read_filter,
)
from app.models import Catalog, CatalogFile, Status, User, Workflow
from app.services.catalog.catalog_storage import (
    catalog_db_has_snakefile,
    count_catalog_files,
    load_catalog_file_rows,
    materialize_catalog_workspace,
    workspace_flags_for_catalog,
)
from app.services.catalog.service import CatalogService
from app.services.catalog.utils import catalog_data_dir
from app.services.mcp.workflows import duration_seconds, status_value
from app.services.workflow import WorkflowService

SENSITIVE_PATH_PARTS = {
    ".env",
    ".netrc",
    ".pypirc",
    "credentials",
    "credential",
    "secret",
    "secrets",
    "token",
    "tokens",
    "password",
    "passwd",
    "private_key",
    "id_rsa",
    "id_ed25519",
}
SENSITIVE_LINE_MARKERS = (
    "secret",
    "token",
    "password",
    "passwd",
    "credential",
    "private_key",
)


def _dt(value: Any) -> str | None:
    return value.isoformat() if value else None


def _is_sensitive_path(path: str) -> bool:
    parts = {part.lower() for part in Path(path).parts}
    filename = Path(path).name.lower()
    if parts.intersection(SENSITIVE_PATH_PARTS):
        return True
    return any(
        marker in filename for marker in SENSITIVE_PATH_PARTS if marker != ".env"
    )


def _catalog_row(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": row["id"],
        "slug": row.get("slug"),
        "name": row["name"],
        "description": row.get("description") or "",
        "tags": row.get("tags") or [],
        "file_count": row.get("file_count", 0),
        "has_snakefile": row.get("has_snakefile", False),
        "workspace_status": row.get("workspace_status"),
        "workspace_ready": row.get("workspace_ready", False),
        "last_export_error": row.get("last_export_error"),
    }


def _file_kind(path: str) -> str:
    name = Path(path).name
    suffix = Path(path).suffix.lower()
    lowered = path.lower()
    if name == "Snakefile" or lowered.endswith("/snakefile"):
        return "snakefile"
    if suffix in {".yaml", ".yml"} and ("env" in lowered or "conda" in lowered):
        return "environment"
    if suffix in {".yaml", ".yml", ".json", ".toml"} or "config" in lowered:
        return "config"
    if suffix in {".smk", ".snakefile"}:
        return "rule"
    if suffix in {".py", ".r", ".sh", ".bash", ".pl", ".jl", ".rs"}:
        return "script"
    return "other"


def _snippet(line: str, needle: str, *, width: int = 180) -> str:
    idx = line.lower().find(needle.lower())
    if idx < 0:
        return line[:width]
    start = max(0, idx - width // 2)
    end = min(len(line), idx + len(needle) + width // 2)
    prefix = "..." if start else ""
    suffix = "..." if end < len(line) else ""
    return f"{prefix}{line[start:end]}{suffix}"


class McpCatalogService:
    """Query catalog sources in compact shapes for MCP clients."""

    def __init__(self, db: AsyncSession, user: User):
        self.db = db
        self.user = user
        self.catalog_service = CatalogService(db)
        self.workflow_service = WorkflowService(db)

    def _scope_workflows(self, stmt):
        return stmt.where(workflow_read_filter(self.user))

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

    async def _readable_catalog(self, catalog_ref: str) -> Catalog:
        user_id = None if is_viewer(self.user) else self.user.id
        cat = await self.catalog_service._resolve_catalog_ref(catalog_ref, user_id)
        return assert_catalog_readable_for_user(cat, self.user)

    async def list_catalogs(
        self,
        *,
        search: str | None = None,
        tags: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        rows = await self.catalog_service.list_catalogs(
            search=search,
            tags=tags,
            user_id=None if is_viewer(self.user) else self.user.id,
        )
        if is_viewer(self.user):
            rows = [row for row in rows if row.get("is_public")]
        limited = rows[:limit]
        return {
            "total_matches": len(rows),
            "returned": len(limited),
            "catalogs": [_catalog_row(row) for row in limited],
        }

    async def get_catalog_overview(
        self,
        catalog_ref: str,
        *,
        file_limit: int = 500,
    ) -> dict[str, Any]:
        detail = await self.catalog_service.get_catalog(
            catalog_ref, user_id=None if is_viewer(self.user) else self.user.id
        )
        files = detail.get("files", [])
        limited_files = files[:file_limit]
        return {
            "catalog": _catalog_row(detail),
            "metadata": {
                "version": detail.get("version"),
                "owner": detail.get("owner"),
                "is_public": detail.get("is_public"),
                "source_url": detail.get("source_url"),
                "created_at": detail.get("created_at"),
                "updated_at": detail.get("updated_at"),
                "has_dag_preview": detail.get("has_dag_preview", False),
            },
            "files_returned": len(limited_files),
            "files_total": len(files),
            "files": limited_files,
        }

    async def read_catalog_file(self, catalog_ref: str, path: str) -> dict[str, Any]:
        if _is_sensitive_path(path):
            raise HTTPException(
                status_code=403,
                detail="Refusing to return sensitive catalog file content through MCP",
            )
        return await self.catalog_service.read_file(
            catalog_ref,
            path,
            user_id=None if is_viewer(self.user) else self.user.id,
        )

    async def search_catalog_files(
        self,
        catalog_ref: str,
        *,
        query: str,
        path_prefix: str | None = None,
        limit: int = 20,
    ) -> dict[str, Any]:
        if not query.strip():
            raise HTTPException(status_code=422, detail="query must not be empty")

        cat = await self._readable_catalog(catalog_ref)
        filters = [CatalogFile.catalog_id == cat.id]
        if path_prefix:
            normalized = path_prefix.strip().strip("/")
            if normalized:
                filters.append(CatalogFile.path.startswith(normalized))

        needle = query.lower()
        stmt = (
            select(CatalogFile)
            .where(and_(*filters))
            .where(
                or_(
                    CatalogFile.path.ilike(f"%{query}%"),
                    CatalogFile.content.ilike(f"%{query}%"),
                )
            )
            .order_by(CatalogFile.path)
            .limit(limit * 5)
        )
        rows = (await self.db.execute(stmt)).scalars().all()

        matches: list[dict[str, Any]] = []
        for row in rows:
            if _is_sensitive_path(row.path):
                continue
            line_hits = []
            for line_no, line in enumerate(row.content.splitlines(), start=1):
                lowered = line.lower()
                if needle not in lowered:
                    continue
                if any(marker in lowered for marker in SENSITIVE_LINE_MARKERS):
                    line_hits.append(
                        {"line": line_no, "snippet": "[redacted sensitive line]"}
                    )
                else:
                    line_hits.append(
                        {"line": line_no, "snippet": _snippet(line, query)}
                    )
                if len(line_hits) >= 3:
                    break
            if not line_hits and needle in row.path.lower():
                line_hits.append({"line": None, "snippet": "Path match"})
            if line_hits:
                matches.append(
                    {
                        "path": row.path,
                        "language": row.language,
                        "lines": row.lines,
                        "size": row.size,
                        "matches": line_hits,
                    }
                )
            if len(matches) >= limit:
                break

        return {
            "catalog": {"id": str(cat.id), "slug": cat.slug, "name": cat.name},
            "query": query,
            "returned": len(matches),
            "matches": matches,
        }

    async def summarize_catalog(self, catalog_ref: str) -> dict[str, Any]:
        cat = await self._readable_catalog(catalog_ref)
        rows = await load_catalog_file_rows(self.db, cat.id)
        files_by_kind: dict[str, list[str]] = {
            "snakefiles": [],
            "configs": [],
            "rules": [],
            "scripts": [],
            "environments": [],
        }
        sensitive_paths = []
        for row in rows:
            if _is_sensitive_path(row.path):
                sensitive_paths.append(row.path)
                continue
            kind = _file_kind(row.path)
            if kind == "snakefile":
                files_by_kind["snakefiles"].append(row.path)
            elif kind == "config":
                files_by_kind["configs"].append(row.path)
            elif kind == "rule":
                files_by_kind["rules"].append(row.path)
            elif kind == "script":
                files_by_kind["scripts"].append(row.path)
            elif kind == "environment":
                files_by_kind["environments"].append(row.path)

        db_file_count = await count_catalog_files(self.db, cat.id)
        db_has_snakefile = await catalog_db_has_snakefile(self.db, cat.id)
        workspace = workspace_flags_for_catalog(
            cat,
            catalog_data_dir(cat.owner_id, cat.slug),
            db_file_count=db_file_count,
            db_has_snakefile=db_has_snakefile,
        )
        missing = []
        if not db_file_count:
            missing.append("catalog_files")
        if not db_has_snakefile:
            missing.append("Snakefile")
        if not workspace["workspace_ready"]:
            missing.append("materialized_workspace")

        return {
            "catalog": {
                "id": str(cat.id),
                "slug": cat.slug,
                "name": cat.name,
                "description": cat.description or "",
                "tags": cat.tags or [],
            },
            "entrypoints": files_by_kind["snakefiles"],
            "configs": files_by_kind["configs"][:30],
            "rules": files_by_kind["rules"][:50],
            "scripts": files_by_kind["scripts"][:50],
            "environments": files_by_kind["environments"][:30],
            "file_count": db_file_count,
            "workspace": workspace,
            "ready_to_run": db_has_snakefile and workspace["workspace_ready"],
            "missing": missing,
            "sensitive_files_omitted": len(sensitive_paths),
        }

    async def list_catalog_workflows(
        self,
        catalog_ref: str,
        *,
        status: str | None = None,
        limit: int = 10,
        since_hours: int | None = None,
    ) -> dict[str, Any]:
        cat = await self._readable_catalog(catalog_ref)
        filters = [Workflow.catalog_id == cat.id]
        parsed_status = self._parse_status(status)
        if parsed_status:
            filters.append(Workflow.status == parsed_status)
        if since_hours:
            cutoff = datetime.now(UTC) - timedelta(hours=since_hours)
            filters.append(Workflow.started_at >= cutoff)

        stmt = select(Workflow).where(and_(*filters))
        count_stmt = select(func.count(Workflow.id)).where(and_(*filters))
        stmt = (
            self._scope_workflows(stmt).order_by(desc(Workflow.started_at)).limit(limit)
        )
        count_stmt = self._scope_workflows(count_stmt)

        workflows = (await self.db.execute(stmt)).scalars().all()
        total = (await self.db.execute(count_stmt)).scalar() or 0
        rows = []
        for workflow in workflows:
            progress = await self.workflow_service.get_progress(workflow.id)
            total_jobs = progress.get("total", 0)
            completed_jobs = progress.get("completed", 0)
            rows.append(
                {
                    "id": str(workflow.id),
                    "name": workflow.name,
                    "status": status_value(workflow.status),
                    "started_at": _dt(workflow.started_at),
                    "end_time": _dt(workflow.end_time),
                    "duration_seconds": duration_seconds(
                        workflow.started_at,
                        workflow.end_time,
                    ),
                    "directory": workflow.directory,
                    "snakefile": workflow.snakefile,
                    "tags": workflow.tags or [],
                    "completed_jobs": completed_jobs,
                    "total_jobs": total_jobs,
                }
            )

        return {
            "catalog": {"id": str(cat.id), "slug": cat.slug, "name": cat.name},
            "total_matches": total,
            "returned": len(rows),
            "workflows": rows,
        }

    async def materialize_catalog_workspace(self, catalog_ref: str) -> dict[str, Any]:
        cat = await self._readable_catalog(catalog_ref)
        await materialize_catalog_workspace(self.db, cat)
        await self.db.commit()
        await self.db.refresh(cat)

        db_file_count = await count_catalog_files(self.db, cat.id)
        db_has_snakefile = await catalog_db_has_snakefile(self.db, cat.id)
        workspace_path = catalog_data_dir(cat.owner_id, cat.slug)
        workspace = workspace_flags_for_catalog(
            cat,
            workspace_path,
            db_file_count=db_file_count,
            db_has_snakefile=db_has_snakefile,
        )
        return {
            "catalog": {"id": str(cat.id), "slug": cat.slug, "name": cat.name},
            "workspace_path": str(workspace_path),
            "file_count": db_file_count,
            **workspace,
        }
