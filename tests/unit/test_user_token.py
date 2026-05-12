import uuid
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest

from app.core.config import settings
from app.models.user_token import UserToken
from app.schemas.user_token import UserTokenCreate
from app.services.user_token import UserTokenService
from app.utils.user_api_token_crypto import hash_user_token


class FakeAsyncSession:
    def __init__(self):
        self.add = MagicMock()
        self.commit = AsyncMock()
        self.refresh = AsyncMock()
        self.execute = AsyncMock()


@pytest.fixture
def mock_db_session():
    return FakeAsyncSession()


@pytest.fixture
def user_token_service(mock_db_session):
    return UserTokenService(mock_db_session)


@pytest.mark.asyncio
async def test_create_token_with_ttl(user_token_service, mock_db_session):
    user_id = uuid.uuid4()
    data = UserTokenCreate(name="Test Token", ttl_days=30)

    row, plain = await user_token_service.create_token(user_id, data)

    assert row.name == "Test Token"
    assert row.user_id == user_id
    assert row.expires_at is not None
    assert plain.startswith("flw_")
    assert len(row.token_hash) == 64
    assert "…" in row.token_prefix or row.token_prefix == "—"
    mock_db_session.add.assert_called_once_with(row)
    mock_db_session.commit.assert_awaited_once()
    mock_db_session.refresh.assert_awaited_once_with(row)


@pytest.mark.asyncio
async def test_create_token_without_ttl(user_token_service):
    user_id = uuid.uuid4()
    data = UserTokenCreate(name="Never Expire Token", ttl_days=None)

    row, plain = await user_token_service.create_token(user_id, data)

    assert row.name == "Never Expire Token"
    assert row.expires_at is None
    assert plain.startswith("flw_")


@pytest.mark.asyncio
async def test_list_tokens(user_token_service, mock_db_session):
    user_id = uuid.uuid4()
    mock_result = MagicMock()
    mock_result.scalars().all.return_value = [
        UserToken(
            id=uuid.uuid4(),
            name="Token 1",
            user_id=user_id,
            token_hash="a" * 64,
            token_prefix="flw_abcde…",
        ),
        UserToken(
            id=uuid.uuid4(),
            name="Token 2",
            user_id=user_id,
            token_hash="b" * 64,
            token_prefix="flw_fghij…",
        ),
    ]
    mock_db_session.execute.return_value = mock_result

    tokens = await user_token_service.list_tokens(user_id)

    assert [token.name for token in tokens] == ["Token 1", "Token 2"]
    mock_db_session.execute.assert_awaited_once()


@pytest.mark.asyncio
async def test_delete_token(user_token_service, mock_db_session):
    await user_token_service.delete_token(uuid.uuid4(), uuid.uuid4())

    mock_db_session.execute.assert_awaited_once()
    mock_db_session.commit.assert_awaited_once()


@pytest.mark.asyncio
async def test_verify_token_valid(user_token_service, mock_db_session):
    user_id = uuid.uuid4()
    plain = "flw_valid_token"
    digest = hash_user_token(plain, secret=settings.SECRET_KEY)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = UserToken(
        id=uuid.uuid4(),
        name="Valid",
        user_id=user_id,
        token_hash=digest,
        token_prefix=f"{plain[:10]}…",
        expires_at=datetime.now(UTC) + timedelta(days=1),
    )
    mock_db_session.execute.return_value = mock_result

    result_user_id = await user_token_service.verify_token(plain)

    assert result_user_id == user_id


@pytest.mark.asyncio
async def test_verify_token_invalid(user_token_service, mock_db_session):
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db_session.execute.return_value = mock_result

    result_user_id = await user_token_service.verify_token("invalid_token")

    assert result_user_id is None


@pytest.mark.asyncio
async def test_verify_token_expired(user_token_service, mock_db_session):
    user_id = uuid.uuid4()
    plain = "flw_expired_token"
    digest = hash_user_token(plain, secret=settings.SECRET_KEY)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = UserToken(
        id=uuid.uuid4(),
        name="Expired",
        user_id=user_id,
        token_hash=digest,
        token_prefix=f"{plain[:10]}…",
        expires_at=datetime.now(UTC) - timedelta(days=1),
    )
    mock_db_session.execute.return_value = mock_result

    result_user_id = await user_token_service.verify_token(plain)

    assert result_user_id is None
