"""Shallow-clone / pull the official Snakemake workflow template (no backend settings)."""

from __future__ import annotations

import logging
import shutil
import subprocess
from pathlib import Path

logger = logging.getLogger(__name__)

SNAKEMAKE_WORKFLOW_TEMPLATE_GIT = (
    "https://github.com/snakemake-workflows/snakemake-workflow-template.git"
)


def ensure_template(root: Path, upstream: str) -> Path:
    """
    Shallow-clone or ``git pull --ff-only`` into ``root``.

    ``root`` must be the intended checkout directory (not its parent).
    Returns ``root`` on success. Raises :class:`RuntimeError` on git failure.
    """
    root = root.resolve()
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
                upstream,
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

    return root
