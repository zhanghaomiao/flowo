"""Database-backed catalog file storage and workspace materialization."""

from __future__ import annotations

import base64
import hashlib
import json
import logging
import shutil
import tarfile
import tempfile
import uuid
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import Catalog
from app.models.catalog_blob import CatalogBlob
from app.models.catalog_file import CatalogFile
from app.services.catalog.utils import (
    CATALOG_BLOB_MAX_BYTES,
    _detect_language,
    _write_metadata,
    catalog_data_dir,
    workspace_has_snakefile,
)

logger = logging.getLogger(__name__)

CATALOG_TEXT_MAX_BYTES = 50 * 1024 * 1024

SNAKEFILE_DB_PATHS = frozenset({"Snakefile", "workflow/Snakefile"})


def _catalog_blob_root(catalog_id: uuid.UUID) -> Path:
    return Path(settings.CATALOG_BLOB_DIR) / str(catalog_id)


def _blob_sidecar_path(catalog_id: uuid.UUID, rel_posix: str) -> Path:
    base = _catalog_blob_root(catalog_id).resolve()
    rel = (rel_posix or "").strip().replace("\\", "/").lstrip("/")
    if not rel or ".." in rel.split("/"):
        raise ValueError("invalid blob relative path")
    dest = (base / rel).resolve()
    if not str(dest).startswith(str(base)):
        raise ValueError("blob path escapes catalog root")
    return dest


def write_catalog_blob_bytes(catalog_id: uuid.UUID, rel_posix: str, data: bytes) -> str:
    if len(data) > CATALOG_BLOB_MAX_BYTES:
        raise ValueError("blob too large")
    dest = _blob_sidecar_path(catalog_id, rel_posix)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return hashlib.sha256(data).hexdigest()


def unlink_blob_sidecar_path(catalog_id: uuid.UUID, rel_posix: str) -> None:
    try:
        p = _blob_sidecar_path(catalog_id, rel_posix)
    except ValueError:
        return
    try:
        if p.is_file():
            p.unlink()
    except OSError:
        pass


def remove_catalog_blob_tree(catalog_id: uuid.UUID) -> None:
    root = Path(settings.CATALOG_BLOB_DIR) / str(catalog_id)
    if root.exists():
        shutil.rmtree(root, ignore_errors=True)


def merge_catalog_text_and_blob_inventory(
    text_rows: list[CatalogFile], blob_rows: list[CatalogBlob]
) -> list[dict[str, Any]]:
    from types import SimpleNamespace

    extra = [
        SimpleNamespace(
            path=b.path,
            lines=0,
            size=int(b.size),
            updated_at=b.updated_at,
            language="binary",
        )
        for b in blob_rows
    ]
    return file_inventory_from_stored_rows(list(text_rows) + extra)


def _should_skip_import_path(
    rel_posix: str, *, extra_ignore: set[str] | None = None
) -> bool:
    from app.services.catalog.utils import DEFAULT_IGNORE_DIRS

    ignore = DEFAULT_IGNORE_DIRS | (extra_ignore or set())
    parts = rel_posix.split("/")
    if any(p in ignore for p in parts):
        return True
    name = Path(rel_posix).name
    if name.startswith("."):
        return True
    return False


def normalize_text_file_payload(path: str, content: str) -> dict[str, Any] | None:
    """Return row dict or None if skipped; raise HTTPException on invalid or too large."""
    rel = (path or "").strip().replace("\\", "/").lstrip("/")
    if not rel or ".." in rel.split("/"):
        raise HTTPException(status_code=400, detail=f"Invalid path: {path}")
    if _should_skip_import_path(rel):
        return None
    raw = content.encode("utf-8")
    if len(raw) > CATALOG_TEXT_MAX_BYTES:
        raise HTTPException(
            status_code=400,
            detail=(
                f"File too large (max {CATALOG_TEXT_MAX_BYTES // (1024 * 1024)} MiB): {rel}"
            ),
        )
    if b"\x00" in raw:
        return None
    digest = hashlib.sha256(raw).hexdigest()
    return {
        "path": rel,
        "content": content,
        "sha256": digest,
        "size": len(raw),
        "lines": content.count("\n") + 1,
        "language": _detect_language(rel),
    }


