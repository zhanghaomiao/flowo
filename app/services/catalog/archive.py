import shutil
import tarfile
import tempfile
import uuid
from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from .sync import sync_catalog_with_git
from .utils import _get_catalog_dir, _read_metadata, _slugify


class CatalogArchiveMixin:
    async def export_archive(self, slug: str) -> BytesIO:
        """Export a catalog as a .tar.gz archive."""
        import json

        from sqlalchemy import select

        from app.models import Catalog

        query = select(Catalog).where(Catalog.slug == slug)
        result = await self.db_session.execute(query)
        cat = result.scalar_one_or_none()

        if not cat:
            raise HTTPException(status_code=404, detail="Catalog not found")

        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug

        if not catalog_path.exists():
            raise HTTPException(
                status_code=404, detail="Catalog filesystem directory not found"
            )

        buffer = BytesIO()
        with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
            tar.add(str(catalog_path), arcname=slug)

            # Inject .flowo.json dynamically
            meta = {
                "id": str(cat.id),
                "name": cat.name,
                "slug": slug,
                "description": cat.description,
                "version": cat.version,
                "owner": cat.owner,
                "tags": cat.tags,
                "is_public": cat.is_public,
                "source_url": cat.source_url,
                "created_at": cat.created_at.isoformat(),
                "updated_at": cat.updated_at.isoformat(),
            }
            meta_json = json.dumps(meta, indent=2, ensure_ascii=False).encode("utf-8")
            tarinfo = tarfile.TarInfo(name=f"{slug}/.flowo.json")
            tarinfo.size = len(meta_json)
            tar.addfile(tarinfo, BytesIO(meta_json))

        buffer.seek(0)
        return buffer

    async def import_archive(
        self,
        file: Any,  # UploadFile from FastAPI
        owner: str = "unknown",
        owner_id: uuid.UUID | None = None,
        background_tasks: Any | None = None,
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

            if background_tasks:
                from app.core.session import AsyncSessionLocal

                background_tasks.add_task(
                    sync_catalog_with_git,
                    catalog_dir=catalog_dir,
                    user_id=owner_id,
                    session_factory=AsyncSessionLocal,
                    commit_message=f"Import catalog archive: {slug}",
                )

            return await self.get_catalog(slug)

    async def download_catalog(self, slug: str) -> str:
        """Packages the catalog directory into a ZIP and returns the path."""
        import json

        from sqlalchemy import select

        from app.models import Catalog

        query = select(Catalog).where(Catalog.slug == slug)
        result = await self.db_session.execute(query)
        cat = result.scalar_one_or_none()

        if not cat:
            raise HTTPException(status_code=404, detail="Catalog not found")

        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug

        if not catalog_path.exists():
            raise HTTPException(
                status_code=404, detail="Catalog filesystem directory not found"
            )

        # Create a temporary ZIP file via a temp directory
        temp_dir = tempfile.mkdtemp()
        tmp_cat_path = Path(temp_dir) / slug
        shutil.copytree(catalog_path, tmp_cat_path)

        # Inject .flowo.json dynamically
        meta = {
            "id": str(cat.id),
            "name": cat.name,
            "slug": slug,
            "description": cat.description,
            "version": cat.version,
            "owner": cat.owner,
            "tags": cat.tags,
            "is_public": cat.is_public,
            "source_url": cat.source_url,
            "created_at": cat.created_at.isoformat(),
            "updated_at": cat.updated_at.isoformat(),
        }
        with open(tmp_cat_path / ".flowo.json", "w") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)

        zip_base = Path(temp_dir) / f"catalog_{slug}"
        zip_path = shutil.make_archive(str(zip_base), "zip", tmp_cat_path)

        return zip_path

    async def sync_catalog(
        self,
        slug: str,
        zip_file_path: str,
        user: Any,
        background_tasks: Any | None = None,
    ):
        """Unpacks a ZIP into the catalog directory and updates the local filesystem."""
        catalog_dir = _get_catalog_dir()
        catalog_path = catalog_dir / slug

        if not catalog_path.exists():
            catalog_path.mkdir(parents=True, exist_ok=True)

        # 1. Unpack ZIP
        shutil.unpack_archive(zip_file_path, catalog_path)

        # 2. Update DB/meta synchronization
        await self._sync_from_filesystem(force=True)

        if background_tasks:
            from app.core.session import AsyncSessionLocal

            background_tasks.add_task(
                sync_catalog_with_git,
                catalog_dir=catalog_dir,
                user_id=user.id,
                session_factory=AsyncSessionLocal,
                commit_message=f"Sync catalog from CLI: {slug}",
            )

        return {
            "status": "success",
            "git_sync": "backgrounded",
        }
