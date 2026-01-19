import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.session import get_db
from app.services import WorkflowService

router = APIRouter()


@router.get("/{workflow_id}/rule_outputs", response_model=list[str])
def get_job_outputs(
    workflow_id: uuid.UUID, rule_name: str, db: Session = Depends(get_db)
):
    return WorkflowService(db).get_rule_outputs(
        workflow_id=workflow_id, rule_name=rule_name
    )
