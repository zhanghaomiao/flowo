import logging
import uuid
from pathlib import Path

from sqlalchemy import select

from ...core.config import settings
from ...models import UserSettings
from ..third_party.git import git_service

logger = logging.getLogger(__name__)


async def sync_catalog_with_git(
    catalog_dir: Path,
    user_id: uuid.UUID | None,
    session_factory,  # Use a factory or provide an active session
    commit_message: str = "Catalog sync",
):
    """
    Modularized background task for Git synchronization.
    If Git is configured (globally or for the user), performs a push to the monorepo.
    """
    try:
        # Check global config first
        if settings.CATALOG_GIT_REMOTE:
            git_service.push_to_monorepo(catalog_dir, commit_message=commit_message)
            return

        if not user_id:
            return

        # Check user-specific config
        async with session_factory() as session:
            result = await session.execute(
                select(UserSettings).where(UserSettings.user_id == user_id)
            )
            user_settings = result.scalar_one_or_none()

            if user_settings and user_settings.git_remote_url:
                git_service.push_to_monorepo(
                    catalog_dir,
                    remote_url=user_settings.git_remote_url,
                    token=user_settings.git_token,
                    commit_message=commit_message,
                )
    except Exception as e:
        logger.error(f"Background Git sync failed: {e}")
