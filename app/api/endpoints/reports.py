from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import exists, select
from sqlalchemy.orm import Session

from app.api.deps import current_active_user_with_token
from app.core.session import get_db
from app.models import Job, Status, User, Workflow
from app.plugin.server.registry import event_registry

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

    # Dispatch event using the new registry
    event_registry.dispatch(payload.event, payload.record, db, payload.context)
    db.commit()

    return {"context": payload.context}


@router.post("/close")
async def close_workflow(
    workflow_id: str,
    user: User = Depends(current_active_user_with_token),
    db: Session = Depends(get_db),
):
    workflow = db.query(Workflow).get(workflow_id)
    if not workflow:
        return {"message": "Workflow not found"}

    if workflow.user_id != user.id and not (user.is_superuser):
        return {"message": "Unauthorized"}

    stmt = select(
        exists().where(Job.workflow_id == workflow.id, Job.status == Status.ERROR)
    )
    has_error = db.scalar(stmt)
    if has_error:
        workflow.status = Status.ERROR
    else:
        workflow.status = Status.SUCCESS
        workflow.end_time = datetime.now()

    db.commit()
    return {"status": workflow.status}
