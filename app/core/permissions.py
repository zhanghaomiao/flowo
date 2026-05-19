import uuid
from typing import Any

from fastapi import HTTPException
from sqlalchemy import or_, true

from app.models import Catalog, User, Workflow

DEMO_READ_ONLY_MESSAGE = "Demo account is read-only."
ROLE_VIEWER = "viewer"
ROLE_USER = "user"
ROLE_ADMIN = "admin"


def user_role(user: User | None) -> str:
    if user is None:
        return ROLE_USER
    role = getattr(user, "role", None) or ROLE_USER
    if getattr(user, "is_superuser", False):
        return ROLE_ADMIN
    return role


def is_viewer(user: User | None) -> bool:
    return user_role(user) == ROLE_VIEWER


def is_admin(user: User | None) -> bool:
    return user_role(user) == ROLE_ADMIN


def require_not_viewer(user: User) -> None:
    if is_viewer(user):
        raise HTTPException(status_code=403, detail=DEMO_READ_ONLY_MESSAGE)


def can_read_workflow(user: User, workflow: Workflow | None) -> bool:
    if workflow is None:
        return False
    if is_admin(user):
        return True
    return workflow.user_id == user.id


def can_write_workflow(user: User, workflow: Workflow | None) -> bool:
    if workflow is None or is_viewer(user):
        return False
    return is_admin(user) or workflow.user_id == user.id


def can_read_catalog(user: User, catalog: Catalog | None) -> bool:
    if catalog is None:
        return False
    if is_admin(user):
        return True
    if is_viewer(user):
        return bool(catalog.is_public)
    return (
        bool(catalog.is_public)
        or catalog.owner_id is None
        or catalog.owner_id == user.id
    )


def can_write_catalog(user: User, catalog: Catalog | None) -> bool:
    if catalog is None or is_viewer(user):
        return False
    return is_admin(user) or catalog.owner_id is None or catalog.owner_id == user.id


def assert_workflow_readable(workflow: Workflow | None, user: User) -> Workflow:
    if not can_read_workflow(user, workflow):
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


def assert_workflow_writable(workflow: Workflow | None, user: User) -> Workflow:
    if workflow is None:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if is_viewer(user):
        raise HTTPException(status_code=403, detail=DEMO_READ_ONLY_MESSAGE)
    if not can_write_workflow(user, workflow):
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


def assert_catalog_readable_for_user(catalog: Catalog | None, user: User) -> Catalog:
    if not can_read_catalog(user, catalog):
        raise HTTPException(status_code=404, detail="Catalog not found")
    return catalog


def assert_catalog_writable_for_user(catalog: Catalog | None, user: User) -> Catalog:
    if catalog is None:
        raise HTTPException(status_code=404, detail="Catalog not found")
    if is_viewer(user):
        raise HTTPException(status_code=403, detail=DEMO_READ_ONLY_MESSAGE)
    if not can_write_catalog(user, catalog):
        raise HTTPException(
            status_code=403,
            detail="Not allowed to modify this catalog",
        )
    return catalog


def workflow_read_filter(user: User) -> Any:
    if is_admin(user):
        return true()
    return Workflow.user_id == user.id


def catalog_read_filter(user: User) -> Any:
    if is_admin(user):
        return true()
    if is_viewer(user):
        return Catalog.is_public.is_(True)
    return or_(
        Catalog.is_public.is_(True),
        Catalog.owner_id == user.id,
        Catalog.owner_id.is_(None),
    )


def readable_user_id_for_legacy_scope(user: User) -> uuid.UUID | None:
    return None if is_admin(user) else user.id
