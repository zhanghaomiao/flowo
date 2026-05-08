"""Filesystem layout for per-user catalog isolation."""

from __future__ import annotations

import uuid
from pathlib import Path

from app.core.config import settings


def catalog_owner_segment(owner_id: uuid.UUID | None) -> str:
    """Top-level directory under CATALOG_*: full owner UUID, or ``_unowned``."""
    return str(owner_id) if owner_id is not None else "_unowned"


def catalog_owner_workspace_root(owner_id: uuid.UUID) -> Path:
    """Directory holding one user's catalogs: ``CATALOG_DIR/<owner_id>/`` (parent of each slug dir)."""
    return Path(settings.CATALOG_DIR) / str(owner_id)


def catalog_data_dir(owner_id: uuid.UUID | None, slug: str) -> Path:
    """On-disk catalog workspace: CATALOG_DIR/<owner_id>/<slug>."""
    return Path(settings.CATALOG_DIR) / catalog_owner_segment(owner_id) / slug


def catalog_export_dir(owner_id: uuid.UUID | None, slug: str) -> Path:
    """Read-only export cache for DAG tooling."""
    return Path(settings.CATALOG_EXPORT_DIR) / catalog_owner_segment(owner_id) / slug
