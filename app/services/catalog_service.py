"""
Service for managing Snakemake workflow catalogs on the local filesystem.

Each catalog item is stored as a directory under CATALOG_DIR/<slug>/ with:
  - .flowo.json   (metadata sidecar)
  - workflow/Snakefile  (mandatory)
  - workflow/rules/, envs/, scripts/, notebooks/, report/  (optional, on-demand)
  - config/  (optional)
"""

import json
import re
import shutil
import tarfile
import tempfile
import time
import uuid
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..models import Catalog
from .git_service import git_service

# Snakemake category → relative directory mapping
CATEGORIES: dict[str, dict[str, Any]] = {
    "snakefile": {
        "dir": "workflow",
        "file": "Snakefile",
        "required": True,
        "extensions": [],
    },
    "rules": {
        "dir": "workflow/rules",
        "required": False,
        "extensions": [".smk"],
    },
    "envs": {
        "dir": "workflow/envs",
        "required": False,
        "extensions": [".yaml", ".yml"],
    },
    "scripts": {
        "dir": "workflow/scripts",
        "required": False,
        "extensions": [".py", ".R", ".r", ".sh", ".pl"],
    },
    "report": {
        "dir": "workflow/report",
        "required": False,
        "extensions": [".rst"],
    },
    "notebooks": {
        "dir": "workflow/notebooks",
        "required": False,
        "extensions": [".ipynb"],
    },
    "error": {
        "dir": "logs",
        "required": False,
        "extensions": [".log"],
    },
    "config": {
        "dir": "config",
        "required": False,
        "extensions": [".yaml", ".yml", ".tsv", ".json"],
    },
}

# Language detection from file extension
LANG_MAP: dict[str, str] = {
    ".py": "python",
    ".smk": "python",
    ".R": "r",
    ".r": "r",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".json": "json",
    ".sh": "shell",
    ".rst": "restructuredtext",
    ".md": "markdown",
    ".tsv": "plaintext",
    ".pl": "perl",
}


def _slugify(name: str) -> str:
    """Convert a catalog name to a filesystem-safe slug."""
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def _get_catalog_dir() -> Path:
    """Get and ensure the root catalog directory exists."""
    catalog_dir = Path(settings.CATALOG_DIR)
    catalog_dir.mkdir(parents=True, exist_ok=True)
    return catalog_dir


def _read_metadata(catalog_path: Path) -> dict[str, Any]:
    """Read .flowo.json metadata from a catalog directory."""
    meta_file = catalog_path / ".flowo.json"
    if not meta_file.exists():
        return {}
    with open(meta_file) as f:
        return json.load(f)


def _write_metadata(catalog_path: Path, metadata: dict[str, Any]) -> None:
    """Write .flowo.json metadata to a catalog directory."""
    meta_file = catalog_path / ".flowo.json"
    metadata["updated_at"] = datetime.now(UTC).isoformat()
    with open(meta_file, "w") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)


def _get_file_inventory(catalog_path: Path) -> list[dict[str, Any]]:
    """Build a recursive inventory of all files in the catalog."""
    files: list[dict[str, Any]] = []

    # Walk through all files and directories in the catalog
    for f in sorted(catalog_path.rglob("*")):
        if f.name == ".flowo.json" or f.name.startswith("."):
            continue

        rel_path = str(f.relative_to(catalog_path))

        if f.is_dir():
            files.append(
                {
                    "name": f.name,
                    "path": rel_path,
                    "is_dir": True,
                    "lines": 0,
                    "size": 0,
                    "modified": datetime.fromtimestamp(
                        f.stat().st_mtime, tz=UTC
                    ).isoformat(),
                    "language": None,
                }
            )
            continue

        if not f.is_file():
            continue

        stat = f.stat()
        try:
            # We only read the first few lines to count, or just count \n
            # Reading the whole file might be expensive for large files, but catalogs are usually small
            content = f.read_text(errors="replace")
            line_count = content.count("\n") + 1
        except Exception:
            line_count = 0

        files.append(
            {
                "name": f.name,
                "path": rel_path,
                "is_dir": False,
                "lines": line_count,
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime, tz=UTC).isoformat(),
                "language": _detect_language(rel_path),
            }
        )

    return files


