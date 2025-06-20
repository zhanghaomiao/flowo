from fastapi import APIRouter, Depends
from app.core.session import get_db
from sqlalchemy.orm import Session
from app.services import WorkflowService
from typing import List
from app.schemas import TreeDataNode

router = APIRouter()


@router.get("/{workflow_id}/outputs", response_model=List[TreeDataNode])
def get_outputs(workflow_id: str, max_depth: int = 3, db: Session = Depends(get_db)):
    return WorkflowService(db).get_outputs(workflow_id=workflow_id, max_depth=max_depth)
