"""
Service for managing Snakemake workflow templates on the local filesystem.

Each template is stored as a directory under TEMPLATE_DIR/<slug>/ with:
  - .flowo.json   (metadata sidecar)
  - workflow/Snakefile  (mandatory)
  - workflow/rules/, envs/, scripts/, notebooks/, report/  (optional, on-demand)
  - config/  (optional)
"""

import json
import re
import shutil
import subprocess
import tarfile
import tempfile
from datetime import UTC, datetime
from io import BytesIO
from pathlib import Path
from typing import Any

from fastapi import HTTPException, UploadFile

from ..core.config import settings

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
    "notebooks": {
        "dir": "workflow/notebooks",
        "required": False,
        "extensions": [".ipynb"],
    },
    "report": {
        "dir": "workflow/report",
        "required": False,
        "extensions": [".rst"],
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
    """Convert a template name to a filesystem-safe slug."""
    slug = name.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


def _get_template_dir() -> Path:
    """Get and ensure the root template directory exists."""
    template_dir = Path(settings.TEMPLATE_DIR)
    template_dir.mkdir(parents=True, exist_ok=True)
    return template_dir


def _read_metadata(template_path: Path) -> dict[str, Any]:
    """Read .flowo.json metadata from a template directory."""
    meta_file = template_path / ".flowo.json"
    if not meta_file.exists():
        return {}
    with open(meta_file) as f:
        return json.load(f)


def _write_metadata(template_path: Path, metadata: dict[str, Any]) -> None:
    """Write .flowo.json metadata to a template directory."""
    meta_file = template_path / ".flowo.json"
    metadata["updated_at"] = datetime.now(UTC).isoformat()
    with open(meta_file, "w") as f:
        json.dump(metadata, f, indent=2, ensure_ascii=False)


def _get_file_inventory(template_path: Path) -> dict[str, list[dict[str, Any]]]:
    """Build a category-based inventory of files in the template."""
    inventory: dict[str, list[dict[str, Any]]] = {}

    for cat_name, cat_info in CATEGORIES.items():
        files: list[dict[str, Any]] = []

        if cat_name == "snakefile":
            snakefile = template_path / "workflow" / "Snakefile"
            if snakefile.exists():
                stat = snakefile.stat()
                content = snakefile.read_text(errors="replace")
                files.append(
                    {
                        "name": "Snakefile",
                        "path": "workflow/Snakefile",
                        "lines": content.count("\n") + 1,
                        "size": stat.st_size,
                        "modified": datetime.fromtimestamp(
                            stat.st_mtime, tz=UTC
                        ).isoformat(),
                    }
                )
        else:
            cat_dir = template_path / cat_info["dir"]
            if cat_dir.exists() and cat_dir.is_dir():
                for f in sorted(cat_dir.iterdir()):
                    if f.is_file() and not f.name.startswith("."):
                        stat = f.stat()
                        try:
                            content = f.read_text(errors="replace")
                            line_count = content.count("\n") + 1
                        except Exception:
                            line_count = 0
                        files.append(
                            {
                                "name": f.name,
                                "path": str(f.relative_to(template_path)),
                                "lines": line_count,
                                "size": stat.st_size,
                                "modified": datetime.fromtimestamp(
                                    stat.st_mtime, tz=UTC
                                ).isoformat(),
                            }
                        )

        inventory[cat_name] = files

    # Also check for README.md
    readme = template_path / "README.md"
    if readme.exists():
        stat = readme.stat()
        content = readme.read_text(errors="replace")
        inventory["readme"] = [
            {
                "name": "README.md",
                "path": "README.md",
                "lines": content.count("\n") + 1,
                "size": stat.st_size,
                "modified": datetime.fromtimestamp(stat.st_mtime, tz=UTC).isoformat(),
            }
        ]
    else:
        inventory["readme"] = []

    return inventory


def _detect_language(file_path: str) -> str:
    """Detect Monaco language from file extension."""
    ext = Path(file_path).suffix
    if Path(file_path).name == "Snakefile":
        return "python"
    return LANG_MAP.get(ext, "plaintext")


def _validate_path(slug: str, file_path: str) -> Path:
    """Validate that the file path is within the template directory (prevent traversal)."""
    template_dir = _get_template_dir()
    template_path = template_dir / slug
    full_path = (template_path / file_path).resolve()

    if not str(full_path).startswith(str(template_path.resolve())):
        raise HTTPException(status_code=400, detail="Invalid file path")

    return full_path


class TemplateService:
    """Service for managing Snakemake workflow templates."""

    def list_templates(
        self,
        search: str | None = None,
        tags: str | None = None,
    ) -> list[dict[str, Any]]:
        """List all templates with optional search/filter."""
        template_dir = _get_template_dir()
        templates = []

        for entry in sorted(template_dir.iterdir()):
            if not entry.is_dir() or entry.name.startswith("."):
                continue

            meta = _read_metadata(entry)
            if not meta:
                continue

            # Search filter
            if search:
                search_lower = search.lower()
                name_match = search_lower in meta.get("name", "").lower()
                desc_match = search_lower in meta.get("description", "").lower()
                if not name_match and not desc_match:
                    continue

            # Tag filter
            if tags:
                request_tags = {t.strip().lower() for t in tags.split(",")}
                template_tags = {t.lower() for t in meta.get("tags", [])}
                if not request_tags & template_tags:
                    continue

            # Count files
            inventory = _get_file_inventory(entry)
            file_count = sum(len(files) for files in inventory.values())
            has_snakefile = len(inventory.get("snakefile", [])) > 0

            templates.append(
                {
                    **meta,
                    "slug": entry.name,
                    "file_count": file_count,
                    "has_snakefile": has_snakefile,
                }
            )

        return templates

    def create_template(
        self,
        name: str,
        description: str = "",
        tags: list[str] | None = None,
        owner: str = "unknown",
    ) -> dict[str, Any]:
        """Create a new template with an empty Snakefile."""
        slug = _slugify(name)
        template_dir = _get_template_dir()
        template_path = template_dir / slug

        if template_path.exists():
            raise HTTPException(
                status_code=409,
                detail=f"Template '{slug}' already exists",
            )

        # Create directory structure
        template_path.mkdir(parents=True)
        workflow_dir = template_path / "workflow"
        workflow_dir.mkdir()

        # Create mandatory Snakefile
        snakefile = workflow_dir / "Snakefile"
        snakefile.write_text(
            '# Snakemake workflow\n\nrule all:\n    input: "results/output.txt"\n'
        )

        # Write metadata
        now = datetime.now(UTC).isoformat()
        metadata = {
            "name": name,
            "slug": slug,
            "description": description,
            "version": "0.1.0",
            "owner": owner,
            "tags": tags or [],
            "is_public": False,
            "source_url": "",
            "created_at": now,
            "updated_at": now,
        }
        _write_metadata(template_path, metadata)

        return {**metadata, "slug": slug}

    def get_template(self, slug: str) -> dict[str, Any]:
        """Get template detail with file inventory."""
        template_dir = _get_template_dir()
        template_path = template_dir / slug

        if not template_path.exists():
            raise HTTPException(status_code=404, detail="Template not found")

        meta = _read_metadata(template_path)
        inventory = _get_file_inventory(template_path)

        return {
            **meta,
            "slug": slug,
            "files": inventory,
            "categories": {
                cat: {
                    "dir": info["dir"],
                    "required": info.get("required", False),
                    "extensions": info.get("extensions", []),
                    "count": len(inventory.get(cat, [])),
                }
                for cat, info in CATEGORIES.items()
            },
        }

    def update_metadata(self, slug: str, data: dict[str, Any]) -> dict[str, Any]:
        """Update template metadata (.flowo.json)."""
        template_dir = _get_template_dir()
        template_path = template_dir / slug

        if not template_path.exists():
            raise HTTPException(status_code=404, detail="Template not found")

        meta = _read_metadata(template_path)
        allowed_keys = {
            "name",
            "description",
            "version",
            "tags",
            "is_public",
            "source_url",
        }
        for key, value in data.items():
            if key in allowed_keys:
                meta[key] = value

        _write_metadata(template_path, meta)
        return meta

    def delete_template(self, slug: str) -> None:
        """Delete a template and all its files."""
        template_dir = _get_template_dir()
        template_path = template_dir / slug

        if not template_path.exists():
            raise HTTPException(status_code=404, detail="Template not found")

        shutil.rmtree(template_path)

    def read_file(self, slug: str, file_path: str) -> dict[str, Any]:
        """Read a file's content from a template."""
        full_path = _validate_path(slug, file_path)

        if not full_path.exists() or not full_path.is_file():
            raise HTTPException(status_code=404, detail="File not found")

        try:
            content = full_path.read_text(errors="replace")
        except Exception as e:
            raise HTTPException(
                status_code=500, detail=f"Error reading file: {e}"
            ) from e

        return {
            "path": file_path,
            "name": full_path.name,
            "content": content,
            "language": _detect_language(file_path),
            "lines": content.count("\n") + 1,
            "size": full_path.stat().st_size,
        }

    def write_file(self, slug: str, file_path: str, content: str) -> dict[str, Any]:
        """Create or update a file in a template. Creates parent dirs on demand."""
        full_path = _validate_path(slug, file_path)

        # Ensure parent directory exists (on-demand creation)
        full_path.parent.mkdir(parents=True, exist_ok=True)

        full_path.write_text(content)

        # Update metadata timestamp
        template_dir = _get_template_dir()
        template_path = template_dir / slug
        meta = _read_metadata(template_path)
        _write_metadata(template_path, meta)

        return {
            "path": file_path,
            "name": full_path.name,
            "language": _detect_language(file_path),
            "lines": content.count("\n") + 1,
            "size": full_path.stat().st_size,
        }

    def delete_file(self, slug: str, file_path: str) -> None:
        """Delete a file from a template. Removes parent dir if empty."""
        full_path = _validate_path(slug, file_path)

        if not full_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        # Prevent deleting the Snakefile
        if file_path == "workflow/Snakefile":
            raise HTTPException(
                status_code=400,
                detail="Cannot delete the mandatory Snakefile",
            )

        full_path.unlink()

        # Remove parent directory if now empty
        parent = full_path.parent
        template_dir = _get_template_dir()
        template_path = template_dir / slug
        if parent != template_path and parent.exists() and not any(parent.iterdir()):
            parent.rmdir()

    def export_archive(self, slug: str) -> BytesIO:
        """Export a template as a .tar.gz archive."""
        template_dir = _get_template_dir()
        template_path = template_dir / slug

        if not template_path.exists():
            raise HTTPException(status_code=404, detail="Template not found")

        buffer = BytesIO()
        with tarfile.open(fileobj=buffer, mode="w:gz") as tar:
            tar.add(str(template_path), arcname=slug)
        buffer.seek(0)
        return buffer

    async def import_archive(
        self, file: UploadFile, owner: str = "unknown"
    ) -> dict[str, Any]:
        """Import a template from a .tar.gz archive."""
        if not file.filename or not file.filename.endswith((".tar.gz", ".tgz")):
            raise HTTPException(
                status_code=400,
                detail="File must be a .tar.gz or .tgz archive",
            )

        with tempfile.TemporaryDirectory() as tmp_dir:
            # Save and extract
            content = await file.read()
            archive_path = Path(tmp_dir) / "upload.tar.gz"
            archive_path.write_bytes(content)

            with tarfile.open(str(archive_path), "r:gz") as tar:
                # Security: check for path traversal
                for member in tar.getmembers():
                    if member.name.startswith("/") or ".." in member.name:
                        raise HTTPException(
                            status_code=400,
                            detail="Archive contains unsafe paths",
                        )
                tar.extractall(tmp_dir)

            # Find the extracted directory
            extracted_dirs = [
                d
                for d in Path(tmp_dir).iterdir()
                if d.is_dir() and d.name != "__MACOSX"
            ]
            if not extracted_dirs:
                raise HTTPException(
                    status_code=400,
                    detail="Archive is empty",
                )

            extracted = extracted_dirs[0]

            # Validate: must contain workflow/Snakefile
            snakefile = extracted / "workflow" / "Snakefile"
            if not snakefile.exists():
                raise HTTPException(
                    status_code=400,
                    detail="Archive must contain workflow/Snakefile",
                )

            # Determine slug
            meta = _read_metadata(extracted)
            slug = meta.get("slug") or _slugify(extracted.name)

            template_dir = _get_template_dir()
            target = template_dir / slug

            if target.exists():
                raise HTTPException(
                    status_code=409,
                    detail=f"Template '{slug}' already exists",
                )

            # Move to templates directory
            shutil.move(str(extracted), str(target))

            # Ensure metadata exists
            if not meta:
                now = datetime.now(UTC).isoformat()
                meta = {
                    "name": slug.replace("-", " ").title(),
                    "slug": slug,
                    "description": "",
                    "version": "0.1.0",
                    "owner": owner,
                    "tags": [],
                    "is_public": False,
                    "source_url": "",
                    "created_at": now,
                    "updated_at": now,
                }
                _write_metadata(target, meta)

        return {**meta, "slug": slug}

    def generate_dag(self, slug: str) -> dict[str, Any]:
        """Generate DAG data by running snakemake --rulegraph."""
        template_dir = _get_template_dir()
        template_path = template_dir / slug
        snakefile = template_path / "workflow" / "Snakefile"

        if not snakefile.exists():
            raise HTTPException(status_code=404, detail="Snakefile not found")

        try:
            result = subprocess.run(
                [
                    "snakemake",
                    "--rulegraph",
                    "-s",
                    str(snakefile),
                    "--directory",
                    str(template_path),
                ],
                capture_output=True,
                text=True,
                timeout=30,
                cwd=str(template_path),
            )

            if result.returncode != 0:
                return {
                    "success": False,
                    "error": result.stderr,
                    "dot": None,
                }

            return {
                "success": True,
                "error": None,
                "dot": result.stdout,
            }

        except FileNotFoundError:
            return {
                "success": False,
                "error": "snakemake is not installed on the server",
                "dot": None,
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "DAG generation timed out",
                "dot": None,
            }

    def git_push(self) -> dict[str, str]:
        """Push all templates to the configured Git remote."""
        if not settings.TEMPLATE_GIT_REMOTE:
            raise HTTPException(
                status_code=400,
                detail="TEMPLATE_GIT_REMOTE is not configured",
            )

        template_dir = _get_template_dir()
        git_dir = template_dir

        try:
            # Initialize git if needed
            if not (git_dir / ".git").exists():
                subprocess.run(["git", "init"], cwd=str(git_dir), check=True)
                remote_url = self._build_git_url()
                subprocess.run(
                    ["git", "remote", "add", "origin", remote_url],
                    cwd=str(git_dir),
                    check=True,
                )

            # Add, commit, push
            subprocess.run(["git", "add", "-A"], cwd=str(git_dir), check=True)

            result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=str(git_dir),
                capture_output=True,
                text=True,
            )
            if not result.stdout.strip():
                return {"status": "nothing to push"}

            subprocess.run(
                [
                    "git",
                    "commit",
                    "-m",
                    f"FlowO template sync {datetime.now(UTC).isoformat()}",
                ],
                cwd=str(git_dir),
                check=True,
            )
            subprocess.run(
                ["git", "push", "-u", "origin", "main"],
                cwd=str(git_dir),
                check=True,
            )

            return {"status": "pushed successfully"}
        except subprocess.CalledProcessError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Git push failed: {e}",
            ) from e

    def git_pull(self) -> dict[str, str]:
        """Pull templates from the configured Git remote."""
        if not settings.TEMPLATE_GIT_REMOTE:
            raise HTTPException(
                status_code=400,
                detail="TEMPLATE_GIT_REMOTE is not configured",
            )

        template_dir = _get_template_dir()

        try:
            if not (template_dir / ".git").exists():
                # Clone fresh
                remote_url = self._build_git_url()
                # Clone into a temp dir, then move contents
                with tempfile.TemporaryDirectory() as tmp:
                    subprocess.run(
                        ["git", "clone", remote_url, tmp],
                        check=True,
                    )
                    # Move .git and all files
                    for item in Path(tmp).iterdir():
                        target = template_dir / item.name
                        if target.exists():
                            if target.is_dir():
                                shutil.rmtree(target)
                            else:
                                target.unlink()
                        shutil.move(str(item), str(target))
            else:
                subprocess.run(
                    ["git", "pull", "origin", "main"],
                    cwd=str(template_dir),
                    check=True,
                )

            return {"status": "pulled successfully"}
        except subprocess.CalledProcessError as e:
            raise HTTPException(
                status_code=500,
                detail=f"Git pull failed: {e}",
            ) from e

    def _build_git_url(self) -> str:
        """Build Git remote URL with optional token auth."""
        url = settings.TEMPLATE_GIT_REMOTE
        if settings.TEMPLATE_GIT_TOKEN and url.startswith("https://"):
            # Insert token: https://TOKEN@github.com/...
            url = url.replace(
                "https://",
                f"https://{settings.TEMPLATE_GIT_TOKEN}@",
            )
        return url
