"""User settings API endpoints — GET, PUT, test-git, test-smtp."""

from __future__ import annotations

import smtplib
import subprocess
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session import get_async_session
from app.core.users import current_active_user
from app.models.user import User
from app.models.user_settings import UserSettings

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────────────────────


class UserSettingsRead(BaseModel):
    git_remote_url: str | None = None
    git_token: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_use_tls: bool | None = True
    extra: dict[str, Any] | None = None


class UserSettingsUpdate(BaseModel):
    git_remote_url: str | None = None
    git_token: str | None = None
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_use_tls: bool | None = True
    extra: dict[str, Any] | None = None


class TestGitRequest(BaseModel):
    remote_url: str
    token: str | None = None


class TestSmtpRequest(BaseModel):
    smtp_host: str
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_use_tls: bool = True


class ConnectionTestResult(BaseModel):
    success: bool
    message: str


# ─── Helpers ────────────────────────────────────────────────────────────────


async def _get_or_create_settings(user: User, session: AsyncSession) -> UserSettings:
    result = await session.execute(
        select(UserSettings).where(UserSettings.user_id == user.id)
    )
    settings = result.scalar_one_or_none()
    if settings is None:
        settings = UserSettings(id=uuid.uuid4(), user_id=user.id)
        session.add(settings)
        await session.flush()
    return settings


def _build_git_url(url: str, token: str | None) -> str:
    if token and url.startswith("https://"):
        return url.replace("https://", f"https://{token}@", 1)
    return url


# ─── Routes ─────────────────────────────────────────────────────────────────


@router.get("", response_model=UserSettingsRead)
async def get_settings(
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> UserSettingsRead:
    """Get the current user's settings (creates empty row if none exist)."""
    settings = await _get_or_create_settings(user, session)
    await session.commit()
    return UserSettingsRead(
        git_remote_url=settings.git_remote_url,
        git_token=settings.git_token,
        smtp_host=settings.smtp_host,
        smtp_port=settings.smtp_port,
        smtp_user=settings.smtp_user,
        smtp_password=settings.smtp_password,
        smtp_from=settings.smtp_from,
        smtp_use_tls=settings.smtp_use_tls,
        extra=settings.extra,
    )


@router.put("", response_model=UserSettingsRead)
async def update_settings(
    body: UserSettingsUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> UserSettingsRead:
    """Upsert user settings."""
    settings = await _get_or_create_settings(user, session)

    for field, value in body.model_dump(exclude_unset=False).items():
        setattr(settings, field, value)

    await session.commit()
    await session.refresh(settings)

    return UserSettingsRead(
        git_remote_url=settings.git_remote_url,
        git_token=settings.git_token,
        smtp_host=settings.smtp_host,
        smtp_port=settings.smtp_port,
        smtp_user=settings.smtp_user,
        smtp_password=settings.smtp_password,
        smtp_from=settings.smtp_from,
        smtp_use_tls=settings.smtp_use_tls,
        extra=settings.extra,
    )


@router.post("/test/git", response_model=ConnectionTestResult)
async def test_git_connection(
    body: TestGitRequest,
    user: User = Depends(current_active_user),
) -> ConnectionTestResult:
    """Test Git connectivity by running git ls-remote on the given URL."""
    url = _build_git_url(body.remote_url, body.token)
    try:
        result = subprocess.run(
            ["git", "ls-remote", "--quiet", "--exit-code", url],
            capture_output=True,
            text=True,
            timeout=15,
        )
        if result.returncode == 0:
            return ConnectionTestResult(
                success=True,
                message="Connection successful — repository is accessible.",
            )
        elif result.returncode == 128:
            return ConnectionTestResult(
                success=False,
                message=f"Repository not found or access denied. {result.stderr.strip()}",
            )
        else:
            return ConnectionTestResult(
                success=False,
                message=result.stderr.strip() or "Git ls-remote failed.",
            )
    except FileNotFoundError as e:
        raise HTTPException(
            status_code=500, detail="git is not installed on the server"
        ) from e
    except subprocess.TimeoutExpired:
        return ConnectionTestResult(
            success=False, message="Connection timed out after 15s."
        )


@router.post("/test/smtp", response_model=ConnectionTestResult)
async def test_smtp_connection(
    body: TestSmtpRequest,
    user: User = Depends(current_active_user),
) -> ConnectionTestResult:
    """Test SMTP connectivity by attempting a connection + optional AUTH."""
    try:
        if body.smtp_use_tls:
            server = smtplib.SMTP_SSL(body.smtp_host, body.smtp_port, timeout=10)
        else:
            server = smtplib.SMTP(body.smtp_host, body.smtp_port, timeout=10)
            server.starttls()

        if body.smtp_user and body.smtp_password:
            server.login(body.smtp_user, body.smtp_password)

        server.quit()
        return ConnectionTestResult(success=True, message="SMTP connection successful.")
    except smtplib.SMTPAuthenticationError:
        return ConnectionTestResult(
            success=False, message="Authentication failed — check username/password."
        )
    except smtplib.SMTPConnectError as e:
        return ConnectionTestResult(success=False, message=f"Cannot connect: {e}")
    except TimeoutError:
        return ConnectionTestResult(success=False, message="Connection timed out.")
    except Exception as e:
        return ConnectionTestResult(success=False, message=str(e))
