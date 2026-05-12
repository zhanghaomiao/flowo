"""Binary catalog assets: metadata in DB, bytes on disk (sidecar)."""

import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .catalog import Catalog


class CatalogBlob(Base):
    """Non-text workflow files (e.g. ``.test/*.fq.gz``): path + hash in DB, content under ``CATALOG_BLOB_DIR``."""

    __tablename__ = "catalog_blobs"
    __table_args__ = (
        UniqueConstraint(
            "catalog_id",
            "path",
            name="uq_catalog_blobs_catalog_path",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    catalog_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("catalogs.id", ondelete="CASCADE"),
        index=True,
    )
    path: Mapped[str] = mapped_column(Text, nullable=False)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    catalog: Mapped["Catalog"] = relationship("Catalog", back_populates="catalog_blobs")
