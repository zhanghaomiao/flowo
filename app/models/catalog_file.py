import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base


class CatalogFile(Base):
    """工作流文件 - 当前最新版本"""

    __tablename__ = "catalog_files"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    catalog_slug: Mapped[str] = mapped_column(index=True)
    path: Mapped[str]  # 相对路径，如 "workflow/Snakefile"

    content: Mapped[str]  # 文件内容
    content_sha256: Mapped[str]  # 内容哈希

    size: Mapped[int]  # 字节数
    lines: Mapped[int]  # 行数
    language: Mapped[str | None]

    created_by: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )
    last_modified_by: Mapped[str]
    last_modified_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        onupdate=lambda: datetime.now(UTC),
    )
    current_version: Mapped[int] = mapped_column(default=1)

    # 批量导入批次 ID
    batch_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("batch_imports.id", ondelete="SET NULL"),
        nullable=True,
    )

    __table_args__ = (UniqueConstraint("catalog_slug", "path"),)


class CatalogFileVersion(Base):
    """文件版本历史"""

    __tablename__ = "catalog_file_versions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    file_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("catalog_files.id", ondelete="CASCADE"), index=True
    )
    version: Mapped[int]

    content: Mapped[str]
    content_sha256: Mapped[str]

    message: Mapped[str] = mapped_column(default="")
    created_by: Mapped[str]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    __table_args__ = (UniqueConstraint("file_id", "version"),)
