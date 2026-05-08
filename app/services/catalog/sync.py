import logging
import uuid
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select

from ...core.config import settings
from ...models import Catalog, CatalogFile, UserSettings
from ..third_party.git import git_service
from .paths import catalog_data_dir, catalog_owner_workspace_root

logger = logging.getLogger(__name__)


async def _export_db_to_catalog_dir(
    _catalog_dir: Path,
    session,
    *,
    owner_id: uuid.UUID | None = None,
) -> int:
    """Export catalog files from DB to ``catalog_data_dir`` trees on disk.

    When ``owner_id`` is set, only that owner's catalogs are exported (for per-user
    Git backup). Otherwise exports all catalogs. Does not remove unrelated paths.
    """
    q = select(CatalogFile, Catalog.owner_id).join(
        Catalog, Catalog.slug == CatalogFile.catalog_slug
    )
    if owner_id is not None:
        q = q.where(Catalog.owner_id == owner_id)
    result = await session.execute(q)
    rows = list(result.all())
    for f, owner_id in rows:
        dest = catalog_data_dir(owner_id, f.catalog_slug) / f.path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(f.content, encoding="utf-8")

    return len(rows)


def _set_git_backup_status(
    user_settings: UserSettings,
    *,
    run_id: str,
    status: str,
    message: str | None = None,
    commit_sha: str | None = None,
    branch: str | None = None,
    committed: bool | None = None,
) -> None:
    extra = dict(user_settings.extra or {})
    extra["git_backup"] = {
        "run_id": run_id,
        "status": status,  # running|success|error
        "message": message,
        "commit_sha": commit_sha,
        "branch": branch,
        "committed": committed,
        "updated_at": datetime.now(UTC).isoformat(),
    }
    user_settings.extra = extra


async def sync_catalog_with_git(
    catalog_dir: Path,
    user_id: uuid.UUID | None,
    session_factory,  # Use a factory or provide an active session
    commit_message: str = "Catalog sync",
    run_id: str | None = None,
):
    """
    Modularized background task for Git synchronization.
    If Git is configured (globally or for the user), performs a push to the monorepo.
    """
    try:
        # Check global config first
        if settings.CATALOG_GIT_REMOTE:
            async with session_factory() as session:
                exported_count = await _export_db_to_catalog_dir(catalog_dir, session)
                logger.info(
                    f"Exported {exported_count} catalog files from DB before global Git push"
                )
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
                rid = run_id or str(uuid.uuid4())
                _set_git_backup_status(user_settings, run_id=rid, status="running")
                await session.commit()

                # Per-user remote: Git repo root is ``CATALOG_DIR/<user_id>/`` so the
                # remote shows ``<slug>/…`` at top level, not ``<user_id>/<slug>/``.
                user_git_root = catalog_owner_workspace_root(user_id)
                user_git_root.mkdir(parents=True, exist_ok=True)

                exported_count = await _export_db_to_catalog_dir(
                    catalog_dir, session, owner_id=user_id
                )
                logger.info(
                    f"Exported {exported_count} catalog files from DB before Git push"
                )

                res = git_service.push_to_monorepo(
                    user_git_root,
                    remote_url=user_settings.git_remote_url,
                    token=user_settings.git_token,
                    commit_message=commit_message,
                )
                commit_sha = (
                    (res or {}).get("commit_sha") if isinstance(res, dict) else None
                )
                branch = (res or {}).get("branch") if isinstance(res, dict) else None
                committed = (
                    (res or {}).get("committed") if isinstance(res, dict) else None
                )
                msg = (
                    f"pushed {commit_sha[:8]} to {branch}"
                    if commit_sha and branch
                    else "pushed"
                )
                if committed is False:
                    msg = f"up-to-date on {branch}" if branch else "up-to-date"
                _set_git_backup_status(
                    user_settings,
                    run_id=rid,
                    status="success",
                    message=msg,
                    commit_sha=commit_sha,
                    branch=branch,
                    committed=bool(committed) if committed is not None else None,
                )
                await session.commit()
    except Exception as e:
        logger.error(f"Background Git sync failed: {e}")
        if user_id:
            try:
                async with session_factory() as session:
                    result = await session.execute(
                        select(UserSettings).where(UserSettings.user_id == user_id)
                    )
                    user_settings = result.scalar_one_or_none()
                    if user_settings:
                        rid = run_id or str(uuid.uuid4())
                        _set_git_backup_status(
                            user_settings,
                            run_id=rid,
                            status="error",
                            message=str(e)[:500],
                        )
                        await session.commit()
            except Exception:
                # Don't let status tracking break the worker
                pass
