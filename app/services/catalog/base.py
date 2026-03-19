from sqlalchemy.ext.asyncio import AsyncSession


class CatalogBase:
    """Base class for CatalogService providing the DB session."""

    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session
