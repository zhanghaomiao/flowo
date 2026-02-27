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


def _parse_dot_to_graph_json(dot_string: str) -> dict[str, Any]:
    """Parse DOT output from 'snakemake --rulegraph' into the same
    {nodes, links} JSON format used by workflow.rulegraph_data.

    Example DOT input:
        digraph snakemake_rulegraph {
            node[style="rounded"];
            0[label = "all", ...];
            1[label = "rule_a", ...];
            0 -> 1;
        }

    Returns:
        {"nodes": [{"rule": "all"}, {"rule": "rule_a"}],
         "links": [{"source": 0, "target": 1,
                     "sourcerule": "all", "targetrule": "rule_a"}]}
    """
    nodes: list[dict[str, str]] = []
    links: list[dict[str, Any]] = []
    id_to_rule: dict[int, str] = {}

    # Match node definitions: 0[label = "all", ...]
    node_pattern = re.compile(r'(\d+)\[label\s*=\s*"([^"]+)"')
    # Match edge definitions: 0 -> 1
    edge_pattern = re.compile(r"(\d+)\s*->\s*(\d+)")

    for line in dot_string.splitlines():
        line = line.strip()

        node_match = node_pattern.search(line)
        if node_match:
            node_id = int(node_match.group(1))
            rule_name = node_match.group(2)
            id_to_rule[node_id] = rule_name
            continue

        edge_match = edge_pattern.search(line)
        if edge_match:
            source_id = int(edge_match.group(1))
            target_id = int(edge_match.group(2))
            links.append(
                {
                    "source": source_id,
                    "target": target_id,
                    "sourcerule": "",  # filled below
                    "targetrule": "",
                }
            )

    # Build nodes list in ID order
    for node_id in sorted(id_to_rule):
        nodes.append({"rule": id_to_rule[node_id]})

    # Fill in rule names for links
    for link in links:
        link["sourcerule"] = id_to_rule.get(link["source"], "")
        link["targetrule"] = id_to_rule.get(link["target"], "")

    return {"nodes": nodes, "links": links}


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

        return {
            **metadata,
            "slug": slug,
            "file_count": 1,
            "has_snakefile": True,
        }

    def get_template(self, slug: str) -> dict[str, Any]:
        """Get template detail with file inventory."""
        template_dir = _get_template_dir()
        template_path = template_dir / slug

        if not template_path.exists():
            raise HTTPException(status_code=404, detail="Template not found")

        meta = _read_metadata(template_path)
        inventory = _get_file_inventory(template_path)

        # Count files
        file_count = sum(len(files) for files in inventory.values())
        has_snakefile = len(inventory.get("snakefile", [])) > 0

        return {
            **meta,
            "slug": slug,
            "files": inventory,
            "file_count": file_count,
            "has_snakefile": has_snakefile,
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
            "content": content,
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
        """Generate DAG data by running snakemake --rulegraph.

        Returns the same {nodes, links} JSON format as workflow.rulegraph_data
        so the frontend can reuse the existing DAG rendering components.
        """
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
                raise HTTPException(
                    status_code=400,
                    detail=result.stderr or "Failed to generate DAG",
                )

            return _parse_dot_to_graph_json(result.stdout)

        except HTTPException:
            raise
        except FileNotFoundError as e:
            raise HTTPException(
                status_code=500,
                detail="snakemake is not installed on the server",
            ) from e
        except subprocess.TimeoutExpired as e:
            raise HTTPException(
                status_code=504,
                detail="DAG generation timed out",
            ) from e

    def git_push(
        self,
        remote_url: str | None = None,
        token: str | None = None,
    ) -> dict[str, str]:
        """Push all templates to a Git remote (monorepo).

        Args:
            remote_url: Override the global TEMPLATE_GIT_REMOTE setting.
            token: Personal access token for private repos.

        Returns the remote URL so the caller can display it as the share link.
        """
        effective_remote = remote_url or settings.TEMPLATE_GIT_REMOTE
        if not effective_remote:
            raise HTTPException(
                status_code=400,
                detail=(
                    "No Git remote configured. "
                    "Set TEMPLATE_GIT_REMOTE or provide a remote_url."
                ),
            )

        template_dir = _get_template_dir()

        try:
            # Initialise repo once
            if not (template_dir / ".git").exists():
                subprocess.run(
                    ["git", "init", "-b", "main"],
                    cwd=str(template_dir),
                    check=True,
                    capture_output=True,
                )
                subprocess.run(
                    ["git", "config", "user.email", "flowo@localhost"],
                    cwd=str(template_dir),
                    check=True,
                    capture_output=True,
                )
                subprocess.run(
                    ["git", "config", "user.name", "FlowO"],
                    cwd=str(template_dir),
                    check=True,
                    capture_output=True,
                )

            # Set (or update) the remote
            built_url = self._build_git_url(effective_remote, token)
            existing = subprocess.run(
                ["git", "remote"],
                cwd=str(template_dir),
                capture_output=True,
                text=True,
            )
            if "origin" in existing.stdout.split():
                subprocess.run(
                    ["git", "remote", "set-url", "origin", built_url],
                    cwd=str(template_dir),
                    check=True,
                    capture_output=True,
                )
            else:
                subprocess.run(
                    ["git", "remote", "add", "origin", built_url],
                    cwd=str(template_dir),
                    check=True,
                    capture_output=True,
                )

            # Ensure .gitignore ignores nothing important
            gitignore = template_dir / ".gitignore"
            if not gitignore.exists():
                gitignore.write_text("# FlowO templates\n")

            subprocess.run(
                ["git", "add", "-A"],
                cwd=str(template_dir),
                check=True,
                capture_output=True,
            )

            status = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=str(template_dir),
                capture_output=True,
                text=True,
            )
            if not status.stdout.strip():
                return {
                    "status": "nothing_to_push",
                    "remote_url": effective_remote,
                }

            subprocess.run(
                [
                    "git",
                    "commit",
                    "-m",
                    f"FlowO sync {datetime.now(UTC).strftime('%Y-%m-%d %H:%M')}",
                ],
                cwd=str(template_dir),
                check=True,
                capture_output=True,
            )
            subprocess.run(
                ["git", "push", "-u", "origin", "main", "--force-with-lease"],
                cwd=str(template_dir),
                check=True,
            )

            return {"status": "pushed", "remote_url": effective_remote}

        except subprocess.CalledProcessError as e:
            stderr = (
                e.stderr.decode() if isinstance(e.stderr, bytes) else (e.stderr or "")
            )
            raise HTTPException(
                status_code=500,
                detail=f"Git push failed: {stderr or str(e)}",
            ) from e

    def git_pull(self) -> dict[str, str]:
        """Pull / clone the configured remote into the template directory."""
        if not settings.TEMPLATE_GIT_REMOTE:
            raise HTTPException(
                status_code=400,
                detail="TEMPLATE_GIT_REMOTE is not configured",
            )

        template_dir = _get_template_dir()
        built_url = self._build_git_url(settings.TEMPLATE_GIT_REMOTE)

        try:
            if not (template_dir / ".git").exists():
                # Clone into a temp dir, then move contents
                with tempfile.TemporaryDirectory() as tmp:
                    subprocess.run(
                        ["git", "clone", built_url, tmp],
                        check=True,
                    )
                    for item in Path(tmp).iterdir():
                        target = template_dir / item.name
                        if target.exists():
                            shutil.rmtree(
                                target
                            ) if target.is_dir() else target.unlink()
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

    def import_from_git(
        self,
        git_url: str,
        token: str | None = None,
        owner: str = "",
    ) -> list[dict[str, Any]]:
        """Clone a Git repository and import each top-level subdirectory
        that looks like a FlowO template (has .flowo.json or workflow/Snakefile).

        Returns a list of imported TemplateSummary dicts.
        """
        built_url = self._build_git_url(git_url, token)
        template_dir = _get_template_dir()
        imported: list[dict[str, Any]] = []

        with tempfile.TemporaryDirectory() as tmp:
            try:
                subprocess.run(
                    ["git", "clone", "--depth", "1", built_url, tmp],
                    check=True,
                    capture_output=True,
                    text=True,
                    timeout=120,
                )
            except subprocess.CalledProcessError as e:
                raise HTTPException(
                    status_code=400,
                    detail=f"Failed to clone repository: {e.stderr or str(e)}",
                ) from e
            except subprocess.TimeoutExpired as e:
                raise HTTPException(
                    status_code=504, detail="Git clone timed out"
                ) from e

            tmp_path = Path(tmp)

            # Collect candidate template directories:
            # 1. root itself (if it has workflow/Snakefile or .flowo.json)
            # 2. top-level subdirectories
            candidates: list[Path] = []

            root_snakefile = tmp_path / "workflow" / "Snakefile"
            root_meta = tmp_path / ".flowo.json"
            if root_snakefile.exists() or root_meta.exists():
                candidates.append(tmp_path)
            else:
                for child in sorted(tmp_path.iterdir()):
                    if child.is_dir() and not child.name.startswith("."):
                        has_snakefile = (child / "workflow" / "Snakefile").exists()
                        has_meta = (child / ".flowo.json").exists()
                        if has_snakefile or has_meta:
                            candidates.append(child)

            if not candidates:
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "No FlowO templates found in the repository. "
                        "Each template directory must contain workflow/Snakefile "
                        "or .flowo.json."
                    ),
                )

            now = datetime.now(UTC).isoformat()
            for candidate in candidates:
                meta = _read_metadata(candidate)
                slug = meta.get("slug") or _slugify(
                    candidate.name if candidate != tmp_path else Path(git_url).stem
                )

                # Handle slug collisions
                target = template_dir / slug
                if target.exists():
                    slug = (
                        f"{slug}-imported-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
                    )
                    target = template_dir / slug

                shutil.copytree(str(candidate), str(target))

                # Ensure metadata is complete
                if not meta:
                    meta = {
                        "name": slug.replace("-", " ").title(),
                        "slug": slug,
                        "description": "",
                        "version": "0.1.0",
                        "owner": owner,
                        "tags": [],
                        "is_public": False,
                        "source_url": git_url,
                        "created_at": now,
                        "updated_at": now,
                    }
                else:
                    meta.setdefault("slug", slug)
                    meta.setdefault("source_url", git_url)
                    meta["updated_at"] = now

                _write_metadata(target, meta)

                inventory = _get_file_inventory(target)
                file_count = sum(len(f) for f in inventory.values())
                has_snakefile = len(inventory.get("snakefile", [])) > 0

                imported.append(
                    {
                        **meta,
                        "slug": slug,
                        "file_count": file_count,
                        "has_snakefile": has_snakefile,
                    }
                )

        return imported

    def _build_git_url(
        self,
        url: str,
        token: str | None = None,
    ) -> str:
        """Build a Git URL with optional token authentication."""
        effective_token = token or settings.TEMPLATE_GIT_TOKEN
        if effective_token and url.startswith("https://"):
            url = url.replace("https://", f"https://{effective_token}@", 1)
        return url
