import shutil
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select

from app.models import Catalog

from .sync import sync_catalog_with_git
from .utils import (
    _get_catalog_dir,
    _get_file_inventory,
    _is_git_configured,
    _slugify,
)


class CatalogCRUDMixin:
    async def list_catalogs(
        self,
        search: str | None = None,
        tags: str | None = None,
        user_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        """List all catalogs with optional search/filter and visibility."""
        query = select(Catalog)

        # Visibility filter: public OR owned by current user OR shared (no owner)
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

    async def sync_catalogs(self) -> dict[str, Any]:
        """Manual trigger to sync filesystem with database."""
        await self._sync_from_filesystem(force=True)
        return {"status": "synchronized", "timestamp": datetime.now(UTC).isoformat()}

    async def create_catalog(
        self,
        name: str,
        description: str = "",
        tags: list[str] | None = None,
        owner: str = "unknown",
        owner_id: uuid.UUID | None = None,
        background_tasks: Any | None = None,
    ) -> dict[str, Any]:
        """Create a new catalog (DB and filesystem)."""
        slug = _slugify(name)

        # Check DB first
        query = select(Catalog).where(Catalog.slug == slug)
        result = await self.db_session.execute(query)
        if result.scalar_one_or_none():
            raise HTTPException(
                status_code=409,
                detail=f"Catalog '{slug}' already exists",
            )

        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug
        if catalog_path.exists():
            raise HTTPException(
                status_code=409,
                detail=f"Catalog directory '{slug}' already exists",
            )

        # Create directory structure
        catalog_path.mkdir(parents=True)
        workflow_dir = catalog_path / "workflow"
        workflow_dir.mkdir()
        (workflow_dir / "rules").mkdir()
        (workflow_dir / "envs").mkdir()
        (workflow_dir / "scripts").mkdir()
        (workflow_dir / "notebooks").mkdir()
        (workflow_dir / "report").mkdir()

        config_dir = catalog_path / "config"
        config_dir.mkdir()

        resources_dir = catalog_path / "resources"
        resources_dir.mkdir()

        # Create mandatory Snakefile
        snakefile = workflow_dir / "Snakefile"
        snakefile.write_text(
            '# Snakemake workflow\n\nrule all:\n    shell: "echo "hello""\n'
        )

        # DB Create
        new_catalog = Catalog(
            slug=slug,
            name=name,
            description=description,
            tags=tags or [],
            owner=owner,
            owner_id=owner_id,
        )
        self.db_session.add(new_catalog)
        await self.db_session.commit()
        await self.db_session.refresh(new_catalog)

        if background_tasks:
            from app.core.session import AsyncSessionLocal

            background_tasks.add_task(
                sync_catalog_with_git,
                catalog_dir=catalog_dir,
                user_id=owner_id,
                session_factory=AsyncSessionLocal,
                commit_message=f"Create catalog: {slug}",
            )

        return {
            "id": str(new_catalog.id),
            "name": name,
            "description": description,
            "version": "0.1.0",
            "owner": owner,
            "tags": tags or [],
            "is_public": False,
            "source_url": "",
            "created_at": new_catalog.created_at.isoformat(),
            "updated_at": new_catalog.updated_at.isoformat(),
            "slug": slug,
            "file_count": 1,
            "has_snakefile": True,
        }

    async def get_catalog(
        self, slug: str, user_id: uuid.UUID | None = None
    ) -> dict[str, Any]:
        """Get catalog detail with file inventory."""
        query = select(Catalog).where(Catalog.slug == slug)
        result = await self.db_session.execute(query)
        cat = result.scalar_one_or_none()

        if not cat:
            raise HTTPException(status_code=404, detail="Catalog not found")

        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug

        if not catalog_path.exists():
            # Handle DB-only or inconsistent state
            raise HTTPException(
                status_code=404, detail="Catalog filesystem directory not found"
            )

        inventory = _get_file_inventory(catalog_path)

        # Count files (exclude directories)
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
        """Update catalog metadata (DB and .flowo.json)."""
        query = select(Catalog).where(Catalog.slug == slug)
        result = await self.db_session.execute(query)
        cat = result.scalar_one_or_none()

        if not cat:
            raise HTTPException(status_code=404, detail="Catalog not found")

        # Update DB
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

        # Calculate extra fields for response
        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug

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
        # DB Delete
        query = select(Catalog).where(Catalog.slug == slug)
        result = await self.db_session.execute(query)
        cat = result.scalar_one_or_none()
        if cat:
            await self.db_session.delete(cat)
            await self.db_session.commit()

        # FS Delete
        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug
        if catalog_path.exists():
            shutil.rmtree(catalog_path)

        # Trigger Git push via modularized background task
        if background_tasks:
            from app.core.session import AsyncSessionLocal

            background_tasks.add_task(
                sync_catalog_with_git,
                catalog_dir=catalog_dir,
                user_id=user_id,
                session_factory=AsyncSessionLocal,
                commit_message=f"Delete catalog: {slug}",
            )
