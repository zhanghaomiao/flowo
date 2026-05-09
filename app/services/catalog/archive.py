import shutil
import tarfile
import tempfile
import uuid
from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select

from app.models import Catalog

from .utils import (
    _read_metadata,
    _slugify,
    assert_catalog_readable,
    assert_catalog_writable,
    catalog_data_dir,
    collect_catalog_files_for_batch_import,
)


def _catalog_root_after_zip_unpack(extract_root: Path) -> Path:
    """If the archive is one top-level folder (no loose files), scan inside it."""
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
        self, catalog_ref: str, user_id: uuid.UUID | None = None
    ) -> tuple[BytesIO, str]:
        """Export a catalog as a .tar.gz archive.

        Returns ``(buffer, disk_slug)`` for attachment filenames (``disk_slug`` is the
        catalog's workspace folder name, not necessarily the same as ``catalog_ref``).
        """
        import json

        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_readable(cat, user_id)
        disk_slug = cat.slug

        catalog_path = catalog_data_dir(cat.owner_id, disk_slug)

        if not catalog_path.exists():
            raise HTTPException(
                status_code=404, detail="Catalog filesystem directory not found"
            )

        # Default .flowoignore content
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
                "resources",
                "output",
                ".pytest_cache",
                "flowo_logs",
            ]
        )

        buffer = BytesIO()
        with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
            tar.add(str(catalog_path), arcname=disk_slug)

            # Inject .flowo.json dynamically
            meta = {
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
            meta_json = json.dumps(meta, indent=2, ensure_ascii=False).encode("utf-8")
            tarinfo_meta = tarfile.TarInfo(name=f"{disk_slug}/.flowo.json")
            tarinfo_meta.size = len(meta_json)
            tar.addfile(tarinfo_meta, BytesIO(meta_json))

            # Inject .flowoignore if not exists
            if not (catalog_path / ".flowoignore").exists():
                ignore_bytes = flowoignore_content.encode("utf-8")
                tarinfo_ignore = tarfile.TarInfo(name=f"{disk_slug}/.flowoignore")
                tarinfo_ignore.size = len(ignore_bytes)
                tar.addfile(tarinfo_ignore, BytesIO(ignore_bytes))

        buffer.seek(0)
        return buffer, disk_slug

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
            content = await file.read()
            archive_path = Path(tmp_dir) / "upload.tar.gz"
            archive_path.write_bytes(content)

            # Extract only under ``unpack/`` so ``upload.tar.gz`` is not a sibling of
            # the catalog folder; otherwise ``_catalog_root_after_zip_unpack`` sees both
            # a file and one directory and wrongly treats ``tmp_dir`` as the catalog root.
            unpack_root = Path(tmp_dir) / "unpack"
            unpack_root.mkdir(parents=True, exist_ok=True)

            with tarfile.open(str(archive_path), "r:gz") as tar:
                for member in tar.getmembers():
                    if member.name.startswith("/") or ".." in member.name:
                        raise HTTPException(
                            status_code=400,
                            detail="Archive contains unsafe paths",
                        )
                tar.extractall(unpack_root)

            extracted = _catalog_root_after_zip_unpack(unpack_root)

            snakefile = extracted / "workflow" / "Snakefile"
            if not snakefile.exists():
                snakefile = extracted / "Snakefile"

            if not snakefile.exists():
                raise HTTPException(
                    status_code=400,
                    detail="Archive must contain workflow/Snakefile or root Snakefile",
                )

            meta = _read_metadata(extracted)
            slug = meta.get("slug") or _slugify(extracted.name)

            target = catalog_data_dir(owner_id, slug)

            if owner_id is not None:
                dup = (
                    await self.db_session.execute(
                        select(Catalog.id).where(
                            Catalog.slug == slug,
                            Catalog.owner_id == owner_id,
                        )
                    )
                ).scalar_one_or_none()
                if dup:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Catalog '{slug}' already exists for this user",
                    )

            if target.exists():
                raise HTTPException(
                    status_code=409,
                    detail=f"Catalog '{slug}' already exists",
                )

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
                # result of batch_import_files is returned via self.get_catalog
                await self.batch_import_files(
                    catalog_ref=str(new_catalog.id),
                    mode="replace",
                    commit_message=f"Import catalog archive: {slug}",
                    files_data=files_data,
                    delete_paths=[],
                    author=owner,
                    user_id=owner_id,
                )

            return await self.get_catalog(str(new_catalog.id), user_id=owner_id)

    async def download_catalog(
        self, catalog_ref: str, user_id: uuid.UUID | None = None
    ) -> tuple[str, str]:
        """Packages the catalog directory into a ZIP.

        Returns ``(zip_path, disk_slug)`` for download filenames.
        """
        import json

        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_readable(cat, user_id)
        disk_slug = cat.slug

        catalog_path = catalog_data_dir(cat.owner_id, disk_slug)

        if not catalog_path.exists():
            raise HTTPException(
                status_code=404, detail="Catalog filesystem directory not found"
            )

        temp_dir = tempfile.mkdtemp()
        tmp_cat_path = Path(temp_dir) / disk_slug
        shutil.copytree(catalog_path, tmp_cat_path)

        meta = {
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
        with open(tmp_cat_path / ".flowo.json", "w") as f:
            json.dump(meta, f, indent=2, ensure_ascii=False)

        # Inject .flowoignore if missing
        flowoignore_path = tmp_cat_path / ".flowoignore"
        if not flowoignore_path.exists():
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
                    "resources",
                    "output",
                    ".pytest_cache",
                    "flowo_logs",
                ]
            )
            flowoignore_path.write_text(flowoignore_content, encoding="utf-8")

        zip_base = Path(temp_dir) / f"catalog_{disk_slug}"
        zip_path = shutil.make_archive(str(zip_base), "zip", tmp_cat_path)

        return zip_path, disk_slug

    async def sync_catalog(
        self,
        catalog_ref: str,
        zip_file_path: str,
        user: Any,
    ):
        """Import from ZIP upload (CLI)."""
        cat = await self._resolve_catalog_ref(catalog_ref, user.id)
        assert_catalog_writable(cat, user.id)

        with tempfile.TemporaryDirectory() as tmp_dir:
            shutil.unpack_archive(zip_file_path, tmp_dir)
            tmp_path = _catalog_root_after_zip_unpack(Path(tmp_dir))

            files_data = collect_catalog_files_for_batch_import(tmp_path)
            author = user.email or str(user.id)

            result = await self.batch_import_files(
                catalog_ref=catalog_ref,
                mode="replace",
                commit_message="Import from CLI upload",
                files_data=files_data,
                delete_paths=[],
                author=author,
                user_id=user.id,
            )

        return result
