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
from app.services.catalog.catalog_storage import (
    build_tar_gz_from_db,
    build_zip_from_db,
    materialize_catalog_workspace,
)

from .utils import (
    _read_metadata,
    _slugify,
    assert_catalog_readable,
    assert_catalog_writable,
    scan_catalog_for_import,
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
        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_readable(cat, user_id)
        return await build_tar_gz_from_db(self.db_session, cat)

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
            else:
                dup_unowned = (
                    await self.db_session.execute(
                        select(Catalog.id).where(
                            Catalog.slug == slug,
                            Catalog.owner_id.is_(None),
                        )
                    )
                ).scalar_one_or_none()
                if dup_unowned:
                    raise HTTPException(
                        status_code=409,
                        detail=f"Catalog '{slug}' already exists",
                    )

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
                workspace_status="stale",
            )
            self.db_session.add(new_catalog)
            await self.db_session.commit()
            await self.db_session.refresh(new_catalog)

            text_files, bin_files = scan_catalog_for_import(extracted)
            if text_files or bin_files:
                await self.batch_import_files(
                    catalog_ref=str(new_catalog.id),
                    mode="replace",
                    commit_message=f"Import catalog archive: {slug}",
                    files_data=text_files,
                    delete_paths=[],
                    author=owner,
                    user_id=owner_id,
                    binaries=bin_files if bin_files else None,
                )

            await self.db_session.refresh(new_catalog)
            await materialize_catalog_workspace(self.db_session, new_catalog)
            await self.db_session.commit()

            return await self.get_catalog(str(new_catalog.id), user_id=owner_id)

    async def download_catalog(
        self, catalog_ref: str, user_id: uuid.UUID | None = None
    ) -> tuple[str, str]:
        """Packages the catalog directory into a ZIP.

        Returns ``(zip_path, disk_slug)`` for download filenames.
        """
        cat = await self._resolve_catalog_ref(catalog_ref, user_id)
        assert_catalog_readable(cat, user_id)
        return await build_zip_from_db(self.db_session, cat)

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

            text_files, bin_files = scan_catalog_for_import(tmp_path)
            author = user.email or str(user.id)

            result = await self.batch_import_files(
                catalog_ref=catalog_ref,
                mode="replace",
                commit_message="Import from CLI upload",
                files_data=text_files,
                delete_paths=[],
                author=author,
                user_id=user.id,
                binaries=bin_files if bin_files else None,
            )
            cat = await self._resolve_catalog_ref(catalog_ref, user.id)
            await materialize_catalog_workspace(self.db_session, cat)
            await self.db_session.commit()

        return result
