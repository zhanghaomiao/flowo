import json
import re
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import UserSettings

# Snakemake category → relative directory mapping
CATEGORIES: dict[str, dict[str, Any]] = {
    "snakefile": {
        "dir": "workflow",
        "file": "Snakefile",
        "required": True,
        "extensions": [],
    },
    "rules": {
        "dir": "workflow/rules",
        "required": False,
        "extensions": [".smk"],
    },
    "envs": {
        "dir": "workflow/envs",
        "required": False,
        "extensions": [".yaml", ".yml"],
    },
    "scripts": {
        "dir": "workflow/scripts",
        "required": False,
        "extensions": [".py", ".R", ".r", ".sh", ".pl"],
    },
    "report": {
        "dir": "workflow/report",
        "required": False,
        "extensions": [".rst"],
    },
    "notebooks": {
        "dir": "workflow/notebooks",
        "required": False,
        "extensions": [".ipynb"],
    },
    "error": {
        "dir": "logs",
        "required": False,
        "extensions": [".log"],
    },
    "config": {
        "dir": "config",
        "required": False,
        "extensions": [".yaml", ".yml", ".tsv", ".json"],
    },
}

# Language detection from file extension
LANG_MAP: dict[str, str] = {
    ".py": "python",
    ".smk": "python",
    ".R": "r",
    ".r": "r",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".json": "json",
    ".sh": "shell",
    ".rst": "restructuredtext",
    ".md": "markdown",
    ".tsv": "plaintext",
    ".pl": "perl",
}


def _slugify(name: str) -> str:
    """Convert a catalog name to a filesystem-safe slug."""
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def _get_catalog_dir() -> Path:
    """Get and ensure the root catalog directory exists."""
    catalog_dir = Path(settings.CATALOG_DIR)
    catalog_dir.mkdir(parents=True, exist_ok=True)
    return catalog_dir


def _read_metadata(catalog_path: Path) -> dict[str, Any]:
    """Read .flowo.json metadata from a catalog directory."""
    meta_file = catalog_path / ".flowo.json"
    if not meta_file.exists():
        return {}
    with open(meta_file) as f:
        return json.load(f)


def _write_metadata(catalog_path: Path, metadata: dict[str, Any]) -> None:
    """Write .flowo.json metadata to a catalog directory."""
    meta_file = catalog_path / ".flowo.json"
    metadata["updated_at"] = datetime.now(UTC).isoformat()
    with open(meta_file, "w") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)


def _get_file_inventory(catalog_path: Path) -> list[dict[str, Any]]:
    """Build a recursive inventory of all files in the catalog."""
    files: list[dict[str, Any]] = []

    # Walk through all files and directories in the catalog
    for f in sorted(catalog_path.rglob("*")):
        if f.name == ".flowo.json" or f.name.startswith("."):
            continue

        rel_path = str(f.relative_to(catalog_path))

        if f.is_dir():
            files.append(
                {
                    "name": f.name,
                    "path": rel_path,
                    "is_dir": True,
                    "lines": 0,
                    "size": 0,
                    "modified": datetime.fromtimestamp(
                        f.stat().st_mtime, tz=UTC
                    ).isoformat(),
                    "language": None,
                }
            )
            continue

        if not f.is_file():
            continue

        stat = f.stat()
        try:
            # We only read the first few lines to count, or just count \n
            # Reading the whole file might be expensive for large files, but catalogs are usually small
            content = f.read_text(errors="replace")
            line_count = content.count("\n") + 1
        except Exception:
            line_count = 0

        files.append(
            {
                "name": f.name,
                "path": rel_path,
                "is_dir": False,
                "lines": line_count,
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime, tz=UTC).isoformat(),
                "language": _detect_language(rel_path),
            }
        )

    return files


def _detect_language(file_path: str) -> str:
    """Detect Monaco language from file extension or name."""
    p = Path(file_path)
    if p.name == "Snakefile":
        return "python"
    ext = p.suffix
    return LANG_MAP.get(ext, "plaintext")


def _validate_path(slug: str, file_path: str) -> Path:
    """Validate that the path is within the catalog directory (prevent traversal)."""
    catalog_dir = _get_catalog_dir()
    catalog_path = catalog_dir / slug

    # Handle empty path (root)
    if not file_path or file_path == ".":
        return catalog_path.resolve()

    full_path = (catalog_path / file_path).resolve()

    if not str(full_path).startswith(str(catalog_path.resolve())):
        raise HTTPException(status_code=400, detail="Invalid path")

    return full_path


# --- Global state for sync throttling ---
_LAST_SYNC_TIME: float = 0
SYNC_THROTTLE_SECONDS = 30  # Don't sync more than once every 30s


async def _is_git_configured(session: AsyncSession, user_id: uuid.UUID | None) -> bool:
    """Check if Git is configured globally or for the specific user."""
    if settings.CATALOG_GIT_REMOTE:
        return True
    if not user_id:
        return False

    result = await session.execute(
        select(UserSettings).where(UserSettings.user_id == user_id)
    )
    user_settings = result.scalar_one_or_none()
    return bool(user_settings and user_settings.git_remote_url)
