import uuid

from fastapi import APIRouter, Depends
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
