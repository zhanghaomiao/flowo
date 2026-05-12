import asyncio
import secrets
import string
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session import get_async_session
from app.core.users import current_active_user
from app.models import User, UserToken
from app.schemas.user_token import (
    UserTokenCreate,
    UserTokenList,
    UserTokenResponse,
    UserTokenSummary,
)
from app.services.user_token import UserTokenService

router = APIRouter()


class CliLoginStartResponse(BaseModel):
    device_code: str
    user_code: str
    verification_uri_complete: str
    expires_at: datetime
    interval_seconds: int = 2


class CliLoginStartRequest(BaseModel):
    ttl_days: int | None = 90


class CliLoginApproveRequest(BaseModel):
    device_code: str


class CliLoginPollResponse(BaseModel):
    status: str
    token: str | None = None


class _CliLoginSession(BaseModel):
    user_code: str
    expires_at: datetime
    ttl_days: int | None = 90
    token: str | None = None


_CLI_LOGIN_SESSIONS: dict[str, _CliLoginSession] = {}
_CLI_LOGIN_LOCK = asyncio.Lock()


def _cleanup_cli_login_sessions() -> None:
    now = datetime.now(UTC)
    expired = [
        device_code
        for device_code, session in _CLI_LOGIN_SESSIONS.items()
        if session.expires_at < now
    ]
    for device_code in expired:
        _CLI_LOGIN_SESSIONS.pop(device_code, None)


def _new_user_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "-".join(
        "".join(secrets.choice(alphabet) for _ in range(4)) for _ in range(2)
    )


def _user_token_summary(row: UserToken) -> UserTokenSummary:
    return UserTokenSummary(
        id=row.id,
        name=row.name,
        token_prefix=row.token_prefix,
        created_at=row.created_at,
        expires_at=row.expires_at,
    )


@router.post("/", response_model=UserTokenResponse)
async def create_token(
    data: UserTokenCreate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = UserTokenService(db)
    row, plain = await service.create_token(user.id, data)
    return UserTokenResponse(
        id=row.id,
        name=row.name,
        token=plain,
        created_at=row.created_at,
        expires_at=row.expires_at,
    )


@router.post("/cli/start", response_model=CliLoginStartResponse)
async def start_cli_login(data: CliLoginStartRequest | None = None):
    _cleanup_cli_login_sessions()
    device_code = secrets.token_urlsafe(32)
    user_code = _new_user_code()
    expires_at = datetime.now(UTC) + timedelta(minutes=10)
    _CLI_LOGIN_SESSIONS[device_code] = _CliLoginSession(
        user_code=user_code,
        expires_at=expires_at,
        ttl_days=data.ttl_days if data else 90,
    )
    return CliLoginStartResponse(
        device_code=device_code,
        user_code=user_code,
        verification_uri_complete=f"/login?cli_device_code={device_code}&cli_user_code={user_code}",
        expires_at=expires_at,
    )


@router.post("/cli/approve", response_model=CliLoginPollResponse)
async def approve_cli_login(
    data: CliLoginApproveRequest,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    async with _CLI_LOGIN_LOCK:
        _cleanup_cli_login_sessions()
        session = _CLI_LOGIN_SESSIONS.get(data.device_code)
        if not session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="CLI login request not found or expired.",
            )
        if session.token:
            return CliLoginPollResponse(status="approved")

        service = UserTokenService(db)
        _, plain = await service.create_token(
            user.id,
            UserTokenCreate(
                name=f"CLI login {datetime.now(UTC).isoformat()}",
                ttl_days=session.ttl_days,
            ),
        )
        session.token = plain
    return CliLoginPollResponse(status="approved")


@router.get("/cli/poll/{device_code}", response_model=CliLoginPollResponse)
async def poll_cli_login(device_code: str):
    _cleanup_cli_login_sessions()
    session = _CLI_LOGIN_SESSIONS.get(device_code)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="CLI login request not found or expired.",
        )
    if not session.token:
        return CliLoginPollResponse(status="pending")

    token = session.token
    _CLI_LOGIN_SESSIONS.pop(device_code, None)
    return CliLoginPollResponse(status="approved", token=token)


@router.get("/", response_model=UserTokenList)
async def list_tokens(
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = UserTokenService(db)
    tokens = await service.list_tokens(user.id)
    return {"tokens": [_user_token_summary(t) for t in tokens]}


@router.delete("/{token_id}")
async def delete_token(
    token_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = UserTokenService(db)
    await service.delete_token(user.id, token_id)
    return {"message": "Token deleted"}
