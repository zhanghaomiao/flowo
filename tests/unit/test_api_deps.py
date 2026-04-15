import uuid
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from starlette.requests import Request

from app.api.deps import current_active_user_with_token
from app.models.user import User


def make_request() -> Request:
    return Request({"type": "http", "headers": []})


def make_user(
    *,
    user_id: uuid.UUID | None = None,
    email: str = "user@example.com",
    is_active: bool = True,
) -> User:
    return User(
        id=user_id or uuid.uuid4(),
        email=email,
        hashed_password="hashed",
        is_active=is_active,
        is_superuser=False,
        is_verified=True,
    )


class FakeSession:
    def __init__(self, token_row):
        self.execute = AsyncMock(return_value=MagicMock(
            scalar_one_or_none=MagicMock(return_value=token_row)
        ))


@pytest.mark.asyncio
async def test_current_active_user_with_token_prefers_jwt_user():
    jwt_user = make_user(email="jwt@example.com")
    user_manager = AsyncMock()

    user = await current_active_user_with_token(
        request=make_request(),
        optional_user=jwt_user,
        token=HTTPAuthorizationCredentials(scheme="Bearer", credentials="flw_token"),
        user_manager=user_manager,
        session=AsyncMock(),
    )

    assert user is jwt_user
    user_manager.get.assert_not_awaited()


@pytest.mark.asyncio
async def test_current_active_user_with_token_accepts_valid_api_token():
    api_user = make_user(email="token@example.com")
    user_manager = AsyncMock()
    user_manager.get.return_value = api_user
    session = FakeSession(type(
        "TokenRow",
        (),
        {
            "user_id": api_user.id,
            "expires_at": None,
        },
    )())

    user = await current_active_user_with_token(
        request=make_request(),
        optional_user=None,
        token=HTTPAuthorizationCredentials(
            scheme="Bearer", credentials="flw_valid_api_token"
        ),
        user_manager=user_manager,
        session=session,
    )

    assert user.id == api_user.id
    user_manager.get.assert_awaited_once_with(api_user.id)


@pytest.mark.asyncio
async def test_current_active_user_with_token_rejects_non_flw_token():
    user_manager = AsyncMock()

    with pytest.raises(HTTPException) as excinfo:
        await current_active_user_with_token(
            request=make_request(),
            optional_user=None,
            token=HTTPAuthorizationCredentials(
                scheme="Bearer", credentials="plain_token"
            ),
            user_manager=user_manager,
            session=AsyncMock(),
        )

    assert excinfo.value.status_code == 401
    user_manager.get.assert_not_awaited()


@pytest.mark.asyncio
async def test_current_active_user_with_token_rejects_invalid_api_token():
    user_manager = AsyncMock()
    session = FakeSession(None)

    with pytest.raises(HTTPException) as excinfo:
        await current_active_user_with_token(
            request=make_request(),
            optional_user=None,
            token=HTTPAuthorizationCredentials(
                scheme="Bearer", credentials="flw_expired_or_invalid"
            ),
            user_manager=user_manager,
            session=session,
        )

    assert excinfo.value.status_code == 401
    user_manager.get.assert_not_awaited()


@pytest.mark.asyncio
async def test_current_active_user_with_token_rejects_missing_or_inactive_user():
    user_manager = AsyncMock()
    user_manager.get.side_effect = [None, make_user(is_active=False)]
    session = FakeSession(type(
        "TokenRow",
        (),
        {
            "user_id": uuid.uuid4(),
            "expires_at": None,
        },
    )())

    for _ in range(2):
        with pytest.raises(HTTPException) as excinfo:
            await current_active_user_with_token(
                request=make_request(),
                optional_user=None,
                token=HTTPAuthorizationCredentials(
                    scheme="Bearer", credentials="flw_valid_api_token"
                ),
                user_manager=user_manager,
                session=session,
            )

        assert excinfo.value.status_code == 401
