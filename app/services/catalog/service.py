import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Catalog

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
    workspace_has_snakefile,
)


class CatalogService(CatalogArchiveMixin, CatalogGitMixin):
    """Service for managing Snakemake workflow catalogs."""

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session

    async def _get_catalog_or_404(self, slug: str) -> Catalog:
        result = await self.db_session.execute(
            select(Catalog).where(Catalog.slug == slug)
        )
        cat = result.scalar_one_or_none()
        if not cat:
            raise HTTPException(status_code=404, detail="Catalog not found")
        return cat

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
            }
            for c in catalogs
        ]

    async def get_catalog(
        self, slug: str, user_id: uuid.UUID | None = None
    ) -> dict[str, Any]:
        """Get catalog detail with file inventory."""
        cat = await self._get_catalog_or_404(slug)
        assert_catalog_readable(cat, user_id)

        catalog_path = catalog_data_dir(cat.owner_id, slug)

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
            "slug": slug,
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
        }

    async def update_metadata(
        self,
        slug: str,
        data: dict[str, Any],
        user_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        """Update catalog metadata."""
        cat = await self._get_catalog_or_404(slug)
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

        catalog_path = catalog_data_dir(cat.owner_id, slug)
        inventory = _get_file_inventory(catalog_path) if catalog_path.exists() else []
        file_count = len([f for f in inventory if not f.get("is_dir")])
        has_snakefile = any(
            f["path"] == "workflow/Snakefile" or f["path"] == "Snakefile"
            for f in inventory
        )

        return {
            "id": str(cat.id),
            "slug": slug,
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
        }

    async def delete_catalog(
        self,
        slug: str,
        user_id: uuid.UUID | None = None,
        background_tasks: Any | None = None,
    ) -> None:
        """Delete a catalog from DB and filesystem."""
        cat = await self._get_catalog_or_404(slug)
        assert_catalog_writable(cat, user_id)
        owner_id = cat.owner_id

        await self.db_session.delete(cat)
        await self.db_session.commit()

        for p in (catalog_data_dir(owner_id, slug), catalog_export_dir(owner_id, slug)):
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
                commit_message=f"Delete catalog: {slug}",
            )

    # --- File Operations ---

    async def read_file(
        self, slug: str, file_path: str, user_id: uuid.UUID | None
    ) -> dict[str, Any]:
        """Read a file directly from the filesystem."""
        cat = await self._get_catalog_or_404(slug)
        assert_catalog_readable(cat, user_id)

        full_path = _validate_path(cat.owner_id, slug, file_path)
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
        slug: str,
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

        cat = await self._get_catalog_or_404(slug)
        assert_catalog_writable(cat, user_id)

        root = catalog_data_dir(cat.owner_id, slug)
        root.mkdir(parents=True, exist_ok=True)

        added = 0
        modified = 0
        deleted = 0

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
            dest.write_text(content, encoding="utf-8")

            if is_new:
                added += 1
            else:
                modified += 1

        return {
            "status": "completed",
            "summary": {
                "added": added,
                "modified": modified,
                "deleted": deleted,
                "skipped": 0,
                "conflicts": 0,
            },
        }

    async def create_directory(
        self,
        slug: str,
        directory_path: str,
        user_id: uuid.UUID | None,
    ) -> dict[str, str]:
        """Create a new directory in the catalog filesystem."""
        cat = await self._get_catalog_or_404(slug)
        assert_catalog_writable(cat, user_id)

        full_path = _validate_path(cat.owner_id, slug, directory_path)
        full_path.mkdir(parents=True, exist_ok=True)

        return {"path": directory_path, "status": "created"}

    # --- DAG Operations ---

    async def generate_dag(
        self, slug: str, user_id: uuid.UUID | None = None
    ) -> dict[str, Any]:
        """Return cached DAG data from DB."""
        cat = await self._get_catalog_or_404(slug)
        assert_catalog_readable(cat, user_id)

        if not cat.rulegraph_data:
            return {
                "nodes": [],
                "links": [],
                "error": "No cached DAG data available. Run the workflow at least once to generate the DAG.",
            }

        return cat.rulegraph_data

    async def catalog_export_paths_for_dag(
        self, slug: str, user_id: uuid.UUID
    ) -> tuple[uuid.UUID | None, Path]:
        """Resolve catalog root for DAG generation."""
        cat = await self._get_catalog_or_404(slug)
        assert_catalog_readable(cat, user_id)
        return cat.owner_id, catalog_data_dir(cat.owner_id, slug)
