"""Ingest Snakemake report events: persist raw row, then run existing registry handlers."""

from __future__ import annotations

import traceback
from datetime import UTC, datetime
from typing import Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from sqlalchemy.orm import Session

from app.models import Workflow, WorkflowEvent
from app.services.reports.dispatch.registry import event_registry


def _resolve_workflow_id(
    event_name: str, record: dict[str, Any], context: dict[str, Any]
) -> UUID | None:
    raw = context.get("current_workflow_id")
    if raw is not None:
        try:
            return UUID(str(raw))
        except (ValueError, TypeError):
            pass
    raw = record.get("workflow_id")
    if raw is not None:
        try:
            return UUID(str(raw))
        except (ValueError, TypeError):
            return None
    return None


def _resolve_persistable_workflow_id(
    db: Session, event_name: str, record: dict[str, Any], context: dict[str, Any]
) -> UUID | None:
    """
    Only persist ``workflow_id`` when the referenced workflow row already exists.

    ``workflow_started`` is intentionally recorded before projection creates the Workflow
    row, so raw event storage must tolerate an unresolved workflow reference.
    """
    workflow_id = _resolve_workflow_id(event_name, record, context)
    if workflow_id is None:
        return None
    return workflow_id if db.get(Workflow, workflow_id) is not None else None


def ingest_report_event(
    db: Session,
    *,
    event_name: str,
    record: dict[str, Any],
    context: dict[str, Any],
    user_id: UUID,
) -> None:
    """
    Insert ``WorkflowEvent`` (pending), run projector inside a savepoint, then set status.

    On projector failure, handler DB changes roll back but the raw event row remains with
    ``status=failed`` and ``error_message`` set, then the exception is re-raised for the API.
    """
    wf_id = _resolve_persistable_workflow_id(db, event_name, record, context)
    row = WorkflowEvent(
        workflow_id=wf_id,
        user_id=user_id,
        event_type=event_name,
        payload_json=jsonable_encoder(record),
        context_json=jsonable_encoder(context),
        source="plugin",
        status="pending",
    )
    db.add(row)
    db.flush()

    try:
        with db.begin_nested():
            event_registry.dispatch(event_name, record, db, context)
    except Exception as e:
        row.status = "failed"
        row.error_message = (f"{type(e).__name__}: {e}\n{traceback.format_exc()}")[
            :8000
        ]
        row.processed_at = datetime.now(UTC)
        # Persist the raw row even though the API will error (outer rollback would drop it).
        db.commit()
        raise

    row.status = "processed"
    row.processed_at = datetime.now(UTC)
