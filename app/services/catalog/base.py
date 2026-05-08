from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Catalog


class CatalogBase:
    """Base class for CatalogService providing the DB session."""

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session

    async def _get_catalog_or_404(self, slug: str) -> Catalog:
        result = await self.db_session.execute(
            select(Catalog).where(Catalog.slug == slug)
        )
        cat = result.scalar_one_or_none()
        if not cat:
            raise HTTPException(status_code=404, detail="Catalog not found")
        return cat
