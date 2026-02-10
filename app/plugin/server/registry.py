from typing import Any

from sqlalchemy.orm import Session

from ..schemas import (
    ErrorSchema,
    GroupErrorSchema,
    GroupInfoSchema,
    JobErrorSchema,
    JobFinishedSchema,
    JobInfoSchema,
    JobStartedSchema,
    RuleGraphSchema,
    RunInfoSchema,
    WorkflowStartedSchema,
)
from .constants import EventName
from .handlers import (
    ErrorHandler,
    GroupErrorHandler,
    GroupInfoHandler,
    JobErrorHandler,
    JobFinishedHandler,
    JobInfoHandler,
    JobStartedHandler,
    RuleGraphHandler,
    RunInfoHandler,
    WorkflowStartedHandler,
)


class EventRegistry:
    def __init__(self):
        self._registry: dict[str, tuple[type, Any]] = {
            EventName.WORKFLOW_STARTED: (
                WorkflowStartedSchema,
                WorkflowStartedHandler(),
            ),
            EventName.RUN_INFO: (RunInfoSchema, RunInfoHandler()),
            EventName.JOB_INFO: (JobInfoSchema, JobInfoHandler()),
            EventName.JOB_STARTED: (JobStartedSchema, JobStartedHandler()),
            EventName.JOB_FINISHED: (JobFinishedSchema, JobFinishedHandler()),
            EventName.JOB_ERROR: (JobErrorSchema, JobErrorHandler()),
            EventName.RULEGRAPH: (RuleGraphSchema, RuleGraphHandler()),
            EventName.GROUP_INFO: (GroupInfoSchema, GroupInfoHandler()),
            EventName.GROUP_ERROR: (GroupErrorSchema, GroupErrorHandler()),
            EventName.ERROR: (ErrorSchema, ErrorHandler()),
        }

    def dispatch(self, event_name: str, payload: dict, db: Session, context: dict):
        if event_name not in self._registry:
            # Fallback for unknown events, just return context
            return context

        schema_class, handler = self._registry[event_name]

        # 1. Validate data
        validated_data = schema_class.model_validate(payload)

        # 2. Handle event
        handler.handle(validated_data, db, context)

        return context


# Singleton instance
event_registry = EventRegistry()