def file_inventory_from_stored_rows(rows: list[Any]) -> list[dict[str, Any]]:
    """Build inventory dicts; each row has ``path``, ``lines``, ``size``, ``updated_at``, ``language``."""
    dirs: set[str] = set()
    for cf in rows:
        parent = str(Path(cf.path).parent)
        while parent and parent != ".":
            dirs.add(parent.replace("\\", "/"))
            parent = str(Path(parent).parent)

    out: list[dict[str, Any]] = []
    for d in sorted(dirs):
        out.append(
            {
                "name": Path(d).name,
                "path": d,
                "is_dir": True,
                "lines": 0,
                "size": 0,
                "modified": datetime.now(UTC).isoformat(),
                "language": None,
            }
        )

    for cf in sorted(rows, key=lambda r: r.path):
        name = Path(cf.path).name
        if name.startswith("."):
            continue
        out.append(
            {
                "name": name,
                "path": cf.path,
                "is_dir": False,
                "lines": cf.lines,
                "size": int(cf.size),
                "modified": cf.updated_at.isoformat(),
                "language": (cf.language or _detect_language(cf.path)),
            }
        )
    return sorted(out, key=lambda x: (x["path"].split("/"), x["is_dir"]))


def file_inventory_from_db_rows(rows: list[CatalogFile]) -> list[dict[str, Any]]:
    """Match shape produced by :func:`app.services.catalog.utils._get_file_inventory`."""
    return file_inventory_from_stored_rows(rows)


async def catalog_file_stats_for_many(
    session: AsyncSession, catalog_ids: list[uuid.UUID]
) -> dict[uuid.UUID, tuple[int, bool]]:
    """For each catalog id: ``(file_count, has_snakefile)`` — text + blob rows count as files."""
    if not catalog_ids:
        return {}
    counts = await session.execute(
        select(CatalogFile.catalog_id, func.count(CatalogFile.id))
        .where(CatalogFile.catalog_id.in_(catalog_ids))
        .group_by(CatalogFile.catalog_id)
    )
    count_map = {cid: int(n) for cid, n in counts.all()}
    bcounts = await session.execute(
        select(CatalogBlob.catalog_id, func.count(CatalogBlob.id))
        .where(CatalogBlob.catalog_id.in_(catalog_ids))
        .group_by(CatalogBlob.catalog_id)
    )
    for cid, n in bcounts.all():
        count_map[cid] = count_map.get(cid, 0) + int(n)
    snake = await session.execute(
        select(CatalogFile.catalog_id)
        .where(
            CatalogFile.catalog_id.in_(catalog_ids),
            CatalogFile.path.in_(SNAKEFILE_DB_PATHS),
        )
        .distinct()
    )
    snake_set = {row[0] for row in snake.all()}
    return {cid: (count_map.get(cid, 0), cid in snake_set) for cid in catalog_ids}


async def count_catalog_files(session: AsyncSession, catalog_id: uuid.UUID) -> int:
    t = await session.execute(
        select(func.count())
        .select_from(CatalogFile)
        .where(CatalogFile.catalog_id == catalog_id)
    )
    b = await session.execute(
        select(func.count())
        .select_from(CatalogBlob)
        .where(CatalogBlob.catalog_id == catalog_id)
    )
    return int(t.scalar_one()) + int(b.scalar_one())


async def catalog_db_has_snakefile(
    session: AsyncSession, catalog_id: uuid.UUID
) -> bool:
    r = await session.execute(
        select(CatalogFile.id)
        .where(
            CatalogFile.catalog_id == catalog_id,
            CatalogFile.path.in_(SNAKEFILE_DB_PATHS),
        )
        .limit(1)
    )
    return r.scalar_one_or_none() is not None


async def load_catalog_file_rows(
    session: AsyncSession, catalog_id: uuid.UUID
) -> list[CatalogFile]:
    res = await session.execute(
        select(CatalogFile).where(CatalogFile.catalog_id == catalog_id)
    )
    return list(res.scalars().all())