def _detect_language(file_path: str) -> str:
    """Detect Monaco language from file extension or name."""
    p = Path(file_path)
    if p.name == "Snakefile":
        return "python"
    ext = p.suffix
    return LANG_MAP.get(ext, "plaintext")


def _validate_path(slug: str, file_path: str) -> Path:
    """Validate that the path is within the catalog directory (prevent traversal)."""
    catalog_dir = _get_catalog_dir()
    catalog_path = catalog_dir / slug

    # Handle empty path (root)
    if not file_path or file_path == ".":
        return catalog_path.resolve()

    full_path = (catalog_path / file_path).resolve()

    if not str(full_path).startswith(str(catalog_path.resolve())):
        raise HTTPException(status_code=400, detail="Invalid path")

    return full_path


# --- Global state for sync throttling ---
_LAST_SYNC_TIME: float = 0
SYNC_THROTTLE_SECONDS = 30  # Don't sync more than once every 30s


class CatalogService:
    """Service for managing Snakemake workflow catalogs."""

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session

    async def _sync_from_filesystem(self, force: bool = False) -> None:
        """Sync catalogs from filesystem to database based on refined policy."""
        global _LAST_SYNC_TIME

        # Throttling check
        now_ts = time.time()
        if not force and (now_ts - _LAST_SYNC_TIME) < SYNC_THROTTLE_SECONDS:
            return

        catalog_dir = _get_catalog_dir()

        # Get all filesystem slugs
        fs_slugs = {
            entry.name
            for entry in catalog_dir.iterdir()
            if entry.is_dir() and not entry.name.startswith(".")
        }

        # Get all DB catalogs
        result = await self.db_session.execute(select(Catalog))
        db_catalogs = result.scalars().all()
        db_slugs = {c.slug for c in db_catalogs}

        # 1. Handle orphaned records (DB exists, FS does not)
        orphaned_slugs = db_slugs - fs_slugs
        if orphaned_slugs:
            from sqlalchemy import delete

            await self.db_session.execute(
                delete(Catalog).where(Catalog.slug.in_(list(orphaned_slugs)))
            )

        # 2. Sync existing or new catalogs
        changed = False
        for slug in fs_slugs:
            catalog_path = catalog_dir / slug
            meta_file = catalog_path / ".flowo.json"
            if not meta_file.exists():
                continue

            db_cat = next((c for c in db_catalogs if c.slug == slug), None)

            # Optimization: Only read metadata if needed
            # For new catalogs, we must read.
            # For existing, we can optionally check mtime here if we want to be even faster,
            # but reading JSON is relatively fast compared to directory walking.

            meta = _read_metadata(catalog_path)

            if not db_cat:
                new_catalog = Catalog(
                    slug=slug,
                    name=meta.get("name", slug.replace("-", " ").title()),
                    description=meta.get("description", ""),
                    version=meta.get("version", "0.1.0"),
                    owner=meta.get("owner", "unknown"),
                    is_public=meta.get("is_public", False),
                    source_url=meta.get("source_url", ""),
                    tags=meta.get("tags", []),
                    rulegraph_data=meta.get("rulegraph_data"),
                )
                self.db_session.add(new_catalog)
                changed = True
            else:
                # Sync metadata to DB
                db_cat.name = meta.get("name", db_cat.name)
                db_cat.tags = meta.get("tags", db_cat.tags)
                db_cat.description = meta.get("description", db_cat.description)
                db_cat.version = meta.get("version", db_cat.version)
                db_cat.owner = meta.get("owner", db_cat.owner)
                # Note: We don't sync 'is_public' or 'owner_id' or 'rulegraph_data' from FS
                # because DB is source of truth for these (refined policy).

        if changed or orphaned_slugs:
            await self.db_session.commit()

        _LAST_SYNC_TIME = now_ts

    async def list_catalogs(
        self,
        search: str | None = None,
        tags: str | None = None,
        user_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        """List all catalogs with optional search/filter and visibility."""
        # No automatic sync here anymore for performance
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

        # FS metadata write
        now = datetime.now(UTC).isoformat()
        metadata = {
            "id": str(new_catalog.id),
            "name": name,
            "slug": slug,
            "description": description,
            "version": "0.1.0",
            "owner": owner,
            "tags": tags or [],
            "is_public": False,
            "source_url": "",
            "created_at": now,
            "updated_at": now,
        }
        _write_metadata(catalog_path, metadata)

        return {
            **metadata,
            "slug": slug,
            "file_count": 1,
            "has_snakefile": True,
        }

    async def get_catalog(self, slug: str) -> dict[str, Any]:
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
        }

    async def update_metadata(self, slug: str, data: dict[str, Any]) -> dict[str, Any]:
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

        # Sync to filesystem
        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug
        if catalog_path.exists():
            meta = _read_metadata(catalog_path)
            for key, value in data.items():
                if key in allowed_keys:
                    meta[key] = value
            _write_metadata(catalog_path, meta)

        # Calculate extra fields for response
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

    async def delete_catalog(self, slug: str) -> None:
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

    async def read_file(self, slug: str, file_path: str) -> dict[str, Any]:
        """Read a file's content from a catalog."""
        full_path = _validate_path(slug, file_path)

        if not full_path.exists() or not full_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        try:
            content = full_path.read_text(errors="replace")
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Error reading file: {e}"
            ) from e

        return {
            "path": file_path,
            "name": full_path.name,
            "content": content,
            "language": _detect_language(file_path),
            "lines": content.count("\n") + 1,
            "size": full_path.stat().st_size,
        }

    async def write_file(
        self, slug: str, file_path: str, content: str
    ) -> dict[str, Any]:
        """Create or update a file in a catalog. Creates parent dirs on demand."""
        full_path = _validate_path(slug, file_path)

        # Ensure parent directory exists (on-demand creation)
        full_path.parent.mkdir(parents=True, exist_ok=True)

        full_path.write_text(content)

        # Update metadata timestamp
        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug
        if catalog_path.exists():
            meta = _read_metadata(catalog_path)
            _write_metadata(catalog_path, meta)

        return await self.read_file(slug, file_path)

    async def delete_file(self, slug: str, file_path: str) -> None:
        """Delete a file from a catalog."""
        full_path = _validate_path(slug, file_path)

        if not full_path.exists() or not full_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        if file_path in ["workflow/Snakefile", "Snakefile"]:
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the mandatory Snakefile",
            )

        full_path.unlink()

        # Update metadata timestamp
        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug
        if catalog_path.exists():
            meta = _read_metadata(catalog_path)
            _write_metadata(catalog_path, meta)

    async def create_directory(self, slug: str, directory_path: str) -> dict[str, str]:
        """Create a new directory in the catalog."""
        full_path = _validate_path(slug, directory_path)
        full_path.mkdir(parents=True, exist_ok=True)
        return {"path": directory_path, "status": "created"}

    async def delete_directory(self, slug: str, directory_path: str) -> None:
        """Delete a directory and all its contents."""
        full_path = _validate_path(slug, directory_path)
        if not full_path.exists() or not full_path.is_dir():
            raise HTTPException(status_code=404, detail="Directory not found")

        # Security: don't allow deleting the catalog root or the mandatory workflow/ dir if it contains Snakefile
        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug
        if full_path == catalog_path.resolve():
            raise HTTPException(status_code=400, detail="Cannot delete catalog root")

        if (full_path / "Snakefile").exists() or (
            full_path / "workflow" / "Snakefile"
        ).exists():
            raise HTTPException(
                status_code=400, detail="Directory contains mandatory Snakefile"
            )

        shutil.rmtree(full_path)

        # Update metadata timestamp
        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug
        if catalog_path.exists():
            meta = _read_metadata(catalog_path)
            _write_metadata(catalog_path, meta)

    async def rename_path(
        self, slug: str, old_path: str, new_path: str
    ) -> dict[str, str]:
        """Rename a file or directory in the catalog."""
        full_old_path = _validate_path(slug, old_path)
        full_new_path = _validate_path(slug, new_path)

        if not full_old_path.exists():
            raise HTTPException(status_code=404, detail="Source path not found")

        if full_new_path.exists():
            raise HTTPException(
                status_code=400, detail="Destination path already exists"
            )

        # Security check: don't allow renaming the mandatory Snakefile (case sensitive)
        if old_path in ["workflow/Snakefile", "Snakefile"]:
            raise HTTPException(
                status_code=400, detail="Cannot rename the mandatory Snakefile"
            )

        # Ensure parent directory for new path exists
        full_new_path.parent.mkdir(parents=True, exist_ok=True)

        full_old_path.rename(full_new_path)

        # Update metadata timestamp
        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug
        meta = _read_metadata(catalog_path)
        _write_metadata(catalog_path, meta)

        return {"status": "renamed", "old_path": old_path, "new_path": new_path}

    def export_archive(self, slug: str) -> BytesIO:
        """Export a catalog as a .tar.gz archive."""
        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug

        if not catalog_path.exists():
            raise HTTPException(status_code=404, detail="Catalog not found")

        buffer = BytesIO()
        with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
            tar.add(str(catalog_path), arcname=slug)
        buffer.seek(0)
        return buffer

    async def import_archive(
        self, file: UploadFile, owner: str = "unknown"
    ) -> dict[str, Any]:
        """Import a catalog from a .tar.gz archive."""
        if not file.filename or not file.filename.endswith((".tar.gz", ".tgz")):
            raise HTTPException(
                status_code=400,
                detail="File must be a .tar.gz or .tgz archive",
            )

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Save and extract
            content = await file.read()
            archive_path = Path(tmp_dir) / "upload.tar.gz"
            archive_path.write_bytes(content)

            with tarfile.open(str(archive_path), "r:gz") as tar:
                # Security: check for path traversal
                for member in tar.getmembers():
                    if member.name.startswith("/") or ".." in member.name:
                        raise HTTPException(
                            status_code=400,
                            detail="Archive contains unsafe paths",
                        )
                tar.extractall(tmp_dir)

            # Find the extracted directory
            extracted_dirs = [
                d
                for d in Path(tmp_dir).iterdir()
                if d.is_dir() and d.name != "__MACOSX"
            ]
            if not extracted_dirs:
                raise HTTPException(
                    status_code=400,
                    detail="Archive is empty",
                )

            extracted = extracted_dirs[0]

            # Validate: must contain workflow/Snakefile or root Snakefile
            snakefile = extracted / "workflow" / "Snakefile"
            if not snakefile.exists():
                snakefile = extracted / "Snakefile"

            if not snakefile.exists():
                raise HTTPException(
                    status_code=400,
                    detail="Archive must contain workflow/Snakefile or root Snakefile",
                )

            # Determine slug
            meta = _read_metadata(extracted)
            slug = meta.get("slug") or _slugify(extracted.name)

            catalog_dir = _get_catalog_dir()
            target = catalog_dir / slug

            if target.exists():
                raise HTTPException(
                    status_code=409,
                    detail=f"Catalog '{slug}' already exists",
                )

            # Move to catalogs directory
            shutil.move(str(extracted), str(target))

            await self._sync_from_filesystem(force=True)
            return await self.get_catalog(slug)

    async def download_catalog(self, slug: str) -> str:
        """Packages the catalog directory into a ZIP and returns the path."""
        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug

        if not catalog_path.exists():
            raise HTTPException(status_code=404, detail="Catalog not found")

        # Create a temporary ZIP file
        temp_dir = tempfile.mkdtemp()
        zip_base = Path(temp_dir) / f"catalog_{slug}"
        zip_path = shutil.make_archive(str(zip_base), "zip", catalog_path)

        return zip_path

    async def sync_catalog(self, slug: str, zip_file_path: str, user: Any):
        """Unpacks a ZIP into the catalog directory and handles Git sync."""
        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug

        if not catalog_path.exists():
            raise HTTPException(status_code=404, detail="Catalog not found")

        # 1. Unpack ZIP
        shutil.unpack_archive(zip_file_path, catalog_path)

        # 2. Update DB/meta synchronization
        await self._sync_from_filesystem(force=True)

        # 3. Check for Git remote
        query = select(Catalog).where(Catalog.slug == slug)
        result = await self.db_session.execute(query)
        catalog = result.scalar_one_or_none()

        if catalog and catalog.source_url:
            try:
                # Use GitService to push changes
                await git_service.push_workflow_changes(
                    local_dir=catalog_path,
                    remote_url=catalog.source_url,
                    # Token should be handled via settings ideally,
                    # but for now we follow the existing pattern in workflows.py
                    commit_message=f"Sync from CLI by user {user.email or user.id}",
                )
            except Exception as e:
                from .. import logger

                logger.error(f"Failed to push catalog to Git: {str(e)}")
                return {"status": "success", "git_sync": "failed", "error": str(e)}

        return {
            "status": "success",
            "git_sync": "success" if catalog and catalog.source_url else "none",
        }

    async def generate_dag(self, slug: str) -> dict[str, Any]:
        """Return cached DAG data from DB. No dynamic generation fallback."""
        query = select(Catalog).where(Catalog.slug == slug)
        result = await self.db_session.execute(query)
        cat = result.scalar_one_or_none()

        if not cat:
            raise HTTPException(status_code=404, detail="Catalog not found")

        if not cat.rulegraph_data:
            return {
                "nodes": [],
                "links": [],
                "error": "No cached DAG data available. Run the workflow at least once to generate the DAG.",
            }

        return cat.rulegraph_data

    async def git_push(
        self,
        remote_url: str | None = None,
        token: str | None = None,
    ) -> dict[str, str]:
        """Push all catalogs to a Git remote (monorepo) using GitHub API."""
        effective_remote = remote_url or settings.CATALOG_GIT_REMOTE
        if not effective_remote:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No Git remote configured. "
                    "Set CATALOG_GIT_REMOTE or provide a remote_url."
                ),
            )

        catalog_dir = _get_catalog_dir()

        try:
            status = git_service.push_catalogs(
                local_dir=catalog_dir,
                remote_url=effective_remote,
                token=token,
            )
            return {"status": status, "remote_url": effective_remote}

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Git push failed: {str(e)}",
            ) from e

    async def git_pull(
        self,
        remote_url: str | None = None,
        token: str | None = None,
    ) -> dict[str, str]:
        """Pull / update catalogs from the configured remote using GitHub API."""
        effective_remote = remote_url or settings.CATALOG_GIT_REMOTE
        if not effective_remote:
            raise HTTPException(
                status_code=400,
                detail="CATALOG_GIT_REMOTE is not configured and no URL provided",
            )

        catalog_dir = _get_catalog_dir()
        try:
            git_service.import_catalogs(
                remote_url=effective_remote,
                target_dir=catalog_dir,
                token=token,
            )
            await self._sync_from_filesystem(force=True)
            return {"status": "pulled successfully"}
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Git pull failed: {e}",
            ) from e

    async def import_from_git(
        self,
        git_url: str,
        token: str | None = None,
        owner: str = "",
        owner_id: uuid.UUID | None = None,
    ) -> list[dict[str, Any]]:
        """Import catalogs from a GitHub repository using GitHub API."""
        catalog_dir = _get_catalog_dir()
        try:
            slugs = git_service.import_catalogs(
                remote_url=git_url,
                target_dir=catalog_dir,
                token=token,
                owner=owner,
            )

            await self._sync_from_filesystem(force=True)

            imported = []
            for slug in slugs:
                # Use get_catalog to fetch from DB and include inventory
                try:
                    cat_detail = await self.get_catalog(slug)
                    imported.append(cat_detail)
                except HTTPException:
                    continue
            return imported
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Failed to import from Git: {str(e)}",
            ) from e
