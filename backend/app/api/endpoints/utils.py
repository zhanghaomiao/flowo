from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.session import get_db
from app.services import WorkflowService

router = APIRouter()


@router.get("/tags", response_model=list[str])
def get_all_tags(db: Session = Depends(get_db)):
    return WorkflowService(db).get_all_tags()