async def load_catalog_blob_rows(
    session: AsyncSession, catalog_id: uuid.UUID
) -> list[CatalogBlob]:
    res = await session.execute(
        select(CatalogBlob).where(CatalogBlob.catalog_id == catalog_id)
    )
    return list(res.scalars().all())


async def read_catalog_file_from_db(
    session: AsyncSession, catalog_id: uuid.UUID, file_path: str
) -> dict[str, Any] | None:
    rel = (file_path or "").strip().replace("\\", "/").lstrip("/")
    if not rel or ".." in rel.split("/"):
        return None
    r = await session.execute(
        select(CatalogFile).where(
            CatalogFile.catalog_id == catalog_id,
            CatalogFile.path == rel,
        )
    )
    row = r.scalar_one_or_none()
    if row is not None:
        return {
            "path": rel,
            "name": Path(rel).name,
            "content": row.content,
            "language": row.language or _detect_language(rel),
            "lines": row.lines,
            "size": int(row.size),
        }
    br = (
        await session.execute(
            select(CatalogBlob).where(
                CatalogBlob.catalog_id == catalog_id,
                CatalogBlob.path == rel,
            )
        )
    ).scalar_one_or_none()
    if br is None:
        return None
    try:
        raw = _blob_sidecar_path(catalog_id, rel).read_bytes()
    except (ValueError, OSError):
        return None
    if hashlib.sha256(raw).hexdigest() != br.sha256:
        logger.warning("Blob sha mismatch for %s catalog=%s", rel, catalog_id)
    return {
        "path": rel,
        "name": Path(rel).name,
        "content": base64.standard_b64encode(raw).decode("ascii"),
        "language": "base64",
        "lines": 0,
        "size": int(br.size),
    }


async def delete_catalog_paths(
    session: AsyncSession, catalog_id: uuid.UUID, paths: list[str]
) -> int:
    if not paths:
        return 0
    normalized = []
    for p in paths:
        rel = (p or "").strip().replace("\\", "/").lstrip("/")
        if rel and ".." not in rel.split("/"):
            normalized.append(rel)
    if not normalized:
        return 0
    res = await session.execute(
        delete(CatalogFile).where(
            CatalogFile.catalog_id == catalog_id,
            CatalogFile.path.in_(normalized),
        )
    )
    return res.rowcount or 0


async def upsert_catalog_files(
    session: AsyncSession,
    catalog_id: uuid.UUID,
    files_data: list[dict[str, Any]],
    mode: str,
    delete_paths: list[str],
) -> dict[str, int]:
    if mode not in {"replace", "merge"}:
        raise HTTPException(status_code=400, detail='mode must be "replace" or "merge"')

    rows_in: list[dict[str, Any]] = []
    for f in files_data:
        content = f.get("content", "")
        if not isinstance(content, str):
            raise HTTPException(status_code=400, detail="File content must be text")
        row = normalize_text_file_payload(str(f["path"]), content)
        if row is None:
            continue
        rows_in.append(row)

    incoming_paths = {r["path"] for r in rows_in}
    if incoming_paths:
        for p in incoming_paths:
            unlink_blob_sidecar_path(catalog_id, p)
        await session.execute(
            delete(CatalogBlob).where(
                CatalogBlob.catalog_id == catalog_id,
                CatalogBlob.path.in_(incoming_paths),
            )
        )

    deleted = 0
    if mode == "replace" and incoming_paths:
        del_res = await session.execute(
            delete(CatalogFile).where(
                CatalogFile.catalog_id == catalog_id,
                CatalogFile.path.notin_(incoming_paths),
            )
        )
        deleted += del_res.rowcount or 0

    deleted += await delete_catalog_paths(session, catalog_id, delete_paths)

    existing_res = await session.execute(
        select(CatalogFile.path, CatalogFile.sha256).where(
            CatalogFile.catalog_id == catalog_id
        )
    )
    existing = dict(existing_res.all())

    added = 0
    modified = 0
    skipped = 0
    now = datetime.now(UTC)

    for row in rows_in:
        prev_hash = existing.get(row["path"])
        if prev_hash is None:
            added += 1
        elif prev_hash == row["sha256"]:
            skipped += 1
            continue
        else:
            modified += 1

        stmt = pg_insert(CatalogFile).values(
            id=uuid.uuid4(),
            catalog_id=catalog_id,
            path=row["path"],
            content=row["content"],
            sha256=row["sha256"],
            size=row["size"],
            lines=row["lines"],
            language=row["language"],
            created_at=now,
            updated_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[CatalogFile.catalog_id, CatalogFile.path],
            set_={
                "content": stmt.excluded.content,
                "sha256": stmt.excluded.sha256,
                "size": stmt.excluded.size,
                "lines": stmt.excluded.lines,
                "language": stmt.excluded.language,
                "updated_at": now,
            },
        )
        await session.execute(stmt)
        existing[row["path"]] = row["sha256"]

    return {
        "added": added,
        "modified": modified,
        "deleted": deleted,
        "skipped": skipped,
        "conflicts": 0,
    }


