from typing import TYPE_CHECKING

from fastapi_users.db import SQLAlchemyBaseUserTableUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base

if TYPE_CHECKING:
    from .user_settings import UserSettings
    from .user_token import UserToken
    from .workflow_event import WorkflowEvent


class User(Base, SQLAlchemyBaseUserTableUUID):
    name: Mapped[str | None] = mapped_column(nullable=True)
    role: Mapped[str] = mapped_column(
        nullable=False,
        default="user",
        server_default="user",
    )
    tokens: Mapped[list["UserToken"]] = relationship(
        "UserToken", back_populates="user", cascade="all, delete-orphan"
    )
    settings: Mapped["UserSettings | None"] = relationship(
        "UserSettings",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
    )
    workflow_events: Mapped[list["WorkflowEvent"]] = relationship(
        "WorkflowEvent",
        back_populates="user",
        passive_deletes=True,
    )
