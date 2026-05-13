"""Tests for optional superuser bootstrap from environment variables."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app import manage


@pytest.mark.asyncio
async def test_bootstrap_skips_when_env_incomplete(monkeypatch):
    monkeypatch.delenv("FLOWO_BOOTSTRAP_ADMIN_EMAIL", raising=False)
    monkeypatch.delenv("FLOWO_BOOTSTRAP_ADMIN_PASSWORD", raising=False)
    with patch.object(manage, "create_admin", new_callable=AsyncMock) as ca:
        await manage.bootstrap_admin_from_env()
    ca.assert_not_awaited()


@pytest.mark.asyncio
async def test_bootstrap_skips_when_superuser_exists(monkeypatch):
    monkeypatch.setenv("FLOWO_BOOTSTRAP_ADMIN_EMAIL", "ops@example.com")
    monkeypatch.setenv("FLOWO_BOOTSTRAP_ADMIN_PASSWORD", "secret-pass")

    mock_session = MagicMock()
    mock_session.scalar = AsyncMock(return_value=1)

    fake_cm = MagicMock()
    fake_cm.__aenter__ = AsyncMock(return_value=mock_session)
    fake_cm.__aexit__ = AsyncMock(return_value=None)

    with patch.object(manage, "AsyncSessionLocal", return_value=fake_cm):
        with patch.object(manage, "create_admin", new_callable=AsyncMock) as ca:
            await manage.bootstrap_admin_from_env()
    ca.assert_not_awaited()


@pytest.mark.asyncio
async def test_bootstrap_calls_create_admin_when_allowed(monkeypatch):
    monkeypatch.setenv("FLOWO_BOOTSTRAP_ADMIN_EMAIL", "ops@example.com")
    monkeypatch.setenv("FLOWO_BOOTSTRAP_ADMIN_PASSWORD", "secret-pass")

    mock_session = MagicMock()
    mock_session.scalar = AsyncMock(side_effect=[0, None])

    fake_cm = MagicMock()
    fake_cm.__aenter__ = AsyncMock(return_value=mock_session)
    fake_cm.__aexit__ = AsyncMock(return_value=None)

    with patch.object(manage, "AsyncSessionLocal", return_value=fake_cm):
        with patch.object(manage, "create_admin", new_callable=AsyncMock) as ca:
            await manage.bootstrap_admin_from_env()
    ca.assert_awaited_once_with("ops@example.com", "secret-pass", quiet=True)


@pytest.mark.asyncio
async def test_bootstrap_skips_when_email_already_taken(monkeypatch):
    monkeypatch.setenv("FLOWO_BOOTSTRAP_ADMIN_EMAIL", "exists@example.com")
    monkeypatch.setenv("FLOWO_BOOTSTRAP_ADMIN_PASSWORD", "secret-pass")

    mock_session = MagicMock()
    mock_session.scalar = AsyncMock(side_effect=[0, MagicMock()])

    fake_cm = MagicMock()
    fake_cm.__aenter__ = AsyncMock(return_value=mock_session)
    fake_cm.__aexit__ = AsyncMock(return_value=None)

    with patch.object(manage, "AsyncSessionLocal", return_value=fake_cm):
        with patch.object(manage, "create_admin", new_callable=AsyncMock) as ca:
            await manage.bootstrap_admin_from_env()
    ca.assert_not_awaited()
