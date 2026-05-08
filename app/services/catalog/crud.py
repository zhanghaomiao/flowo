import shutil
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import HTTPException
from sqlalchemy import delete, select

from app.models import Catalog
from app.models.catalog_file import CatalogFile

from .access import assert_catalog_readable, assert_catalog_writable
from .paths import catalog_data_dir, catalog_export_dir
from .sync import sync_catalog_with_git
from .utils import (
    _get_catalog_dir,
    _get_file_inventory,
    _is_git_configured,
    _slugify,
    workspace_has_snakefile,
)

# New catalogs follow https://github.com/snakemake-workflows/snakemake-workflow-template
# layout (workflow/, config/, profiles/, .snakemake-workflow-catalog.yml, .test/).
# We keep Flowo's top-level ``resources/`` for user assets; template .gitignore's
# ``resources/**`` is omitted so that directory stays visible to Git.
_BLANK_CATALOG_SNAKEFILE = """# Starter workflow — layout matches the Snakemake workflow template:
# https://github.com/snakemake-workflows/snakemake-workflow-template
# Best practices: https://snakemake.readthedocs.io/en/stable/snakefiles/best_practices.html

configfile: "config/config.yaml"

rule all:
    default_target: True
    shell: "echo Flowo catalog ready; extend workflow/rules as in the upstream template."
"""

_BLANK_CATALOG_CONFIG_YAML = "{}\n"

_BLANK_CATALOG_CONFIG_README = """# Workflow configuration

Use `config.yaml` for workflow parameters. See the
[Snakemake workflow template](https://github.com/snakemake-workflows/snakemake-workflow-template)
`config/README.md` for a full example.
"""

_BLANK_CATALOG_README = """# Snakemake workflow (catalog)

This tree follows the [Snakemake workflow template](https://github.com/snakemake-workflows/snakemake-workflow-template):

- `workflow/` — `Snakefile` and optional `rules/`, `envs/`, …
- `config/` — `config.yaml` and documentation
- `profiles/` — optional Snakemake profiles
- `.snakemake-workflow-catalog.yml` — metadata for the [Snakemake Workflow Catalog](https://snakemake.github.io/snakemake-workflow-catalog)
- `.test/` — small config for `snakemake --directory .test` dry runs

**Flowo:** the top-level `resources/` folder is reserved for static assets in Flowo; it is not the same as the template’s ignored `resources/**` output path in their `.gitignore`.

To start from the full upstream template (GitHub Actions, richer rules), use **Import from Git** with that repository URL, or merge files from your local clone.
"""

_BLANK_CATALOG_DOT_CATALOG_YML = """# Snakemake Workflow Catalog — https://snakemake.github.io/snakemake-workflow-catalog

usage:
  mandatory-flags:
    desc: Describe workflow-specific CLI flags here.
    flags: ""
  software-stack-deployment:
    conda: true
    apptainer: false
    apptainer+conda: false
    report: false
"""

_BLANK_CATALOG_GITIGNORE = """results/**
logs/**
.snakemake
.snakemake/**
.test/results/*
workflow/notebooks/.ipynb_checkpoints/**
**/.Rhistory
**/*.Rproj
**/.Rproj.user/**
**/.RData
**/Rplots.pdf
"""

