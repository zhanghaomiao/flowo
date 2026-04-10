import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr


class InvitationBase(BaseModel):
    email: EmailStr | None = None
    expires_at: datetime | None = None


class InvitationCreate(InvitationBase):
    pass


class InvitationRead(InvitationBase):
    id: uuid.UUID
    token: str
    is_used: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
