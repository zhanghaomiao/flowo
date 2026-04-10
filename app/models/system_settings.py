import uuid

from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.types import Boolean, Integer, String

from .base import Base


class SystemSettings(Base):
    __tablename__ = "system_settings"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    allow_public_registration: Mapped[bool] = mapped_column(Boolean, default=True)

    # Global SMTP Settings
    smtp_host: Mapped[str | None] = mapped_column(String, nullable=True)
    smtp_port: Mapped[int | None] = mapped_column(Integer, nullable=True)
    smtp_user: Mapped[str | None] = mapped_column(String, nullable=True)
    smtp_password: Mapped[str | None] = mapped_column(String, nullable=True)
    smtp_from: Mapped[str | None] = mapped_column(String, nullable=True)
    smtp_use_tls: Mapped[bool] = mapped_column(Boolean, default=True)
