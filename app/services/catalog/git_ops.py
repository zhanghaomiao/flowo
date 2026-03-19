import uuid
from typing import Any

from ..third_party.git import git_service
from .sync import sync_catalog_with_git
from .utils import _get_catalog_dir


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

        background_tasks.add_task(
            sync_catalog_with_git,
            catalog_dir=catalog_dir,
            user_id=user_id,
            session_factory=AsyncSessionLocal,
            commit_message="Manual Git push trigger",
        )
        return {"status": "backgrounded"}

    async def git_pull(
        self,
        user_id: uuid.UUID,
        background_tasks: Any,
        remote_url: str | None = None,
        token: str | None = None,
    ) -> dict[str, str]:
        """Pull / update catalogs via background task."""

        async def pull_task():
            from app.core.session import AsyncSessionLocal

            catalog_dir = _get_catalog_dir()
            try:
                git_service.import_catalogs(
                    target_dir=catalog_dir,
                    remote_url=remote_url,
                    token=token,
                )
                # Note: We need a session here to sync catalogs
                async with AsyncSessionLocal() as session:
                    from .service import CatalogService

                    svc = CatalogService(session)
                    await svc._sync_from_filesystem(force=True)
            except Exception as e:
                import logging

                logging.getLogger(__name__).error(f"Git pull task failed: {e}")

        background_tasks.add_task(pull_task)
        return {"status": "backgrounded"}

    async def import_from_git(
        self,
        git_url: str,
        user_id: uuid.UUID,
        background_tasks: Any,
        token: str | None = None,
        owner: str = "",
    ) -> dict[str, str]:
        """Import catalogs from a Git repository via background task."""

        async def import_task():
            from app.core.session import AsyncSessionLocal

            catalog_dir = _get_catalog_dir()
            try:
                imported_slugs = git_service.import_catalogs(
                    target_dir=catalog_dir,
                    remote_url=git_url,
                    token=token,
                    owner=owner,
                )
                async with AsyncSessionLocal() as session:
                    from .service import CatalogService

                    svc = CatalogService(session)
                    await svc._sync_from_filesystem(force=True)

                    if imported_slugs:
                        from sqlalchemy import select

                        from app.models import Catalog

                        from .utils import _read_metadata, _write_metadata

                        query = select(Catalog).where(Catalog.slug.in_(imported_slugs))
                        result = await session.execute(query)
                        cats = result.scalars().all()

                        for cat in cats:
                            cat.source_url = git_url

                            # Also update the filesystem to match the DB
                            catalog_path = catalog_dir / cat.slug
                            if catalog_path.exists():
                                meta = _read_metadata(catalog_path)
                                meta["source_url"] = git_url
                                _write_metadata(catalog_path, meta)

                        await session.commit()
            except Exception as e:
                import logging

                logging.getLogger(__name__).error(f"Git import task failed: {e}")

        background_tasks.add_task(import_task)
        return {"status": "backgrounded"}
