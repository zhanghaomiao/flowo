from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import current_active_user_with_token
from app.core.session import get_db
from app.models import User
from app.services.reports import finalize_workflow, ingest_report_event

router = APIRouter()


class ReportPayload(BaseModel):
    event: str
    record: dict[str, Any]
    context: dict[str, Any]


@router.post("/")
async def report_event(
    payload: ReportPayload,
    user: User = Depends(current_active_user_with_token),
    db: Session = Depends(get_db),
):
    # Ensure current user info is in context
    payload.context["flowo_user"] = user.email
    payload.context["flowo_user_id"] = user.id

    ingest_report_event(
        db,
        event_name=payload.event,
        record=payload.record,
        context=payload.context,
        user_id=user.id,
    )
    db.commit()

    return {"context": payload.context}


@router.post("/close")
async def close_workflow(
    workflow_id: str,
    user: User = Depends(current_active_user_with_token),
    db: Session = Depends(get_db),
):
    return finalize_workflow(db, workflow_id, user)
