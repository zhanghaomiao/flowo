"""Report event dispatch: validate payloads and persist via SQLAlchemy handlers."""

from app.services.reports.dispatch.registry import event_registry

__all__ = ["event_registry"]