async def upsert_catalog_blobs(
    session: AsyncSession,
    catalog_id: uuid.UUID,
    binaries: list[tuple[str, bytes]],
    mode: str,
    delete_paths: list[str] | None = None,
) -> dict[str, int]:
    """Write binary files to sidecar + ``catalog_blobs``; strip competing text rows at same paths."""
    if delete_paths is None:
        delete_paths = []
    if mode not in {"replace", "merge"}:
        raise HTTPException(status_code=400, detail='mode must be "replace" or "merge"')

    incoming_paths = {p for p, _ in binaries}

    if mode == "replace":
        res = await session.execute(
            select(CatalogBlob.path).where(CatalogBlob.catalog_id == catalog_id)
        )
        existing = {row[0] for row in res.all()}
        to_remove = existing - incoming_paths
        for p in to_remove:
            unlink_blob_sidecar_path(catalog_id, p)
        if to_remove:
            await session.execute(
                delete(CatalogBlob).where(
                    CatalogBlob.catalog_id == catalog_id,
                    CatalogBlob.path.in_(to_remove),
                )
            )

    if delete_paths:
        blob_del: list[str] = []
        for p in delete_paths:
            rel = (p or "").strip().replace("\\", "/").lstrip("/")
            if rel and ".." not in rel.split("/"):
                blob_del.append(rel)
                unlink_blob_sidecar_path(catalog_id, rel)
        if blob_del:
            await session.execute(
                delete(CatalogBlob).where(
                    CatalogBlob.catalog_id == catalog_id,
                    CatalogBlob.path.in_(blob_del),
                )
            )

    if incoming_paths:
        await session.execute(
            delete(CatalogFile).where(
                CatalogFile.catalog_id == catalog_id,
                CatalogFile.path.in_(incoming_paths),
            )
        )

    existing_h = dict(
        (
            await session.execute(
                select(CatalogBlob.path, CatalogBlob.sha256).where(
                    CatalogBlob.catalog_id == catalog_id
                )
            )
        ).all()
    )

    added = 0
    modified = 0
    skipped = 0
    now = datetime.now(UTC)

    for rel, data in binaries:
        rel = (rel or "").strip().replace("\\", "/").lstrip("/")
        if not rel or ".." in rel.split("/"):
            continue
        if _should_skip_import_path(rel):
            continue
        if len(data) > CATALOG_BLOB_MAX_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"Binary too large (max {CATALOG_BLOB_MAX_BYTES // (1024 * 1024)} MiB): {rel}",
            )
        digest = hashlib.sha256(data).hexdigest()
        prev = existing_h.get(rel)
        if prev == digest:
            skipped += 1
            continue
        if prev is None:
            added += 1
        else:
            modified += 1
        write_catalog_blob_bytes(catalog_id, rel, data)
        stmt = pg_insert(CatalogBlob).values(
            id=uuid.uuid4(),
            catalog_id=catalog_id,
            path=rel,
            sha256=digest,
            size=len(data),
            created_at=now,
            updated_at=now,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=[CatalogBlob.catalog_id, CatalogBlob.path],
            set_={
                "sha256": stmt.excluded.sha256,
                "size": stmt.excluded.size,
                "updated_at": now,
            },
        )
        await session.execute(stmt)
        existing_h[rel] = digest

    return {
        "added": added,
        "modified": modified,
        "deleted": 0,
        "skipped": skipped,
        "conflicts": 0,
    }


