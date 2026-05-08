"""Catalog visibility and mutation rules (aligned with list_catalogs filters)."""

from __future__ import annotations

import uuid

from fastapi import HTTPException

from app.models.catalog import Catalog


def assert_catalog_readable(cat: Catalog, user_id: uuid.UUID | None) -> None:
    """Allow read when catalog is public, has no owner_id, or is owned by the caller."""
    if cat.is_public:
        return
    if cat.owner_id is None:
        return
    if user_id is not None and cat.owner_id == user_id:
        return
    raise HTTPException(status_code=403, detail="Not allowed to access this catalog")


def assert_catalog_writable(cat: Catalog, user_id: uuid.UUID | None) -> None:
    """Allow writes for the owner, or for catalogs with no owner_id (shared)."""
    if user_id is None:
        raise HTTPException(
            status_code=401, detail="Authentication required to modify catalogs"
        )
    if cat.owner_id is None:
        return
    if cat.owner_id == user_id:
        return
    raise HTTPException(status_code=403, detail="Not allowed to modify this catalog")
