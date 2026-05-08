import shutil
import tarfile
import tempfile
import uuid
from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from app.models import Catalog

from .access import assert_catalog_readable, assert_catalog_writable
from .paths import catalog_data_dir
from .utils import (
    _read_metadata,
    _slugify,
    collect_catalog_files_for_batch_import,
)


def _catalog_root_after_zip_unpack(extract_root: Path) -> Path:
    """If the archive is one top-level folder (no loose files), scan inside it.

    Matches common zip layouts (``slug/README.md``) so paths align with the DB
    (``README.md``). Flat archives (files directly under the extract dir) are unchanged.
    """
    # Ignore __MACOSX and hidden dot-files/dirs (like .flowo.json or .DS_Store) when detecting root.
    entries = [
        p
        for p in extract_root.iterdir()
        if p.name != "__MACOSX" and not p.name.startswith(".")
    ]
    dirs = [p for p in entries if p.is_dir()]
    files = [p for p in entries if p.is_file()]
    if len(dirs) == 1 and not files:
        return dirs[0]
    return extract_root


class CatalogArchiveMixin:
    async def export_archive(
        self, slug: str, user_id: uuid.UUID | None = None
    ) -> BytesIO:
        """Export a catalog as a .tar.gz archive."""
        import json

        from sqlalchemy import select

        query = select(Catalog).where(Catalog.slug == slug)
        result = await self.db_session.execute(query)
        cat = result.scalar_one_or_none()

        if not cat:
            raise HTTPException(status_code=404, detail="Catalog not found")

        assert_catalog_readable(cat, user_id)

        catalog_path = catalog_data_dir(cat.owner_id, slug)

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

            extracted = _catalog_root_after_zip_unpack(Path(tmp_dir))

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

            target = catalog_data_dir(owner_id, slug)

            if target.exists():
                raise HTTPException(
                    status_code=409,
                    detail=f"Catalog '{slug}' already exists",
                )

            # Move to catalogs directory
            shutil.move(str(extracted), str(target))

            name = meta.get("name") or slug.replace("-", " ").title()
            description = meta.get("description") or ""
            version = meta.get("version") or "0.1.0"
            tags = meta.get("tags") or []

            new_catalog = Catalog(
                slug=slug,
                name=name,
                description=description,
                version=version,
                owner=owner,
                owner_id=owner_id,
                tags=tags,
                is_public=bool(meta.get("is_public", False)),
                source_url=meta.get("source_url"),
            )
            self.db_session.add(new_catalog)
            await self.db_session.commit()
            await self.db_session.refresh(new_catalog)

            files_data = collect_catalog_files_for_batch_import(target)
            if files_data:
                await self.batch_import_files(
                    slug=slug,
                    mode="replace",
                    commit_message=f"Import catalog archive: {slug}",
                    files_data=files_data,
                    delete_paths=[],
                    author=owner,
                    user_id=owner_id,
                )

            return await self.get_catalog(slug, user_id=owner_id)

    async def download_catalog(
        self, slug: str, user_id: uuid.UUID | None = None
    ) -> str:
        """Packages the catalog directory into a ZIP and returns the path."""
        import json

        from sqlalchemy import select

        query = select(Catalog).where(Catalog.slug == slug)
        result = await self.db_session.execute(query)
        cat = result.scalar_one_or_none()

        if not cat:
            raise HTTPException(status_code=404, detail="Catalog not found")

        assert_catalog_readable(cat, user_id)

        catalog_path = catalog_data_dir(cat.owner_id, slug)

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
    ):
        """从 ZIP 导入 catalog 到数据库（原子性批量导入）"""
        import tempfile

        cat = await self._get_catalog_or_404(slug)
        assert_catalog_writable(cat, user.id)

        # 1. 解压 ZIP 到临时目录
        with tempfile.TemporaryDirectory() as tmp_dir:
            shutil.unpack_archive(zip_file_path, tmp_dir)
            tmp_path = _catalog_root_after_zip_unpack(Path(tmp_dir))

            files_data = collect_catalog_files_for_batch_import(tmp_path)
            author = user.email or str(user.id)

            # 2. 使用批量导入 API（原子性，自动导出到文件系统）
            result = await self.batch_import_files(
                slug=slug,
                mode="replace",
                commit_message="Import from CLI upload",
                files_data=files_data,
                delete_paths=[],
                author=author,
                user_id=user.id,
            )

        return result
