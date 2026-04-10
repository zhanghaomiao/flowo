"""User settings API endpoints — GET, PUT, test-git, test-smtp."""

from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session import get_async_session
from app.core.users import current_active_user
from app.models.user import User
from app.models.user_settings import UserSettings
from app.services.third_party.git import git_service

router = APIRouter()


# ─── Schemas ────────────────────────────────────────────────────────────────


class UserSettingsRead(BaseModel):
    git_remote_url: str | None = None
    git_token: str | None = None
    extra: dict[str, Any] | None = None


class UserSettingsUpdate(BaseModel):
    git_remote_url: str | None = None
    git_token: str | None = None
    extra: dict[str, Any] | None = None


class TestGitRequest(BaseModel):
    remote_url: str
    token: str | None = None


class ConnectionTestResult(BaseModel):
    success: bool
    message: str


# ─── Helpers ────────────────────────────────────────────────────────────────


async def get_or_create_user_settings(
    user: User, session: AsyncSession
) -> UserSettings:
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
    settings = await get_or_create_user_settings(user, session)
    await session.commit()
    return UserSettingsRead(
        git_remote_url=settings.git_remote_url,
        git_token=settings.git_token,
        extra=settings.extra,
    )


@router.put("", response_model=UserSettingsRead)
async def update_settings(
    body: UserSettingsUpdate,
    user: User = Depends(current_active_user),
    session: AsyncSession = Depends(get_async_session),
) -> UserSettingsRead:
    """Upsert user settings."""
    settings = await get_or_create_user_settings(user, session)

    for field, value in body.model_dump(exclude_unset=False).items():
        setattr(settings, field, value)

    await session.commit()
    await session.refresh(settings)

    return UserSettingsRead(
        git_remote_url=settings.git_remote_url,
        git_token=settings.git_token,
        extra=settings.extra,
    )


@router.post("/test/git", response_model=ConnectionTestResult)
async def test_git_connection(
    body: TestGitRequest,
    user: User = Depends(current_active_user),
) -> ConnectionTestResult:
    """Test Git connectivity via GitService."""
    success, message = git_service.test_connection(body.remote_url, body.token)
    return ConnectionTestResult(success=success, message=message)
