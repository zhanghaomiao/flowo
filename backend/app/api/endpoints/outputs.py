import uuid
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.session import get_db
from app.schemas import TreeDataNode
from app.services import WorkflowService

router = APIRouter()


@router.get("/{workflow_id}/outputs", response_model=list[TreeDataNode])
def get_outputs(
    workflow_id: uuid.UUID, max_depth: int = 3, db: Session = Depends(get_db)
):
    return WorkflowService(db).get_outputs(workflow_id=workflow_id, max_depth=max_depth)


@router.get("/{workflow_id}/rule_outputs", response_model=list[str])
def get_job_outputs(
    workflow_id: uuid.UUID, rule_name: str, db: Session = Depends(get_db)
):
    return WorkflowService(db).get_rule_outputs(
        workflow_id=workflow_id, rule_name=rule_name
    )
