"""Path helpers that do not read backend-only settings."""

from __future__ import annotations

from pathlib import Path


def user_snakemake_template_root(working_path: str) -> Path:
    """Default official-template checkout dir on a user machine (CLI)."""
    return Path(working_path).resolve() / "snakemake-workflow-template"
