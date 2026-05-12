"""Synchronous workflow close / finalize for the reports API (sync SQLAlchemy Session)."""

from __future__ import annotations

from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import exists, select, update
from sqlalchemy.orm import Session

from app.models import Job, Status, User, Workflow


def finalize_workflow(
    db: Session, workflow_id: str | UUID, user: User
) -> dict[str, Any]:
    """
    Set workflow terminal status from job errors, fix RUNNING jobs, commit, send notifications.

    Returns the same shapes as the legacy ``/reports/close`` route for compatibility.
    """
    from app.services.notification import (
        notify_workflow_failure,
        notify_workflow_success,
    )

    try:
        wf_key = (
            UUID(str(workflow_id)) if not isinstance(workflow_id, UUID) else workflow_id
        )
    except (TypeError, ValueError):
        return {"message": "Workflow not found"}
    workflow = db.get(Workflow, wf_key)
    if not workflow:
        return {"message": "Workflow not found"}

    if workflow.user_id != user.id and not user.is_superuser:
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

    db.execute(
        update(Job)
        .where(Job.workflow_id == workflow.id, Job.status == Status.RUNNING)
        .values(status=workflow.status, end_time=workflow.end_time)
    )

    db.commit()

    duration = ""
    if workflow.started_at and workflow.end_time:
        delta = workflow.end_time - workflow.started_at
        minutes = int(delta.total_seconds() // 60)
        seconds = int(delta.total_seconds() % 60)
        duration = f"{minutes}m {seconds}s"

    if workflow.status == Status.SUCCESS:
        notify_workflow_success(db, workflow.name or "", user.email, duration)
    elif workflow.status == Status.ERROR:
        notify_workflow_failure(
            db, workflow.name or "", user.email, "Workflow completed with errors"
        )

    return {"status": workflow.status}
