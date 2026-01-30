from fastapi import APIRouter, Request
from sse_starlette.sse import EventSourceResponse

from app.core.pg_listener import pg_listener

router = APIRouter()


@router.get("/events")
async def stream_events(
    request: Request,
):
    target_channels = ["global_events"]

    return EventSourceResponse(
        pg_listener.listen(target_channels, request),
        ping=15,
        media_type="text/event-stream",
    )
