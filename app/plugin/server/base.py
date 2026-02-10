from typing import Any, TypeVar

from pydantic import BaseModel
from sqlalchemy.orm import Session

T = TypeVar("T", bound=BaseModel)


class BaseEventHandler[T: BaseModel]:
    """Base class for all server-side event handlers."""

    def handle(self, data: T, session: Session, context: dict[str, Any]) -> None:
        """Process the validated event data."""
        raise NotImplementedError
