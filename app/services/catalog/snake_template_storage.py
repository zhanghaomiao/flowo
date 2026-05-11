"""Persisted Snakemake official workflow template files (DB source of truth)."""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import delete, func, inspect, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.snake_template import SnakeTemplateFile, SnakeTemplateState
from app.plugin.client.template_local import (
    SNAKEMAKE_WORKFLOW_TEMPLATE_GIT,
    git_pull_or_clone_template,
    snakemake_template_root,
)
from app.services.catalog.catalog_storage import (
    file_inventory_from_stored_rows,
    normalize_text_file_payload,
)
from app.services.catalog.utils import collect_catalog_files_for_batch_import

logger = logging.getLogger(__name__)

TEMPLATE_STATE_SINGLE_ID = uuid.UUID("00000000-0000-0000-0000-000000000001")
SNAKEFILE_TEMPLATE_PATHS = frozenset({"Snakefile", "workflow/Snakefile"})


async def snake_template_tables_exist(session: AsyncSession) -> bool:
    def _check(sync_session: Any) -> bool:
        bind = sync_session.get_bind()
        inspector = inspect(bind)
        return inspector.has_table("snake_template_files") and inspector.has_table(
            "snake_template_state"
        )

    return bool(await session.run_sync(_check))


def template_disk_layout_ready() -> bool:
    root = snakemake_template_root()
    return root.is_dir() and (root / "workflow").is_dir()


async def template_db_has_snakefile(session: AsyncSession) -> bool:
    r = await session.execute(
        select(SnakeTemplateFile.id)
        .where(SnakeTemplateFile.path.in_(SNAKEFILE_TEMPLATE_PATHS))
        .limit(1)
    )
    return r.scalar_one_or_none() is not None


async def template_db_file_count(session: AsyncSession) -> int:
    r = await session.execute(select(func.count()).select_from(SnakeTemplateFile))
    return int(r.scalar_one())


async def load_all_template_files(session: AsyncSession) -> list[SnakeTemplateFile]:
    res = await session.execute(select(SnakeTemplateFile))
    return list(res.scalars().all())


async def sync_template_files_from_disk(
    session: AsyncSession, root: Path | None = None
) -> int:
    """Replace template file rows from a UTF-8 text scan of ``root``."""
    root = root or snakemake_template_root()
    if not root.is_dir():
        return 0
    files_data = collect_catalog_files_for_batch_import(root)
    await session.execute(delete(SnakeTemplateFile))
    n = 0
    for f in files_data:
        row = normalize_text_file_payload(str(f["path"]), f["content"])
        if row is None:
            continue
        session.add(
            SnakeTemplateFile(
                path=row["path"],
                content=row["content"],
                sha256=row["sha256"],
                size=row["size"],
                lines=row["lines"],
                language=row["language"],
            )
        )
        n += 1
    await session.flush()
    return n


async def seed_snake_template_from_disk_if_empty(session: AsyncSession) -> bool:
    """If the DB has no template files but disk checkout looks valid, import once."""
    if not template_disk_layout_ready():
        return False
    if not await snake_template_tables_exist(session):
        logger.warning(
            "Skipping Snakemake template seed because database tables are missing; "
            "run alembic upgrade head"
        )
        return False
    if await template_db_file_count(session) > 0:
        return False
    n = await sync_template_files_from_disk(session)
    if n <= 0:
        return False
    await session.merge(
        SnakeTemplateState(
            id=TEMPLATE_STATE_SINGLE_ID,
            upstream_url=SNAKEMAKE_WORKFLOW_TEMPLATE_GIT,
            source_ref=None,
            last_pulled_at=None,
            status="seeded",
            error=None,
        )
    )
    logger.info("Seeded %s Snakemake template files from disk into the database", n)
    return True


async def materialize_snake_template_workspace(session: AsyncSession) -> None:
    """Write DB template files onto disk (preserves ``.git`` when present)."""
    root = snakemake_template_root()
    root.mkdir(parents=True, exist_ok=True)
    rows = await load_all_template_files(session)
    for row in rows:
        dest = root / row.path
        if ".git" in dest.parts:
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(row.content, encoding="utf-8")
    (root / ".flowo").mkdir(parents=True, exist_ok=True)