_BLANK_CATALOG_TEST_CONFIG_YAML = (
    "# Overrides for `snakemake --directory .test` (see upstream template `.test/`).\n"
    "{}\n"
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

    async def export_all_catalogs_to_fs(self) -> dict[str, Any]:
        """Export all catalog files from database to filesystem (read-only cache)."""
        query = select(CatalogFile, Catalog.owner_id).join(
            Catalog, Catalog.slug == CatalogFile.catalog_slug
        )
        result = await self.db_session.execute(query)
        rows = list(result.all())

        for file, owner_id in rows:
            await self._export_to_filesystem(
                owner_id,
                file.catalog_slug,
                file.path,
                file.content,
            )

        return {
            "status": "exported",
            "files_exported": len(rows),
            "timestamp": datetime.now(UTC).isoformat(),
        }

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

        catalog_path = catalog_data_dir(owner_id, slug)
        if catalog_path.exists():
            raise HTTPException(
                status_code=409,
                detail=f"Catalog directory '{slug}' already exists",
            )

        # Create directory structure (always under owner-scoped path)
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
        (config_dir / "config.yaml").write_text(
            _BLANK_CATALOG_CONFIG_YAML, encoding="utf-8"
        )
        (config_dir / "README.md").write_text(
            _BLANK_CATALOG_CONFIG_README, encoding="utf-8"
        )

        profiles_dir = catalog_path / "profiles"
        profiles_dir.mkdir()

        test_cfg = catalog_path / ".test" / "config"
        test_cfg.mkdir(parents=True, exist_ok=True)
        (test_cfg / "config.yaml").write_text(
            _BLANK_CATALOG_TEST_CONFIG_YAML, encoding="utf-8"
        )

        resources_dir = catalog_path / "resources"
        resources_dir.mkdir()

        (catalog_path / ".snakemake-workflow-catalog.yml").write_text(
            _BLANK_CATALOG_DOT_CATALOG_YML, encoding="utf-8"
        )
        (catalog_path / "README.md").write_text(_BLANK_CATALOG_README, encoding="utf-8")
        (catalog_path / ".gitignore").write_text(
            _BLANK_CATALOG_GITIGNORE, encoding="utf-8"
        )

        snakefile = workflow_dir / "Snakefile"
        snakefile.write_text(_BLANK_CATALOG_SNAKEFILE, encoding="utf-8")

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
                catalog_dir=_get_catalog_dir(),
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
            "file_count": 7,
            "has_snakefile": True,
        }

    async def get_catalog(
        self, slug: str, user_id: uuid.UUID | None = None
    ) -> dict[str, Any]:
        """Get catalog detail with file inventory."""
        cat = await self._get_catalog_or_404(slug)
        assert_catalog_readable(cat, user_id)

        catalog_path = catalog_data_dir(cat.owner_id, slug)

        if not catalog_path.exists() or (
            catalog_path.exists() and not workspace_has_snakefile(catalog_path)
        ):
            if await self._catalog_file_count_in_db(slug) > 0:
                await self.hydrate_catalog_workspace_from_db(slug)

        if not catalog_path.exists():
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
        cat = await self._get_catalog_or_404(slug)
        assert_catalog_writable(cat, user_id)

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
        catalog_path = catalog_data_dir(cat.owner_id, slug)
        if (
            not catalog_path.exists() or not workspace_has_snakefile(catalog_path)
        ) and await self._catalog_file_count_in_db(slug) > 0:
            await self.hydrate_catalog_workspace_from_db(slug)

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

        # Delete catalog files first
        from app.models.catalog_file import CatalogFileVersion

        # Delete file versions
        await self.db_session.execute(
            delete(CatalogFileVersion).where(
                CatalogFileVersion.file_id.in_(
                    select(CatalogFile.id).where(CatalogFile.catalog_slug == slug)
                )
            )
        )
        # Delete catalog files
        await self.db_session.execute(
            delete(CatalogFile).where(CatalogFile.catalog_slug == slug)
        )

        await self.db_session.delete(cat)
        await self.db_session.commit()

        for p in (catalog_data_dir(owner_id, slug), catalog_export_dir(owner_id, slug)):
            if p.exists():
                shutil.rmtree(p)

        # Trigger Git push via modularized background task
        if background_tasks:
            from app.core.session import AsyncSessionLocal

            background_tasks.add_task(
                sync_catalog_with_git,
                catalog_dir=_get_catalog_dir(),
                user_id=user_id,
                session_factory=AsyncSessionLocal,
                commit_message=f"Delete catalog: {slug}",
            )