def _flowo_json_payload(cat: Catalog, *, disk_slug: str) -> dict[str, Any]:
    return {
        "id": str(cat.id),
        "name": cat.name,
        "slug": disk_slug,
        "description": cat.description,
        "version": cat.version,
        "owner": cat.owner,
        "tags": cat.tags,
        "is_public": cat.is_public,
        "source_url": cat.source_url,
        "created_at": cat.created_at.isoformat(),
        "updated_at": cat.updated_at.isoformat(),
    }


async def materialize_catalog_workspace(session: AsyncSession, cat: Catalog) -> None:
    """Rebuild workspace: text from ``catalog_files``, binaries copied from blob sidecar."""
    root = catalog_data_dir(cat.owner_id, cat.slug)
    try:
        if root.exists():
            shutil.rmtree(root)
        root.mkdir(parents=True, exist_ok=True)

        rows = await load_catalog_file_rows(session, cat.id)
        blob_rows = await load_catalog_blob_rows(session, cat.id)
        if not rows and not blob_rows:
            cat.workspace_status = "error"
            cat.last_export_error = (
                "No catalog files or blobs in database to materialize"
            )
            cat.last_exported_at = datetime.now(UTC)
            return

        for cf in rows:
            dest = root / cf.path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(cf.content, encoding="utf-8")

        for br in blob_rows:
            try:
                src = _blob_sidecar_path(cat.id, br.path)
            except ValueError:
                logger.warning("Invalid blob path %s", br.path)
                continue
            if not src.is_file():
                logger.warning(
                    "Missing blob sidecar for %s (catalog %s)", br.path, cat.id
                )
                continue
            dest = root / br.path
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, dest)

        _write_metadata(root, _flowo_json_payload(cat, disk_slug=cat.slug))

        if not workspace_has_snakefile(root):
            cat.workspace_status = "error"
            cat.last_export_error = "Snakefile missing after materialize (expected workflow/Snakefile or Snakefile)"
        else:
            cat.workspace_status = "fresh"
            cat.last_export_error = None
        cat.last_exported_at = datetime.now(UTC)
        cat.export_revision = (cat.export_revision or 0) + 1
    except OSError as e:
        logger.exception("materialize_catalog_workspace failed")
        cat.workspace_status = "error"
        cat.last_export_error = str(e)[:2000]
        cat.last_exported_at = datetime.now(UTC)


async def materialize_all_catalogs_for_owner(
    session: AsyncSession, owner_id: uuid.UUID
) -> None:
    res = await session.execute(select(Catalog).where(Catalog.owner_id == owner_id))
    for cat in res.scalars().all():
        await materialize_catalog_workspace(session, cat)


async def build_tar_gz_from_db(
    session: AsyncSession, cat: Catalog
) -> tuple[BytesIO, str]:
    rows = await load_catalog_file_rows(session, cat.id)
    blob_rows = await load_catalog_blob_rows(session, cat.id)
    if not rows and not blob_rows:
        raise HTTPException(
            status_code=404,
            detail="No catalog files or blobs in database for this catalog",
        )

    flowoignore_content = "\n".join(
        [
            ".snakemake",
            ".git",
            "__pycache__",
            "*.pyc",
            ".DS_Store",
            ".ipynb_checkpoints",
            "node_modules",
            "results",
            "logs",
            "benchmarks",
            "output",
            ".pytest_cache",
            "flowo_logs",
        ]
    )

    disk_slug = cat.slug
    buffer = BytesIO()
    with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
        for cf in rows:
            if Path(cf.path).name.startswith("."):
                continue
            data = cf.content.encode("utf-8")
            ti = tarfile.TarInfo(name=f"{disk_slug}/{cf.path}")
            ti.size = len(data)
            tar.addfile(ti, BytesIO(data))

        for br in blob_rows:
            if Path(br.path).name.startswith("."):
                continue
            try:
                raw = _blob_sidecar_path(cat.id, br.path).read_bytes()
            except (ValueError, OSError):
                continue
            ti = tarfile.TarInfo(name=f"{disk_slug}/{br.path}")
            ti.size = len(raw)
            tar.addfile(ti, BytesIO(raw))

        meta_json = json.dumps(
            _flowo_json_payload(cat, disk_slug=disk_slug),
            indent=2,
            ensure_ascii=False,
        ).encode("utf-8")
        ti_meta = tarfile.TarInfo(name=f"{disk_slug}/.flowo.json")
        ti_meta.size = len(meta_json)
        tar.addfile(ti_meta, BytesIO(meta_json))

        ignore_bytes = flowoignore_content.encode("utf-8")
        ti_ignore = tarfile.TarInfo(name=f"{disk_slug}/.flowoignore")
        ti_ignore.size = len(ignore_bytes)
        tar.addfile(ti_ignore, BytesIO(ignore_bytes))

    buffer.seek(0)
    return buffer, disk_slug


