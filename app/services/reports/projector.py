"""Projection entrypoint; currently delegates to ``event_registry`` (see ``service.py``)."""

from __future__ import annotations

# Intentionally thin: handlers live under app.services.reports.dispatch.handlers and may be
# renamed to *Projector incrementally without changing the ingest transaction shape.