async def pull_snakemake_workflow_template_async(
    session: AsyncSession,
) -> dict[str, Any]:
    """Git clone/pull on disk, then mirror text files into the database."""

    def _git() -> dict[str, Any]:
        return git_pull_or_clone_template()

    meta = await asyncio.to_thread(_git)
    root = Path(meta["path"])
    n = await sync_template_files_from_disk(session, root)
    now = datetime.now(UTC)
    await session.merge(
        SnakeTemplateState(
            id=TEMPLATE_STATE_SINGLE_ID,
            upstream_url=SNAKEMAKE_WORKFLOW_TEMPLATE_GIT,
            source_ref=None,
            last_pulled_at=now,
            status="ok",
            error=None,
        )
    )
    await materialize_snake_template_workspace(session)
    return {**meta, "files_synced": n}


async def template_overview_async(session: AsyncSession) -> dict[str, Any]:
    root = snakemake_template_root()
    db_count = await template_db_file_count(session)
    if db_count > 0 and await template_db_has_snakefile(session):
        rows = await load_all_template_files(session)
        return {
            "ready": True,
            "path": str(root),
            "upstream": SNAKEMAKE_WORKFLOW_TEMPLATE_GIT,
            "files": file_inventory_from_stored_rows(rows),
            "source": "database",
        }
    if template_disk_layout_ready():
        from app.services.catalog.utils import _get_file_inventory

        return {
            "ready": True,
            "path": str(root),
            "upstream": SNAKEMAKE_WORKFLOW_TEMPLATE_GIT,
            "files": _get_file_inventory(root, include_dotfiles=True),
            "source": "disk",
        }
    return {
        "ready": False,
        "path": str(root),
        "upstream": SNAKEMAKE_WORKFLOW_TEMPLATE_GIT,
        "files": [],
        "source": "none",
    }


async def read_template_file_async(
    session: AsyncSession, rel_path: str
) -> dict[str, Any]:
    rel = (rel_path or "").strip().replace("\\", "/").lstrip("/")
    if not rel or ".." in rel.split("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
    r = await session.execute(
        select(SnakeTemplateFile).where(SnakeTemplateFile.path == rel)
    )
    row = r.scalar_one_or_none()
    if row is not None:
        return {
            "path": rel,
            "name": Path(rel).name,
            "content": row.content,
            "size": int(row.size),
            "lines": row.lines,
        }
    if template_disk_layout_ready():
        p = (snakemake_template_root() / rel).resolve()
        root = snakemake_template_root().resolve()
        if str(p).startswith(str(root)) and p.is_file():
            content = p.read_text(encoding="utf-8", errors="replace")
            return {
                "path": rel,
                "name": p.name,
                "content": content,
                "size": p.stat().st_size,
                "lines": content.count("\n") + 1,
            }
    raise HTTPException(status_code=404, detail="File not found")


async def write_template_file_async(
    session: AsyncSession, rel_path: str, content: str
) -> dict[str, Any]:
    rel = (rel_path or "").strip().replace("\\", "/").lstrip("/")
    if not rel or ".." in rel.split("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
    row = normalize_text_file_payload(rel, content)
    if row is None:
        raise HTTPException(status_code=400, detail="Path is not writable for template")
    existing = await session.execute(
        select(SnakeTemplateFile).where(SnakeTemplateFile.path == rel)
    )
    obj = existing.scalar_one_or_none()
    if obj is None:
        obj = SnakeTemplateFile(path=rel)
        session.add(obj)
    obj.content = row["content"]
    obj.sha256 = row["sha256"]
    obj.size = row["size"]
    obj.lines = row["lines"]
    obj.language = row["language"]
    await session.flush()
    await materialize_snake_template_workspace(session)
    return await read_template_file_async(session, rel)


def template_status_sync() -> dict[str, Any]:
    """Disk-only quick status (used where no DB session is available)."""
    root = snakemake_template_root()
    return {
        "ready": template_disk_layout_ready(),
        "path": str(root),
        "upstream": SNAKEMAKE_WORKFLOW_TEMPLATE_GIT,
    }
