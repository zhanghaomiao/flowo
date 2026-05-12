import uuid
from datetime import datetime

from pydantic import BaseModel


class UserTokenBase(BaseModel):
    name: str


class UserTokenCreate(UserTokenBase):
    ttl_days: int | None = None


class UserTokenResponse(UserTokenBase):
    id: uuid.UUID
    token: str
    created_at: datetime
    expires_at: datetime | None = None

    class Config:
        from_attributes = True


class UserTokenSummary(UserTokenBase):
    """Listed token: prefix only (full secret is returned only on create)."""

    id: uuid.UUID
    token_prefix: str
    created_at: datetime
    expires_at: datetime | None = None

    class Config:
        from_attributes = True


class UserTokenList(BaseModel):
    tokens: list[UserTokenSummary]
