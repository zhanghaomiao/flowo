"""Built-in Snakemake workflow template (official repo), separate from user catalogs."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from app.plugin.client.template_local import (
    git_pull_or_clone_template,
    snakemake_template_root,
)
from app.services.catalog.utils import _get_file_inventory

logger = logging.getLogger(__name__)


def _resolve_safe_path(rel_path: str) -> Path:
    root = snakemake_template_root().resolve()
    rel = (rel_path or "").strip().replace("\\", "/").lstrip("/")
    if not rel or ".." in rel.split("/"):
        raise HTTPException(status_code=400, detail="Invalid path")
    full = (root / rel).resolve()
    if not str(full).startswith(str(root)):
        raise HTTPException(status_code=400, detail="Invalid path")
    return full


def pull_snakemake_workflow_template() -> dict[str, Any]:
    """Shallow-clone or ``git pull`` the official template into ``SNAKEMAKE_WORKFLOW_TEMPLATE_DIR``."""
    try:
        return git_pull_or_clone_template()
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


def pull_snakemake_workflow_template_cli() -> dict[str, Any]:
    """Clone/pull like :func:`pull_snakemake_workflow_template` but raise ``RuntimeError`` for CLI."""
    return git_pull_or_clone_template()


def template_status() -> dict[str, Any]:
    from app.services.catalog.snake_template_storage import template_status_sync

    return template_status_sync()


def ensure_snakemake_workflow_template_on_startup() -> None:
    """
    If the official template checkout is missing or has no ``workflow/`` tree,
    shallow-clone or ``git pull --ff-only`` once (same semantics as the UI
    "Pull / update" action). Skips entirely when already valid so restarts do
    not touch a good checkout. Never raises; logs a warning on failure so the
    app can still start (e.g. offline or GitHub unreachable).
    """
    if template_status()["ready"]:
        return
    try:
        git_pull_or_clone_template()
    except RuntimeError as exc:
        logger.warning(
            "Snakemake workflow template could not be prepared on startup "
            "(GET /catalog/snake-template may show ready=false; use Pull / update "
            "or pre-populate SNAKEMAKE_WORKFLOW_TEMPLATE_DIR): %s",
            exc,
        )
    except OSError as exc:
        logger.warning(
            "Snakemake workflow template could not be prepared on startup: %s",
            exc,
        )


def template_inventory() -> list[dict[str, Any]]:
    root = snakemake_template_root()
    if not root.is_dir():
        return []
    return _get_file_inventory(root, include_dotfiles=True)


def read_template_file(rel_path: str) -> dict[str, Any]:
    p = _resolve_safe_path(rel_path)
    if not p.exists() or not p.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    content = p.read_text(encoding="utf-8", errors="replace")
    return {
        "path": rel_path.replace("\\", "/"),
        "name": p.name,
        "content": content,
        "size": p.stat().st_size,
        "lines": content.count("\n") + 1,
    }


def write_template_file(rel_path: str, content: str) -> dict[str, Any]:
    """Overwrite a file under the template tree (local reference copy, not user catalogs)."""
    p = _resolve_safe_path(rel_path)
    if p.exists() and p.is_dir():
        raise HTTPException(status_code=400, detail="Path is a directory")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return read_template_file(rel_path)
