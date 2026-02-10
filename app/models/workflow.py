import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import JSON, DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import timezone

from .base import Base
from .enums import Status

if TYPE_CHECKING:
    from .error import Error
    from .job import Job
    from .rule import Rule


class Workflow(Base):
    __tablename__ = "workflows"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    snakefile: Mapped[str | None]
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[Status] = mapped_column(
        Enum(Status), default="UNKNOWN", nullable=True
    )
    command_line: Mapped[str | None]
    dryrun: Mapped[bool]
    rulegraph_data: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    logfile: Mapped[str | None] = mapped_column(nullable=True)
    user: Mapped[str | None] = mapped_column(nullable=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("user.id", ondelete="SET NULL"), nullable=True
    )
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=True)
    name: Mapped[str | None] = mapped_column(nullable=True)
    configfiles: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=True)
    directory: Mapped[str | None] = mapped_column(nullable=True)
    config: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    flowo_working_path: Mapped[str | None] = mapped_column(nullable=True)
    run_info: Mapped[dict[str, int] | None] = mapped_column(JSON, nullable=True)

    rules: Mapped[list["Rule"]] = relationship(
        "Rule",
        back_populates="workflow",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    jobs: Mapped[list["Job"]] = relationship(
        "Job",
        back_populates="workflow",
        lazy="dynamic",
    )
    errors: Mapped[list["Error"]] = relationship(
        "Error",
        back_populates="workflow",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
