import uuid

from fastapi_users import schemas


class UserRead(schemas.BaseUser[uuid.UUID]):
    role: str = "user"


class UserCreate(schemas.BaseUserCreate):
    invitation_code: str | None = None


class UserUpdate(schemas.BaseUserUpdate):
    pass
