"""Recovery: scan historical disk trees and populate ``catalog_files`` / template tables."""

from __future__ import annotations

from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Catalog
from app.services.catalog.catalog_storage import (
    count_catalog_files,
    upsert_catalog_files,
)
from app.services.catalog.snake_template_storage import (
    sync_template_files_from_disk,
    template_db_file_count,
)
from app.services.catalog.utils import (
    catalog_owner_segment,
    collect_catalog_files_for_batch_import,
)


async def backfill_catalogs_from_disk_root(
    session: AsyncSession, catalog_root: Path
) -> dict[str, int]:
    """For each catalog row with no ``catalog_files`` rows, import from ``catalog_root`` layout."""
    root = catalog_root.resolve()
    res = await session.execute(select(Catalog))
    catalogs = res.scalars().all()
    updated = 0
    rows_total = 0
    for cat in catalogs:
        disk = root / catalog_owner_segment(cat.owner_id) / cat.slug
        if not disk.is_dir():
            continue
        if await count_catalog_files(session, cat.id) > 0:
            continue
        files_data = collect_catalog_files_for_batch_import(disk)
        if not files_data:
            continue
        await upsert_catalog_files(session, cat.id, files_data, "replace", [])
        updated += 1
        rows_total += len(files_data)
    return {"catalogs_backfilled": updated, "files_upserted": rows_total}


async def backfill_snake_template_from_path(
    session: AsyncSession, template_root: Path, *, force: bool = False
) -> dict[str, int | bool]:
    """Load official template files from disk into ``snake_template_files``."""
    path = template_root.resolve()
    if not path.is_dir() or not (path / "workflow").is_dir():
        return {"skipped": True, "files": 0, "reason": "not_a_template_checkout"}
    if not force and await template_db_file_count(session) > 0:
        return {"skipped": True, "files": 0, "reason": "db_not_empty"}
    n = await sync_template_files_from_disk(session, path)
    return {"skipped": False, "files": n}
