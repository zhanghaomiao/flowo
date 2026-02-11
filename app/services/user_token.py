import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.user_token import UserToken
from ..schemas.user_token import UserTokenCreate


class UserTokenService:
    def __init__(self, db_session: AsyncSession):
        self.db_session = db_session

    async def create_token(
        self, user_id: uuid.UUID, data: UserTokenCreate
    ) -> UserToken:
        token_str = f"flw_{secrets.token_urlsafe(32)}"
        expires_at = None
        if data.ttl_days is not None:
            expires_at = datetime.now(UTC) + timedelta(days=data.ttl_days)

        user_token = UserToken(
            name=data.name, token=token_str, user_id=user_id, expires_at=expires_at
        )
        self.db_session.add(user_token)
        await self.db_session.commit()
        await self.db_session.refresh(user_token)
        return user_token

    async def list_tokens(self, user_id: uuid.UUID) -> list[UserToken]:
        query = (
            select(UserToken)
            .where(UserToken.user_id == user_id)
            .order_by(UserToken.created_at.desc())
        )
        result = await self.db_session.execute(query)
        return list(result.scalars().all())

    async def delete_token(self, user_id: uuid.UUID, token_id: uuid.UUID):
        query = delete(UserToken).where(
            UserToken.user_id == user_id, UserToken.id == token_id
        )
        await self.db_session.execute(query)
        await self.db_session.commit()

    async def verify_token(self, token: str) -> uuid.UUID | None:
        query = select(UserToken).where(UserToken.token == token)
        result = await self.db_session.execute(query)
        user_token = result.scalar_one_or_none()

        if not user_token:
            return None

        if user_token.expires_at and user_token.expires_at < datetime.now(UTC):
            # Token expired
            return None

        return user_token.user_id
