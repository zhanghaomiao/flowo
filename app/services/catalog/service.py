import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Catalog
from app.services.third_party.snakevision import dag_svg_path

from .archive import CatalogArchiveMixin
from .git_ops import CatalogGitMixin
from .utils import (
    _get_catalog_dir,
    _get_file_inventory,
    _is_git_configured,
    _validate_path,
    assert_catalog_readable,
    assert_catalog_writable,
    catalog_data_dir,
    catalog_export_dir,
    catalog_readable_by_user,
    workspace_has_snakefile,
)

DAG_PREVIEW_MAX_BYTES = 5 * 1024 * 1024
_DAG_PREVIEW_ALLOWED_MIMES = frozenset(
    {"image/png", "image/jpeg", "image/svg+xml", "image/webp"}
)


def _normalize_dag_preview_mime(
    content_type: str | None, filename: str | None
) -> str | None:
    raw = (content_type or "").split(";", 1)[0].strip().lower()
    if raw == "image/jpg":
        raw = "image/jpeg"
    if raw in _DAG_PREVIEW_ALLOWED_MIMES:
        return raw
    name = (filename or "").lower()
    if name.endswith(".png"):
        return "image/png"
    if name.endswith((".jpg", ".jpeg")):
        return "image/jpeg"
    if name.endswith(".svg"):
        return "image/svg+xml"
    if name.endswith(".webp"):
        return "image/webp"
    return None


