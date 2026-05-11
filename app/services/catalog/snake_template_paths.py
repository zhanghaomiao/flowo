"""Disk paths for the official Snakemake workflow template (backend settings)."""

from __future__ import annotations

from pathlib import Path

from app.core.config import settings


def snakemake_template_root() -> Path:
    return Path(settings.SNAKEMAKE_WORKFLOW_TEMPLATE_DIR).resolve()
