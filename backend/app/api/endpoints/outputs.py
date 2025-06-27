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
