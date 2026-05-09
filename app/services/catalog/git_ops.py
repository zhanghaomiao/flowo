import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select

from app.core.config import settings
from app.models import Catalog

from ..third_party.git import git_service
from .sync import sync_catalog_with_git
from .utils import (
    _get_catalog_dir,
    catalog_data_dir,
    collect_catalog_files_for_batch_import,
)


class CatalogGitMixin:
    async def git_push(
        self,
        user_id: uuid.UUID,
        background_tasks: Any,
        remote_url: str | None = None,
        token: str | None = None,
    ) -> dict[str, str]:
        """Trigger a manual Git push via background task."""
        from app.core.session import AsyncSessionLocal

        catalog_dir = _get_catalog_dir()
        run_id = str(uuid.uuid4())

        background_tasks.add_task(
            sync_catalog_with_git,
            catalog_dir=catalog_dir,
            user_id=user_id,
            session_factory=AsyncSessionLocal,
            commit_message="Manual Git push trigger",
            run_id=run_id,
        )
        return {"status": "backgrounded", "run_id": run_id}

    async def git_pull(
        self,
        user_id: uuid.UUID,  # noqa: ARG002
        remote_url: str | None = None,
        token: str | None = None,
    ) -> dict[str, Any]:
        """Pull from Git to the catalog directory and sync imported files into the database."""

        catalog_dir = _get_catalog_dir()
        imported_relpaths = git_service.import_catalogs(
            target_dir=catalog_dir,
            remote_url=remote_url,
            token=token,
            layout_owner_id=user_id,
        )

        results: dict[str, Any] = {"updated": [], "conflicts": {}}
        for rel in imported_relpaths:
            candidate = catalog_dir / rel
            if candidate.exists():
                catalog_path = candidate
            else:
                catalog_path = catalog_data_dir(user_id, rel)
            if not catalog_path.exists():
                continue

            slug = git_service._get_slug(catalog_path, rel, "")

            files_data = collect_catalog_files_for_batch_import(catalog_path)
            if files_data:
                res = await self.batch_import_files(
                    slug=slug,
                    # Safer default: detect conflicts instead of overwriting local edits.
                    mode="merge",
                    commit_message="Git pull sync",
                    files_data=files_data,
                    delete_paths=[],
                    author="system",
                    user_id=user_id,
                )
                if res.get("status") == "conflicts_found":
                    results["conflicts"][slug] = res.get("conflicts", [])
                else:
                    results["updated"].append(slug)

        if results["conflicts"]:
            return {"status": "conflicts_found", **results}
        return {"status": "completed", **results}

    async def import_from_git(
        self,
        git_url: str,
        user_id: uuid.UUID,
        token: str | None = None,
        owner: str = "",
        owner_id: uuid.UUID | None = None,
        subdirectory: str | None = None,
        confirm_overwrite: bool = False,
        target_slug: str | None = None,
    ) -> dict[str, Any]:
        """Clone a Git repository to disk and import catalogs into the database."""
        catalog_dir = _get_catalog_dir()
        owner_for_layout = owner_id or user_id
        incoming = git_url.strip()
        mono = (settings.CATALOG_GIT_REMOTE or "").strip()
        slug_override = target_slug.strip() if target_slug else None

        if not mono or incoming != mono:
            planned = git_service.peek_external_catalog_slugs(
                incoming,
                token=token,
                branch="main",
                subdirectory=subdirectory,
                root_slug_override=slug_override,
            )
            for s in planned:
                result = await self.db_session.execute(
                    select(Catalog).where(Catalog.slug == s)
                )
                existing = result.scalar_one_or_none()
                if existing:
                    old = (existing.source_url or "").strip()
                    if old != incoming and not confirm_overwrite:
                        raise HTTPException(
                            status_code=409,
                            detail={
                                "code": "slug_collision",
                                "slug": s,
                                "existing_source_url": existing.source_url,
                                "incoming_git_url": incoming,
                            },
                        )

        imported_slugs = git_service.import_catalogs(
            target_dir=catalog_dir,
            remote_url=git_url,
            token=token,
            owner=owner,
            subdirectory=subdirectory,
            layout_owner_id=owner_for_layout,
            root_slug_override=slug_override,
        )

        for slug in imported_slugs:
            catalog_path = catalog_data_dir(owner_for_layout, slug)
            if not catalog_path.exists():
                continue

            query = select(Catalog).where(Catalog.slug == slug)
            result = await self.db_session.execute(query)
            cat = result.scalar_one_or_none()

            if not cat:
                cat = Catalog(
                    slug=slug,
                    name=slug.replace("-", " ").title(),
                    description=f"Imported from {git_url}",
                    version="0.1.0",
                    owner=owner,
                    owner_id=owner_id or user_id,
                    source_url=git_url,
                    tags=["git-import"],
                )
                self.db_session.add(cat)
                await self.db_session.commit()
            else:
                cat.source_url = git_url
                if owner_id:
                    cat.owner_id = owner_id
                await self.db_session.commit()

            files_data = collect_catalog_files_for_batch_import(catalog_path)
            if files_data:
                await self.batch_import_files(
                    slug=slug,
                    mode="replace",
                    commit_message=f"Import from Git: {git_url}",
                    files_data=files_data,
                    delete_paths=[],
                    author=owner,
                    user_id=user_id,
                )

        return {"status": "completed", "imported_slugs": list(imported_slugs)}