class CatalogService(CatalogArchiveMixin, CatalogGitMixin):
    """Service for managing Snakemake workflow catalogs."""

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session

    async def _resolve_catalog_ref(
        self, catalog_ref: str, user_id: uuid.UUID | None
    ) -> Catalog:
        """Resolve ``catalog_ref`` as a catalog UUID or a slug (per-user + readable)."""
        ref = (catalog_ref or "").strip()
        if not ref:
            raise HTTPException(status_code=404, detail="Catalog not found")

        try:
            cid = uuid.UUID(ref)
        except ValueError:
            cid = None

        if cid is not None:
            cat = await self.db_session.get(Catalog, cid)
            if cat is None:
                raise HTTPException(status_code=404, detail="Catalog not found")
            assert_catalog_readable(cat, user_id)
            return cat

        if user_id is None:
            raise HTTPException(
                status_code=401,
                detail="Authentication required to resolve catalog by slug",
            )

        own = (
            await self.db_session.execute(
                select(Catalog).where(
                    Catalog.slug == ref,
                    Catalog.owner_id == user_id,
                )
            )
        ).scalar_one_or_none()
        if own:
            return own

        res = await self.db_session.execute(select(Catalog).where(Catalog.slug == ref))
        candidates = [
            c for c in res.scalars().all() if catalog_readable_by_user(c, user_id)
        ]
        if len(candidates) == 1:
            return candidates[0]
        if not candidates:
            raise HTTPException(status_code=404, detail="Catalog not found")
        raise HTTPException(
            status_code=409,
            detail=(
                "Multiple catalogs share this slug. Open the catalog from the list "
                "and use its id in the URL (e.g. /catalog/<uuid>)."
            ),
        )

    # --- Metadata CRUD ---

    async def list_catalogs(
        self,
        search: str | None = None,
        tags: str | None = None,
        user_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        """List all catalogs with optional search/filter and visibility."""
        query = select(Catalog)

        if user_id:
            from sqlalchemy import or_

            query = query.where(
                or_(
                    Catalog.is_public,
                    Catalog.owner_id == user_id,
                    Catalog.owner_id.is_(None),
                )
            )
        else:
            from sqlalchemy import or_

            query = query.where(or_(Catalog.is_public, Catalog.owner_id.is_(None)))

        if search:
            search_lower = f"%{search.lower()}%"
            query = query.where(
                Catalog.name.ilike(search_lower)
                | Catalog.description.ilike(search_lower)
            )

        if tags:
            tag_list = [t.strip() for t in tags.split(",") if t.strip()]
            for tag in tag_list:
                query = query.where(Catalog.tags.any(tag))

        result = await self.db_session.execute(query)
        catalogs = result.scalars().all()

        git_configured = await _is_git_configured(self.db_session, user_id)

        return [
            {
                "id": str(c.id),
                "slug": c.slug,
                "owner_id": str(c.owner_id) if c.owner_id else None,
                "name": c.name,
                "description": c.description,
                "version": c.version,
                "owner": c.owner,
                "tags": c.tags,
                "is_public": c.is_public,
                "source_url": c.source_url,
                "created_at": c.created_at.isoformat(),
                "updated_at": c.updated_at.isoformat(),
                "git_configured": git_configured,
                "has_dag_preview": bool(c.dag_preview_mime),
            }
            for c in catalogs
        ]

    async def get_catalog(
        self, catalog_ref: str, user_id: uuid.UUID | None = None
    ) -> dict[str, Any]:
        """Get catalog detail with file inventory."""
        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_readable(cat, user_id)

        catalog_path = catalog_data_dir(cat.owner_id, cat.slug)

        if not catalog_path.exists() or not workspace_has_snakefile(catalog_path):
            raise HTTPException(
                status_code=404,
                detail="Catalog filesystem directory not found or invalid",
            )

        inventory = _get_file_inventory(catalog_path)
        file_count = len([f for f in inventory if not f.get("is_dir")])
        has_snakefile = any(
            f["path"] == "workflow/Snakefile" or f["path"] == "Snakefile"
            for f in inventory
        )

        git_configured = await _is_git_configured(self.db_session, user_id)

        return {
            "id": str(cat.id),
            "slug": cat.slug,
            "name": cat.name,
            "description": cat.description,
            "version": cat.version,
            "owner": cat.owner,
            "tags": cat.tags,
            "is_public": cat.is_public,
            "source_url": cat.source_url,
            "created_at": cat.created_at.isoformat(),
            "updated_at": cat.updated_at.isoformat(),
            "rulegraph_data": cat.rulegraph_data,
            "files": inventory,
            "file_count": file_count,
            "has_snakefile": has_snakefile,
            "categories": {},
            "git_configured": git_configured,
            "has_dag_preview": bool(cat.dag_preview_mime),
        }

    async def update_metadata(
        self,
        catalog_ref: str,
        data: dict[str, Any],
        user_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Update catalog metadata."""
        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_writable(cat, user_id)

        allowed_keys = {
            "name",
            "description",
            "version",
            "tags",
            "is_public",
            "source_url",
            "rulegraph_data",
        }
        for key, value in data.items():
            if key in allowed_keys:
                setattr(cat, key, value)

        await self.db_session.commit()
        await self.db_session.refresh(cat)

        catalog_path = catalog_data_dir(cat.owner_id, cat.slug)
        inventory = _get_file_inventory(catalog_path) if catalog_path.exists() else []
        file_count = len([f for f in inventory if not f.get("is_dir")])
        has_snakefile = any(
            f["path"] == "workflow/Snakefile" or f["path"] == "Snakefile"
            for f in inventory
        )

        return {
            "id": str(cat.id),
            "slug": cat.slug,
            "name": cat.name,
            "description": cat.description,
            "version": cat.version,
            "owner": cat.owner,
            "tags": cat.tags,
            "is_public": cat.is_public,
            "source_url": cat.source_url,
            "created_at": cat.created_at.isoformat(),
            "updated_at": cat.updated_at.isoformat(),
            "file_count": file_count,
            "has_snakefile": has_snakefile,
            "has_dag_preview": bool(cat.dag_preview_mime),
        }

    async def delete_catalog(
        self,
        catalog_ref: str,
        user_id: uuid.UUID | None = None,
        background_tasks: Any | None = None,
    ) -> None:
        """Delete a catalog from DB and filesystem."""
        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_writable(cat, user_id)
        owner_id = cat.owner_id
        disk_slug = cat.slug

        await self.db_session.delete(cat)
        await self.db_session.commit()

        for p in (
            catalog_data_dir(owner_id, disk_slug),
            catalog_export_dir(owner_id, disk_slug),
        ):
            if p.exists():
                shutil.rmtree(p)

        if background_tasks:
            from app.core.session import AsyncSessionLocal

            from .sync import sync_catalog_with_git

            background_tasks.add_task(
                sync_catalog_with_git,
                catalog_dir=_get_catalog_dir(),
                user_id=user_id,
                session_factory=AsyncSessionLocal,
                commit_message=f"Delete catalog: {disk_slug}",
            )

    # --- File Operations ---

    async def read_file(
        self, catalog_ref: str, file_path: str, user_id: uuid.UUID | None
    ) -> dict[str, Any]:
        """Read a file directly from the filesystem."""
        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_readable(cat, user_id)

        full_path = _validate_path(cat.owner_id, cat.slug, file_path)
        if full_path.exists() and full_path.is_file():
            content = full_path.read_text(errors="replace")
            from .utils import _detect_language

            return {
                "path": file_path,
                "name": full_path.name,
                "content": content,
                "language": _detect_language(file_path),
                "lines": content.count("\n") + 1,
                "size": full_path.stat().st_size,
            }
        raise HTTPException(status_code=404, detail="File not found")

    async def batch_import_files(
        self,
        catalog_ref: str,
        mode: str,
        files_data: list[dict],
        delete_paths: list[str] | None = None,
        commit_message: str = "Batch import",
        author: str = "system",
        user_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Batch write files directly to the filesystem."""
        if delete_paths is None:
            delete_paths = []

        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_writable(cat, user_id)

        root = catalog_data_dir(cat.owner_id, cat.slug)
        root.mkdir(parents=True, exist_ok=True)

        added = 0
        modified = 0
        deleted = 0
        skipped = 0

        if mode == "replace":
            incoming_paths = {f["path"] for f in files_data}
            existing_files = [
                str(p.relative_to(root))
                for p in root.rglob("*")
                if p.is_file() and not str(p.relative_to(root)).startswith(".git")
            ]
            for path in existing_files:
                if path not in incoming_paths:
                    file_to_del = root / path
                    if file_to_del.exists():
                        file_to_del.unlink()
                        deleted += 1

        for path in delete_paths:
            file_to_del = root / path
            if file_to_del.exists() and file_to_del.is_file():
                file_to_del.unlink()
                deleted += 1

        for f in files_data:
            path = f["path"]
            content = f["content"]
            dest = root / path
            dest.parent.mkdir(parents=True, exist_ok=True)

            is_new = not dest.exists()
            is_changed = True
            if not is_new:
                try:
                    # Compare content to avoid false 'modified' counts
                    existing_content = dest.read_text(encoding="utf-8")
                    if existing_content == content:
                        is_changed = False
                except Exception:
                    pass

            if is_changed:
                dest.write_text(content, encoding="utf-8")
                if is_new:
                    added += 1
                else:
                    modified += 1
            else:
                skipped += 1

        return {
            "status": "completed",
            "summary": {
                "added": added,
                "modified": modified,
                "deleted": deleted,
                "skipped": skipped,
                "conflicts": 0,
            },
        }

    async def create_directory(
        self,
        catalog_ref: str,
        directory_path: str,
        user_id: uuid.UUID | None,
    ) -> dict[str, str]:
        """Create a new directory in the catalog filesystem."""
        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_writable(cat, user_id)

        full_path = _validate_path(cat.owner_id, cat.slug, directory_path)
        full_path.mkdir(parents=True, exist_ok=True)

        return {"path": directory_path, "status": "created"}

    # --- DAG Operations ---

    async def generate_dag(
        self, catalog_ref: str, user_id: uuid.UUID | None = None
    ) -> dict[str, Any]:
        """Return cached DAG data from DB."""
        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_readable(cat, user_id)

        if not cat.rulegraph_data:
            return {
                "nodes": [],
                "links": [],
                "error": "No cached DAG data available. Run the workflow at least once to generate the DAG.",
            }

        return cat.rulegraph_data

    async def catalog_export_paths_for_dag(
        self, catalog_ref: str, user_id: uuid.UUID
    ) -> tuple[uuid.UUID | None, Path]:
        """Owner id and catalog **workspace** path (``catalog_data_dir``) for DAG / Snakefile checks.

        Despite the historical name, this is not ``catalog_export_dir``; DAG generation
        must read the authoritative tree under ``CATALOG_DIR``.
        """
        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_readable(cat, user_id)
        return cat.owner_id, catalog_data_dir(cat.owner_id, cat.slug)

    async def set_dag_preview_image(
        self,
        catalog_ref: str,
        user_id: uuid.UUID,
        data: bytes,
        content_type: str | None,
        filename: str | None,
    ) -> None:
        """Store a user-uploaded DAG preview image (DB only; not exported in archives)."""
        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_writable(cat, user_id)
        if len(data) > DAG_PREVIEW_MAX_BYTES:
            raise HTTPException(
                status_code=400,
                detail=f"Image too large (max {DAG_PREVIEW_MAX_BYTES // (1024 * 1024)} MiB)",
            )
        mime = _normalize_dag_preview_mime(content_type, filename)
        if mime is None:
            raise HTTPException(
                status_code=400,
                detail="Unsupported image type; use PNG, JPEG, SVG, or WebP",
            )
        cat.dag_preview_mime = mime
        cat.dag_preview_bytes = data
        await self.db_session.commit()

    async def clear_dag_preview_image(
        self, catalog_ref: str, user_id: uuid.UUID
    ) -> None:
        """Remove the user-uploaded DAG preview image."""
        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_writable(cat, user_id)
        cat.dag_preview_mime = None
        cat.dag_preview_bytes = None
        await self.db_session.commit()

    async def read_dag_visual_bytes(
        self, catalog_ref: str, user_id: uuid.UUID
    ) -> tuple[bytes, str] | None:
        """User-uploaded image bytes, else generated ``dag.svg`` bytes, else ``None``."""
        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_readable(cat, user_id)
        if cat.dag_preview_mime:
            blob = (
                await self.db_session.execute(
                    select(Catalog.dag_preview_bytes).where(Catalog.id == cat.id)
                )
            ).scalar_one_or_none()
            if blob:
                return blob, cat.dag_preview_mime
        svg = dag_svg_path(cat.owner_id, cat.slug)
        if svg.is_file() and svg.stat().st_size > 0:
            return svg.read_bytes(), "image/svg+xml"
        return None
