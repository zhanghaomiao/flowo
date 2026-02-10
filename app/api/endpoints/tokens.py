import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session import get_async_session
from app.core.users import current_active_user
from app.models import User
from app.schemas.user_token import UserTokenCreate, UserTokenList, UserTokenResponse
from app.services.user_token import UserTokenService

router = APIRouter()


@router.post("/", response_model=UserTokenResponse)
async def create_token(
    data: UserTokenCreate,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = UserTokenService(db)
    token = await service.create_token(user.id, data)
    return token


@router.get("/", response_model=UserTokenList)
async def list_tokens(
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = UserTokenService(db)
    tokens = await service.list_tokens(user.id)
    return {"tokens": tokens}


@router.delete("/{token_id}")
async def delete_token(
    token_id: uuid.UUID,
    db: AsyncSession = Depends(get_async_session),
    user: User = Depends(current_active_user),
):
    service = UserTokenService(db)
    await service.delete_token(user.id, token_id)
    return {"message": "Token deleted"}
