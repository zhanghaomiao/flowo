from fastapi import APIRouter, Query, Request
from fastapi.logger import logger
from sse_starlette.sse import EventSourceResponse

from app.core.pg_listener import pg_listener

router = APIRouter()


@router.get("/events")
async def stream_events(
    request: Request,
    workflow_ids: str | None = Query(None, description="Current visible workflow IDs"),
    global_insert: bool = Query(False, description="Global insert"),
):
    target_channels = []

    if workflow_ids:
        ids = [x.strip() for x in workflow_ids.split(",") if x.strip()]
        target_channels.extend([f"workflow_events_{id}" for id in ids])
    if global_insert:
        target_channels.append("workflows_global_insert")
    logger.info(f"SSE: Total channels to listen: {target_channels}")

    return EventSourceResponse(
        pg_listener.listen(target_channels, request),
        ping=15,
        media_type="text/event-stream",
    )
