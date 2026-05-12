import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Catalog
from app.services.catalog.catalog_storage import (
    catalog_db_has_snakefile,
    catalog_file_stats_for_many,
    load_catalog_blob_rows,
    load_catalog_file_rows,
    materialize_catalog_workspace,
    merge_catalog_text_and_blob_inventory,
    read_catalog_file_from_db,
    remove_catalog_blob_tree,
    upsert_catalog_blobs,
    upsert_catalog_files,
    workspace_flags_for_catalog,
)
from app.services.third_party.snakevision import dag_svg_path

from .archive import CatalogArchiveMixin
from .git_ops import CatalogGitMixin
from .utils import (
    _get_catalog_dir,
    _is_git_configured,
    _validate_path,
    assert_catalog_readable,
    assert_catalog_writable,
    catalog_data_dir,
    catalog_export_dir,
    catalog_readable_by_user,
)

DAG_PREVIEW_MAX_BYTES = 5 * 1024 * 1024
_DAG_PREVIEW_ALLOWED_MIMES = frozenset(
    {"image/png", "image/jpeg", "image/svg+xml", "image/webp"}
)


def _catalog_summary(
    cat: Catalog,
    *,
    git_configured: bool,
    workspace: dict[str, Any] | None = None,
) -> dict[str, Any]:
    data = {
        "id": str(cat.id),
        "slug": cat.slug,
        "owner_id": str(cat.owner_id) if cat.owner_id else None,
        "name": cat.name,
        "description": cat.description,
        "version": cat.version,
        "owner": cat.owner,
        "tags": cat.tags,
        "is_public": cat.is_public,
        "source_url": cat.source_url,
        "created_at": cat.created_at.isoformat(),
        "updated_at": cat.updated_at.isoformat(),
        "git_configured": git_configured,
        "has_dag_preview": bool(cat.dag_preview_mime),
    }
    if workspace is not None:
        data.update(
            {
                "workspace_ready": workspace["workspace_ready"],
                "workspace_status": workspace["workspace_status"],
                "last_exported_at": workspace["last_exported_at"],
                "last_export_error": workspace["last_export_error"],
                "export_revision": workspace["export_revision"],
                "has_snakefile": workspace["has_snakefile"],
            }
        )
    return data


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
        stats = await catalog_file_stats_for_many(
            self.db_session, [c.id for c in catalogs]
        )

        return [
            _catalog_summary(
                c,
                git_configured=git_configured,
                workspace=workspace_flags_for_catalog(
                    c,
                    catalog_data_dir(c.owner_id, c.slug),
                    db_file_count=stats.get(c.id, (0, False))[0],
                    db_has_snakefile=stats.get(c.id, (0, False))[1],
                ),
            )
            for c in catalogs
        ]

    async def get_catalog(
        self, catalog_ref: str, user_id: uuid.UUID | None = None
    ) -> dict[str, Any]:
        """Get catalog detail; metadata from DB, file list from workspace when present."""
        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_readable(cat, user_id)

        catalog_path = catalog_data_dir(cat.owner_id, cat.slug)
        rows = await load_catalog_file_rows(self.db_session, cat.id)
        blobs = await load_catalog_blob_rows(self.db_session, cat.id)
        inventory = merge_catalog_text_and_blob_inventory(rows, blobs)
        file_count = len([f for f in inventory if not f.get("is_dir")])
        db_has_snake = await catalog_db_has_snakefile(self.db_session, cat.id)
        ws = workspace_flags_for_catalog(
            cat,
            catalog_path,
            db_file_count=file_count,
            db_has_snakefile=db_has_snake,
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
            "has_snakefile": ws["has_snakefile"],
            "categories": {},
            "git_configured": git_configured,
            "has_dag_preview": bool(cat.dag_preview_mime),
            **ws,
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
        rows = await load_catalog_file_rows(self.db_session, cat.id)
        blobs = await load_catalog_blob_rows(self.db_session, cat.id)
        inventory = merge_catalog_text_and_blob_inventory(rows, blobs)
        file_count = len([f for f in inventory if not f.get("is_dir")])
        db_has_snake = await catalog_db_has_snakefile(self.db_session, cat.id)
        ws = workspace_flags_for_catalog(
            cat,
            catalog_path,
            db_file_count=file_count,
            db_has_snakefile=db_has_snake,
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
            "has_snakefile": ws["has_snakefile"],
            "has_dag_preview": bool(cat.dag_preview_mime),
            **ws,
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
        catalog_id = cat.id

        await self.db_session.delete(cat)
        await self.db_session.commit()

        remove_catalog_blob_tree(catalog_id)

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
        """Read a catalog file from the database (workspace cache not required)."""
        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_readable(cat, user_id)

        data = await read_catalog_file_from_db(self.db_session, cat.id, file_path)
        if data is None:
            raise HTTPException(status_code=404, detail="File not found")
        return data

    async def batch_import_files(
        self,
        catalog_ref: str,
        mode: str,
        files_data: list[dict],
        delete_paths: list[str] | None = None,
        commit_message: str = "Batch import",
        author: str = "system",
        user_id: uuid.UUID | None = None,
        binaries: list[tuple[str, bytes]] | None = None,
    ) -> dict[str, Any]:
        """Upsert catalog text in DB + optional binary sidecar; workspace becomes stale until materialized."""
        if delete_paths is None:
            delete_paths = []

        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_writable(cat, user_id)

        summary = await upsert_catalog_files(
            self.db_session,
            cat.id,
            files_data,
            mode,
            delete_paths,
        )
        blob_summary: dict[str, int] | None = None
        if binaries:
            blob_summary = await upsert_catalog_blobs(
                self.db_session,
                cat.id,
                binaries,
                mode,
                delete_paths,
            )

        if await catalog_db_has_snakefile(self.db_session, cat.id):
            cat.workspace_status = "stale"
            cat.last_export_error = None
        else:
            cat.workspace_status = "error"
            cat.last_export_error = "Snakefile missing in catalog files (expected workflow/Snakefile or Snakefile)"

        await self.db_session.commit()

        out: dict[str, Any] = {
            "status": "completed",
            "summary": {
                "added": summary["added"],
                "modified": summary["modified"],
                "deleted": summary["deleted"],
                "skipped": summary["skipped"],
                "conflicts": summary["conflicts"],
            },
        }
        if blob_summary is not None:
            out["blob_summary"] = blob_summary
        return out

    async def create_directory(
        self,
        catalog_ref: str,
        directory_path: str,
        user_id: uuid.UUID | None,
    ) -> dict[str, str]:
        """Create a directory on the materialized workspace (empty dirs are not stored in the DB)."""
        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_writable(cat, user_id)

        await materialize_catalog_workspace(self.db_session, cat)
        await self.db_session.commit()

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
        """Owner id and catalog workspace path after materializing from the database."""
        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_readable(cat, user_id)
        await materialize_catalog_workspace(self.db_session, cat)
        await self.db_session.commit()
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
