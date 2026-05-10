import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    LargeBinary,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .workflow import Workflow


class Catalog(Base):
    __tablename__ = "catalogs"
    __table_args__ = (
        UniqueConstraint(
            "owner_id",
            "slug",
            name="uq_catalogs_owner_slug",
            postgresql_nulls_not_distinct=True,
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String, index=True)
    name: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    version: Mapped[str | None] = mapped_column(String, default="0.1.0")
    owner: Mapped[str | None] = mapped_column(String, nullable=True)
    owner_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"), nullable=True
    )
    is_public: Mapped[bool] = mapped_column(Boolean, default=False)
    source_url: Mapped[str | None] = mapped_column(String, nullable=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), default=list)
    rulegraph_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    dag_preview_mime: Mapped[str | None] = mapped_column(String(128), nullable=True)
    dag_preview_bytes: Mapped[bytes | None] = mapped_column(
        LargeBinary,
        nullable=True,
        deferred=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )

    # On-disk workspace (export / Snakemake) lifecycle; DB row remains valid if workspace is missing.
    workspace_status: Mapped[str | None] = mapped_column(
        String(32), nullable=True, default=None
    )
    last_exported_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_export_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    export_revision: Mapped[int | None] = mapped_column(BigInteger, nullable=True)

    workflows: Mapped[list["Workflow"]] = relationship(
        "Workflow", back_populates="catalog"
    )
