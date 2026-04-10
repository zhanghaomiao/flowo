import uuid
from datetime import datetime

from fastapi import Depends, HTTPException, Request, status
from fastapi_users import BaseUserManager, FastAPIUsers, UUIDIDMixin
from fastapi_users.authentication import (
    AuthenticationBackend,
    BearerTransport,
    JWTStrategy,
)
from fastapi_users.db import SQLAlchemyUserDatabase
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.invitation import Invitation
from ..models.system_settings import SystemSettings
from ..models.user import User
from ..schemas.user import UserCreate
from .config import settings
from .session import get_async_session

SECRET = settings.SECRET_KEY


class UserManager(UUIDIDMixin, BaseUserManager[User, uuid.UUID]):
    reset_password_token_secret = SECRET
    verification_token_secret = SECRET

    async def create(
        self,
        user_create: UserCreate,
        safe: bool = False,
        request: Request | None = None,
    ) -> User:
        # Check system settings for registration
        session = self.user_db.session
        settings_result = await session.execute(select(SystemSettings))
        system_settings = settings_result.scalar_one_or_none()

        allow_public = (
            system_settings.allow_public_registration if system_settings else True
        )

        if not allow_public:
            invitation_code = getattr(user_create, "invitation_code", None)
            if not invitation_code:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Public registration is disabled. An invitation code is required.",
                )

            invitation_result = await session.execute(
                select(Invitation).where(
                    Invitation.token == invitation_code, Invitation.is_used.is_(False)
                )
            )
            invitation = invitation_result.scalar_one_or_none()

            if not invitation:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invalid or already used invitation code.",
                )

            if invitation.expires_at and invitation.expires_at < datetime.utcnow():
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Invitation code has expired.",
                )

            # Mark as used
            invitation.is_used = True
            session.add(invitation)

        # Remove invitation_code from user_create data before passing to base create logic
        # We need to handle this manually because super().create doesn't know about invitation_code
        user_dict = user_create.model_dump(exclude_unset=True)
        if "invitation_code" in user_dict:
            del user_dict["invitation_code"]

        # Manually hash password and create user to bypass the schema incompatibility with super().create
        password = user_dict.pop("password")
        user_dict["hashed_password"] = self.password_helper.hash(password)

        created_user = await self.user_db.create(user_dict)
        await self.on_after_register(created_user, request)
        return created_user

    async def on_after_register(self, user: User, request: Request | None = None):
        print(f"User {user.id} has registered.")

    async def on_after_forgot_password(
        self, user: User, token: str, request: Request | None = None
    ):
        print(f"User {user.id} has forgot their password. Reset token: {token}")

    async def on_after_request_verify(
        self, user: User, token: str, request: Request | None = None
    ):
        print(f"Verification requested for user {user.id}. Verification token: {token}")


async def get_user_db(session: AsyncSession = Depends(get_async_session)):
    yield SQLAlchemyUserDatabase(session, User)


async def get_user_manager(user_db: SQLAlchemyUserDatabase = Depends(get_user_db)):
    yield UserManager(user_db)


bearer_transport = BearerTransport(tokenUrl="auth/jwt/login")


def get_jwt_strategy() -> JWTStrategy:
    return JWTStrategy(secret=SECRET, lifetime_seconds=3600 * 24 * 7)  # 1 week


auth_backend = AuthenticationBackend(
    name="jwt",
    transport=bearer_transport,
    get_strategy=get_jwt_strategy,
)

fastapi_users = FastAPIUsers[User, uuid.UUID](get_user_manager, [auth_backend])

current_active_user = fastapi_users.current_user(active=True)
current_optional_user = fastapi_users.current_user(active=True, optional=True)
current_superuser = fastapi_users.current_user(active=True, superuser=True)
