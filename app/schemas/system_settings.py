import uuid

from pydantic import BaseModel, ConfigDict


class SystemSettingsRead(BaseModel):
    id: uuid.UUID
    allow_public_registration: bool
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_use_tls: bool = True
    notify_on_submit: bool = False
    notify_on_success: bool = False
    notify_on_failure: bool = False
    site_url: str | None = None
    require_email_verification: bool = False

    model_config = ConfigDict(from_attributes=True)


class SystemInfoRead(BaseModel):
    allow_public_registration: bool
    require_email_verification: bool
    email_enabled: bool


class SystemSettingsUpdate(BaseModel):
    allow_public_registration: bool | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_use_tls: bool | None = None
    notify_on_submit: bool | None = None
    notify_on_success: bool | None = None
    notify_on_failure: bool | None = None
    site_url: str | None = None
    require_email_verification: bool | None = None


class TestSmtpRequest(BaseModel):
    smtp_host: str
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True


class ConnectionTestResult(BaseModel):
    success: bool
    message: str
