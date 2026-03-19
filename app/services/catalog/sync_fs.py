import time

from sqlalchemy import select

from app.models import Catalog

from .utils import _get_catalog_dir

_LAST_SYNC_TIME: float = 0
SYNC_THROTTLE_SECONDS = 30  # Don't sync more than once every 30s


class CatalogFSSyncMixin:
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
            db_cat = next((c for c in db_catalogs if c.slug == slug), None)

            if not db_cat:
                new_catalog = Catalog(
                    slug=slug,
                    name=slug.replace("-", " ").title(),
                    description="",
                    version="0.1.0",
                    owner="unknown",
                    is_public=False,
                    source_url="",
                    tags=[],
                )
                self.db_session.add(new_catalog)
                changed = True

        if changed or orphaned_slugs:
            await self.db_session.commit()

        _LAST_SYNC_TIME = now_ts
