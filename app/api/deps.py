from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.session import get_async_session
from app.core.users import UserManager, current_active_user, get_user_manager
from app.models.user import User
from app.services.user_token import UserTokenService

security = HTTPBearer(auto_error=False)


async def current_active_user_with_token(
    request: Request,
    token: HTTPAuthorizationCredentials | None = Depends(security),
    user_manager: UserManager = Depends(get_user_manager),
    session: AsyncSession = Depends(get_async_session),
) -> User:
    # 1. Try standard JWT Auth
    try:
        user = await current_active_user(token)
        if user:
            return user
    except Exception:
        pass

    # 2. Try API Token
    if token and token.scheme.lower() == "bearer":
        token_str = token.credentials
        if token_str.startswith("flw_"):
            token_service = UserTokenService(session)
            user_id = await token_service.verify_token(token_str)
            if user_id:
                user = await user_manager.get(user_id)
                if user and user.is_active:
                    return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Unauthorized",
        headers={"WWW-Authenticate": "Bearer"},
    )
