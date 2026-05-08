import hashlib
import shutil
import uuid
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select

from app.models.catalog_file import CatalogFile, CatalogFileVersion

from .access import assert_catalog_readable, assert_catalog_writable
from .paths import catalog_data_dir, catalog_export_dir
from .utils import _detect_language, _validate_path


class CatalogFilesMixin:
    async def export_catalog_to_fs(
        self, slug: str, user_id: uuid.UUID | None
    ) -> dict[str, Any]:
        """
        Export all files of a catalog from DB to the filesystem export cache.

        Ensures ``CATALOG_EXPORT_DIR/<owner_segment>/<slug>`` exists for downstream tools
        (e.g. snakemake/snakevision DAG generation).
        """
        cat = await self._get_catalog_or_404(slug)
        assert_catalog_readable(cat, user_id)

        root = catalog_export_dir(cat.owner_id, slug)
        root.mkdir(parents=True, exist_ok=True)
        query = select(CatalogFile).where(CatalogFile.catalog_slug == slug)
        result = await self.db_session.execute(query)
        files = list(result.scalars().all())

        if files:
            for f in files:
                await self._export_to_filesystem(cat.owner_id, slug, f.path, f.content)
            return {
                "status": "exported",
                "slug": slug,
                "export_root": str(root),
                "source": "db",
                "files_exported": len(files),
            }

        data_dir = catalog_data_dir(cat.owner_id, slug)
        if data_dir.exists() and data_dir.is_dir():
            shutil.copytree(
                data_dir,
                root,
                dirs_exist_ok=True,
                ignore=shutil.ignore_patterns(".git"),
            )
            return {
                "status": "exported",
                "slug": slug,
                "export_root": str(root),
                "source": "filesystem",
            }

        return {"status": "noop", "slug": slug, "export_root": str(root)}

    async def _catalog_file_count_in_db(self, slug: str) -> int:
        r = await self.db_session.execute(
            select(CatalogFile.id).where(CatalogFile.catalog_slug == slug)
        )
        return len(r.all())

    async def hydrate_catalog_workspace_from_db(self, slug: str) -> None:
        """Materialize all ``CatalogFile`` rows under ``catalog_data_dir`` (editor / inventory)."""
        cat = await self._get_catalog_or_404(slug)
        root = catalog_data_dir(cat.owner_id, slug)
        result = await self.db_session.execute(
            select(CatalogFile).where(CatalogFile.catalog_slug == slug)
        )
        for f in result.scalars().all():
            dest = root / f.path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(f.content, encoding="utf-8")

    async def _export_to_filesystem(
        self,
        owner_id: uuid.UUID | None,
        slug: str,
        file_path: str,
        content: str,
    ) -> None:
        export_path = catalog_export_dir(owner_id, slug) / file_path
        export_path.parent.mkdir(parents=True, exist_ok=True)
        export_path.write_text(content)

    async def read_file(
        self, slug: str, file_path: str, user_id: uuid.UUID | None
    ) -> dict[str, Any]:
        cat = await self._get_catalog_or_404(slug)
        assert_catalog_readable(cat, user_id)

        query = select(CatalogFile).where(
            CatalogFile.catalog_slug == slug,
            CatalogFile.path == file_path,
        )
        result = await self.db_session.execute(query)
        file = result.scalar_one_or_none()

        if not file:
            full_path = _validate_path(cat.owner_id, slug, file_path)
            if full_path.exists() and full_path.is_file():
                content = full_path.read_text(errors="replace")
                return {
                    "path": file_path,
                    "name": full_path.name,
                    "content": content,
                    "language": _detect_language(file_path),
                    "lines": content.count("\n") + 1,
                    "size": full_path.stat().st_size,
                }
            raise HTTPException(status_code=404, detail="File not found")

        return {
            "path": file.path,
            "name": Path(file.path).name,
            "content": file.content,
            "language": file.language,
            "lines": file.lines,
            "size": file.size,
            "version": file.current_version,
        }

    async def write_file(
        self,
        slug: str,
        file_path: str,
        content: str,
        author: str = "system",
        message: str = "",
        user_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        cat = await self._get_catalog_or_404(slug)
        assert_catalog_writable(cat, user_id)

        content_bytes = content.encode("utf-8")
        content_sha256 = hashlib.sha256(content_bytes).hexdigest()

        query = select(CatalogFile).where(
            CatalogFile.catalog_slug == slug,
            CatalogFile.path == file_path,
        )
        result = await self.db_session.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            if existing.content_sha256 == content_sha256:
                return await self.read_file(slug, file_path, user_id)

            new_version = existing.current_version + 1
            version = CatalogFileVersion(
                file_id=existing.id,
                version=new_version,
                content=existing.content,
                content_sha256=existing.content_sha256,
                created_by=existing.last_modified_by,
            )
            self.db_session.add(version)

            existing.content = content
            existing.content_sha256 = content_sha256
            existing.size = len(content_bytes)
            existing.lines = content.count("\n") + 1
            existing.last_modified_by = author
            existing.current_version = new_version

            await self.db_session.commit()

            await self._export_to_filesystem(cat.owner_id, slug, file_path, content)

            return await self.read_file(slug, file_path, user_id)

        new_file = CatalogFile(
            catalog_slug=slug,
            path=file_path,
            content=content,
            content_sha256=content_sha256,
            size=len(content_bytes),
            lines=content.count("\n") + 1,
            language=_detect_language(file_path),
            created_by=author,
            last_modified_by=author,
        )
        self.db_session.add(new_file)
        await self.db_session.flush()

        version = CatalogFileVersion(
            file_id=new_file.id,
            version=1,
            content=content,
            content_sha256=content_sha256,
            created_by=author,
            message=message or "Initial version",
        )
        self.db_session.add(version)

        await self.db_session.commit()

        await self._export_to_filesystem(cat.owner_id, slug, file_path, content)

        return await self.read_file(slug, file_path, user_id)

    async def delete_file(
        self, slug: str, file_path: str, user_id: uuid.UUID | None
    ) -> None:
        cat = await self._get_catalog_or_404(slug)
        assert_catalog_writable(cat, user_id)

        query = select(CatalogFile).where(
            CatalogFile.catalog_slug == slug,
            CatalogFile.path == file_path,
        )
        result = await self.db_session.execute(query)
        file = result.scalar_one_or_none()

        if file:
            await self.db_session.delete(file)
            await self.db_session.commit()

            export_path = catalog_export_dir(cat.owner_id, slug) / file_path
            if export_path.exists():
                export_path.unlink()

        full_path = _validate_path(cat.owner_id, slug, file_path)
        if full_path.exists() and full_path.is_file():
            full_path.unlink()

    async def create_directory(
        self,
        slug: str,
        directory_path: str,
        user_id: uuid.UUID | None,
    ) -> dict[str, str]:
        cat = await self._get_catalog_or_404(slug)
        assert_catalog_writable(cat, user_id)

        full_path = _validate_path(cat.owner_id, slug, directory_path)
        full_path.mkdir(parents=True, exist_ok=True)

        export_path = catalog_export_dir(cat.owner_id, slug) / directory_path
        export_path.mkdir(parents=True, exist_ok=True)

        return {"path": directory_path, "status": "created"}

    async def delete_directory(
        self,
        slug: str,
        directory_path: str,
        user_id: uuid.UUID | None,
    ) -> None:
        cat = await self._get_catalog_or_404(slug)
        assert_catalog_writable(cat, user_id)

        full_path = _validate_path(cat.owner_id, slug, directory_path)
        if not full_path.exists() or not full_path.is_dir():
            raise HTTPException(status_code=404, detail="Directory not found")

        catalog_path = catalog_data_dir(cat.owner_id, slug)
        if full_path == catalog_path.resolve():
            raise HTTPException(status_code=400, detail="Cannot delete catalog root")

        if (full_path / "Snakefile").exists() or (
            full_path / "workflow" / "Snakefile"
        ).exists():
            raise HTTPException(
                status_code=400, detail="Directory contains mandatory Snakefile"
            )

        shutil.rmtree(full_path)

        export_path = catalog_export_dir(cat.owner_id, slug) / directory_path
        if export_path.exists() and export_path.is_dir():
            shutil.rmtree(export_path)

    async def rename_path(
        self,
        slug: str,
        old_path: str,
        new_path: str,
        user_id: uuid.UUID | None,
    ) -> dict[str, str]:
        cat = await self._get_catalog_or_404(slug)
        assert_catalog_writable(cat, user_id)

        query = select(CatalogFile).where(
            CatalogFile.catalog_slug == slug,
            CatalogFile.path == old_path,
        )
        result = await self.db_session.execute(query)
        file = result.scalar_one_or_none()

        if file:
            file.path = new_path
            await self.db_session.commit()

        full_old_path = _validate_path(cat.owner_id, slug, old_path)
        full_new_path = _validate_path(cat.owner_id, slug, new_path)

        if not full_old_path.exists():
            raise HTTPException(status_code=404, detail="Source path not found")

        if full_new_path.exists():
            raise HTTPException(
                status_code=400, detail="Destination path already exists"
            )

        if old_path in ["workflow/Snakefile", "Snakefile"]:
            raise HTTPException(
                status_code=400, detail="Cannot rename the mandatory Snakefile"
            )

        full_new_path.parent.mkdir(parents=True, exist_ok=True)
        full_old_path.rename(full_new_path)

        export_old_path = catalog_export_dir(cat.owner_id, slug) / old_path
        export_new_path = catalog_export_dir(cat.owner_id, slug) / new_path
        if export_old_path.exists():
            export_new_path.parent.mkdir(parents=True, exist_ok=True)
            export_old_path.rename(export_new_path)

        return {"status": "renamed", "old_path": old_path, "new_path": new_path}

    async def _export_catalog_to_filesystem(
        self, owner_id: uuid.UUID | None, slug: str
    ) -> None:
        query = select(CatalogFile).where(CatalogFile.catalog_slug == slug)
        result = await self.db_session.execute(query)
        files = result.scalars().all()

        for file in files:
            await self._export_to_filesystem(owner_id, slug, file.path, file.content)

    async def _get_all_catalog_files(self, slug: str) -> list:
        query = select(CatalogFile).where(CatalogFile.catalog_slug == slug)
        result = await self.db_session.execute(query)
        return list(result.scalars().all())

    async def _prepare_import_operations(
        self,
        slug: str,
        mode: str,
        files_data: list[dict],
        delete_paths: list[str],
    ) -> list[dict]:
        operations = []

        existing_files = await self._get_all_catalog_files(slug)
        existing_map = {f.path: f for f in existing_files}

        # 1. Deletions
        actual_delete_paths = set(delete_paths)
        if mode == "replace":
            incoming_paths = {f["path"] for f in files_data}
            missing_paths = set(existing_map.keys()) - incoming_paths
            actual_delete_paths |= missing_paths

        for path in actual_delete_paths:
            if path in existing_map:
                operations.append(
                    {
                        "action": "delete",
                        "path": path,
                    }
                )

        for file_data in files_data:
            path = file_data["path"]
            new_sha256 = file_data["sha256"]

            if path not in existing_map:
                operations.append(
                    {
                        "action": "add",
                        **file_data,
                    }
                )
            else:
                existing_file = existing_map[path]
                # merge: unchanged bytes → no-op; changed → conflict for caller to resolve
                if mode == "merge":
                    if existing_file.content_sha256 == new_sha256:
                        operations.append(
                            {
                                "action": "skip",
                                "path": path,
                            }
                        )
                    else:
                        operations.append(
                            {
                                "action": "conflict",
                                "path": path,
                                "local_version": existing_file.current_version,
                                "local_sha256": existing_file.content_sha256,
                                "remote_sha256": new_sha256,
                            }
                        )
                else:
                    # replace (CLI sync, archive import, etc.): overwrite if changed, skip if same
                    if existing_file.content_sha256 == new_sha256:
                        operations.append(
                            {
                                "action": "skip",
                                "path": path,
                            }
                        )
                    else:
                        operations.append(
                            {
                                "action": "modify",
                                **file_data,
                            }
                        )

        return operations

    async def _execute_delete(self, slug: str, path: str):
        query = select(CatalogFile).where(
            CatalogFile.catalog_slug == slug,
            CatalogFile.path == path,
        )
        result = await self.db_session.execute(query)
        file = result.scalar_one_or_none()
        if file:
            await self.db_session.delete(file)

    async def _execute_add(self, slug: str, op: dict, author: str, batch_id: str):
        content_bytes = op["content"].encode("utf-8")

        new_file = CatalogFile(
            catalog_slug=slug,
            path=op["path"],
            content=op["content"],
            content_sha256=op["sha256"],
            size=op.get("size", len(content_bytes)),
            lines=op.get("lines", op["content"].count("\n") + 1),
            language=op.get("language") or _detect_language(op["path"]),
            created_by=author,
            last_modified_by=author,
            batch_id=batch_id,
        )
        self.db_session.add(new_file)
        await self.db_session.flush()

        version = CatalogFileVersion(
            file_id=new_file.id,
            version=1,
            content=op["content"],
            content_sha256=op["sha256"],
            created_by=author,
        )
        self.db_session.add(version)

    async def _execute_modify(self, slug: str, op: dict, author: str, batch_id: str):
        query = select(CatalogFile).where(
            CatalogFile.catalog_slug == slug,
            CatalogFile.path == op["path"],
        )
        result = await self.db_session.execute(query)
        existing = result.scalar_one_or_none()

        if existing:
            new_version = existing.current_version + 1
            version = CatalogFileVersion(
                file_id=existing.id,
                version=new_version,
                content=existing.content,
                content_sha256=existing.content_sha256,
                created_by=existing.last_modified_by,
            )
            self.db_session.add(version)

            existing.content = op["content"]
            existing.content_sha256 = op["sha256"]
            existing.size = op.get("size", len(op["content"].encode("utf-8")))
            existing.lines = op.get("lines", op["content"].count("\n") + 1)
            existing.last_modified_by = author
            existing.current_version = new_version
            existing.batch_id = batch_id

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
        """Atomic batch file import."""
        from datetime import UTC, datetime

        from app.models.batch_import import BatchImport

        if delete_paths is None:
            delete_paths = []

        cat = await self._get_catalog_or_404(slug)
        assert_catalog_writable(cat, user_id)

        operations = await self._prepare_import_operations(
            slug=slug,
            mode=mode,
            files_data=files_data,
            delete_paths=delete_paths,
        )

        conflicts = [op for op in operations if op["action"] == "conflict"]
        if conflicts and mode == "merge":
            return {
                "status": "conflicts_found",
                "conflicts": conflicts,
            }

        batch_id = uuid.uuid4()

        try:
            # Use begin_nested to support cases where a transaction is already begun (e.g. by previous queries)
            async with self.db_session.begin_nested():
                batch_record = BatchImport(
                    id=batch_id,
                    catalog_slug=slug,
                    mode=mode,
                    commit_message=commit_message,
                    created_by=author,
                    status="in_progress",
                )
                self.db_session.add(batch_record)

                summary = {
                    "added": 0,
                    "modified": 0,
                    "deleted": 0,
                    "skipped": 0,
                    "conflicts": len(conflicts),
                }

                for op in operations:
                    if op["action"] == "delete":
                        await self._execute_delete(slug, op["path"])
                        summary["deleted"] += 1
                    elif op["action"] == "add":
                        await self._execute_add(slug, op, author, batch_id)
                        summary["added"] += 1
                    elif op["action"] == "modify":
                        await self._execute_modify(slug, op, author, batch_id)
                        summary["modified"] += 1
                    elif op["action"] == "skip":
                        summary["skipped"] += 1

                batch_record.status = "completed"
                batch_record.summary = summary
                batch_record.completed_at = datetime.now(UTC)

            # Export is done outside the inner transaction
            await self._export_catalog_to_filesystem(cat.owner_id, slug)

            return {
                "status": "completed",
                "batch_id": str(batch_id),
                "summary": summary,
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
            }

    async def catalog_export_paths_for_dag(
        self, slug: str, user_id: uuid.UUID
    ) -> tuple[uuid.UUID | None, Path]:
        """Resolve export root after auth; used for DAG SVG paths."""
        cat = await self._get_catalog_or_404(slug)
        assert_catalog_readable(cat, user_id)
        return cat.owner_id, catalog_export_dir(cat.owner_id, slug)
