"""Clone / pull the official Snakemake workflow template — ships with the logger plugin (no ``app.services``)."""

from __future__ import annotations

import logging
import shutil
import subprocess
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

SNAKEMAKE_WORKFLOW_TEMPLATE_GIT = (
    "https://github.com/snakemake-workflows/snakemake-workflow-template.git"
)


def snakemake_template_root() -> Path:
    """Resolved template checkout directory from plugin settings."""
    from ...core.config import settings

    return Path(settings.SNAKEMAKE_WORKFLOW_TEMPLATE_DIR).resolve()


def git_pull_or_clone_template(root: Path | None = None) -> dict[str, Any]:
    """
    Shallow-clone or ``git pull --ff-only`` the official template into ``root``.

    Default ``root`` is :func:`snakemake_template_root`. Raises :class:`RuntimeError` on git failure.
    """
    root = root or snakemake_template_root()
    root.parent.mkdir(parents=True, exist_ok=True)

    if (root / ".git").exists():
        proc = subprocess.run(
            ["git", "-C", str(root), "pull", "--ff-only"],
            capture_output=True,
            text=True,
            timeout=120,
        )
        action = "pulled"
    else:
        if root.exists():
            shutil.rmtree(root)
        proc = subprocess.run(
            [
                "git",
                "clone",
                "--depth",
                "1",
                SNAKEMAKE_WORKFLOW_TEMPLATE_GIT,
                str(root),
            ],
            capture_output=True,
            text=True,
            timeout=300,
        )
        action = "cloned"

    if proc.returncode != 0:
        err = (proc.stderr or proc.stdout or "").strip() or "git failed"
        logger.error("Snakemake template %s failed: %s", action, err)
        raise RuntimeError(err[:2000])

    return {
        "status": "ok",
        "action": action,
        "path": str(root),
    }
