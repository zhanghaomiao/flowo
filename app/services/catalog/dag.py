import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select

from app.models import Catalog

from .access import assert_catalog_readable


class CatalogDAGMixin:
    async def generate_dag(
        self, slug: str, user_id: uuid.UUID | None = None
    ) -> dict[str, Any]:
        """Return cached DAG data from DB. No dynamic generation fallback."""
        query = select(Catalog).where(Catalog.slug == slug)
        result = await self.db_session.execute(query)
        cat = result.scalar_one_or_none()

        if not cat:
            raise HTTPException(status_code=404, detail="Catalog not found")

        assert_catalog_readable(cat, user_id)

        if not cat.rulegraph_data:
            return {
                "nodes": [],
                "links": [],
                "error": "No cached DAG data available. Run the workflow at least once to generate the DAG.",
            }

        return cat.rulegraph_data
