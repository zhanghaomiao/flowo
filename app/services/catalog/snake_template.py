"""Built-in Snakemake workflow template (official repo), separate from user catalogs."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from fastapi import HTTPException

from app.plugin.client.template_local import (
    SNAKEMAKE_WORKFLOW_TEMPLATE_GIT,
    git_pull_or_clone_template,
    snakemake_template_root,
)
from app.services.catalog.utils import _get_file_inventory


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
    root = snakemake_template_root()
    ready = root.is_dir() and (root / "workflow").is_dir()
    return {
        "ready": ready,
        "path": str(root),
        "upstream": SNAKEMAKE_WORKFLOW_TEMPLATE_GIT,
    }


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
