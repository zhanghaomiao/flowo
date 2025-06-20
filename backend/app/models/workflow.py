from .base import Base
from .enums import Status

from sqlalchemy import JSON, Enum, String
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship
from datetime import datetime, timezone
from typing import Optional, Dict, Any, TYPE_CHECKING, List
import uuid

if TYPE_CHECKING:
    from .rule import Rule
    from .job import Job
    from .error import Error


class Workflow(Base):
    __tablename__ = "workflows"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    snakefile: Mapped[Optional[str]]
    started_at: Mapped[datetime] = mapped_column(default=datetime.now(timezone.utc))
    end_time: Mapped[Optional[datetime]]
    status: Mapped[Status] = mapped_column(
        Enum(Status), default="UNKNOWN", nullable=True
    )
    command_line: Mapped[Optional[str]]
    dryrun: Mapped[bool]
    rulegraph_data: Mapped[Optional[Dict[str, Any]]] = mapped_column(
        JSON, nullable=True
    )
    logfile: Mapped[Optional[str]] = mapped_column(nullable=True)
    user: Mapped[Optional[str]] = mapped_column(nullable=True)
    tags: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=True)
    name: Mapped[Optional[str]] = mapped_column(nullable=True)
    configfiles: Mapped[list[str]] = mapped_column(ARRAY(String), nullable=True)
    directory: Mapped[Optional[str]] = mapped_column(nullable=True)
    config: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    flowo_working_path: Mapped[Optional[str]] = mapped_column(nullable=True)
    run_info: Mapped[Optional[Dict[str, int]]] = mapped_column(JSON, nullable=True)

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
