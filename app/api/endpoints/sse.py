import uuid
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sse_starlette.sse import EventSourceResponse

from app.core.config import settings
from app.core.pg_listener import pg_listener
from app.core.users import (
    UserManager,
    current_active_user,
    get_user_manager,
)
from app.models import User

router = APIRouter()


@router.post("/ticket")
async def get_sse_ticket(
    user: User = Depends(current_active_user),
):
    payload = {
        "type": "sse_ticket",
        "user_id": str(user.id),
        "exp": datetime.now(UTC) + timedelta(seconds=15),
    }
    ticket = jwt.encode(payload, settings.SECRET_KEY, algorithm="HS256")
    return {"ticket": ticket}


@router.get("/events")
async def stream_events(
    request: Request,
    token: str = Query(...),
    user_manager: UserManager = Depends(get_user_manager),
):
    user = None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        if payload.get("type") == "sse_ticket":
            user_id = payload.get("user_id")
            if user_id:
                user = await user_manager.get(uuid.UUID(user_id))
    except Exception:
        pass

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid or expired ticket")

    target_channels = ["global_events", f"user_{user.id}_events"]

    return EventSourceResponse(
        pg_listener.listen(target_channels, request),
        ping=15,
        media_type="text/event-stream",
    )
