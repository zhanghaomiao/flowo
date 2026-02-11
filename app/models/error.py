import uuid
from datetime import UTC, datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .rule import Rule
    from .workflow import Workflow


class Error(Base):
    __tablename__ = "errors"

    id: Mapped[int] = mapped_column(primary_key=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    # Error details
    exception: Mapped[str]
    location: Mapped[str | None]
    traceback: Mapped[str | None] = mapped_column(Text, nullable=True)
    file: Mapped[str | None]
    line: Mapped[str | None]

    # Relationship to Rule (optional)
    rule_id: Mapped[int | None] = mapped_column(ForeignKey("rules.id"), nullable=True)
    rule: Mapped[Optional["Rule"]] = relationship("Rule", back_populates="errors")

    # Relationship to Workflow (always present)
    workflow_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workflows.id"))
    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="errors")