async def build_zip_from_db(session: AsyncSession, cat: Catalog) -> tuple[str, str]:
    rows = await load_catalog_file_rows(session, cat.id)
    blob_rows = await load_catalog_blob_rows(session, cat.id)
    if not rows and not blob_rows:
        raise HTTPException(
            status_code=404,
            detail="No catalog files or blobs in database for this catalog",
        )

    disk_slug = cat.slug
    temp_dir = tempfile.mkdtemp()
    tmp_cat_path = Path(temp_dir) / disk_slug
    tmp_cat_path.mkdir(parents=True, exist_ok=True)

    for cf in rows:
        if Path(cf.path).name.startswith("."):
            continue
        dest = tmp_cat_path / cf.path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(cf.content, encoding="utf-8")

    for br in blob_rows:
        if Path(br.path).name.startswith("."):
            continue
        try:
            raw = _blob_sidecar_path(cat.id, br.path).read_bytes()
        except (ValueError, OSError):
            continue
        dest = tmp_cat_path / br.path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(raw)

    with open(tmp_cat_path / ".flowo.json", "w", encoding="utf-8") as f:
        json.dump(
            _flowo_json_payload(cat, disk_slug=disk_slug),
            f,
            indent=2,
            ensure_ascii=False,
        )

    flowoignore_path = tmp_cat_path / ".flowoignore"
    if not flowoignore_path.exists():
        flowoignore_path.write_text(
            "\n".join(
                [
                    ".snakemake",
                    ".git",
                    "__pycache__",
                    "*.pyc",
                    ".DS_Store",
                    ".ipynb_checkpoints",
                    "node_modules",
                    "results",
                    "logs",
                    "benchmarks",
                    "output",
                    ".pytest_cache",
                    "flowo_logs",
                ]
            ),
            encoding="utf-8",
        )

    zip_base = Path(temp_dir) / f"catalog_{disk_slug}"
    zip_path = shutil.make_archive(str(zip_base), "zip", tmp_cat_path)
    return zip_path, disk_slug


def workspace_flags_for_catalog(
    cat: Catalog,
    catalog_path: Path,
    *,
    db_file_count: int,
    db_has_snakefile: bool,
) -> dict[str, Any]:
    """Derive workspace_status / workspace_ready for API responses."""
    path_exists = catalog_path.exists()
    disk_snakefile = workspace_has_snakefile(catalog_path) if path_exists else False

    if cat.workspace_status == "stale":
        status = "stale"
    elif not path_exists:
        status = "missing"
    elif path_exists and not disk_snakefile:
        status = "error" if not db_has_snakefile else "missing"
    elif cat.workspace_status == "error" and cat.last_export_error:
        status = "error"
    else:
        status = "fresh"

    return {
        "workspace_ready": path_exists and disk_snakefile,
        "has_snakefile": db_has_snakefile,
        "workspace_status": status,
        "last_exported_at": cat.last_exported_at.isoformat()
        if cat.last_exported_at
        else None,
        "last_export_error": cat.last_export_error,
        "export_revision": cat.export_revision,
        "file_count": db_file_count,
    }
