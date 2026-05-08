import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, DateTime, Index, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class BatchImport(Base):
    """批量导入批次记录"""

    __tablename__ = "batch_imports"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    catalog_slug: Mapped[str] = mapped_column(String, index=True)
    mode: Mapped[str]  # "replace" 或 "merge"
    commit_message: Mapped[str]

    summary: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str]  # "completed", "failed", "partial", "in_progress"
    error_message: Mapped[str | None]

    created_by: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index("ix_batch_imports_catalog_created", "catalog_slug", "created_at"),
    )
