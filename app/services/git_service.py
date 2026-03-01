import json
import re
import shutil
import subprocess
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from ..core.config import settings


class GitService:
    """Service for Git operations using the system git CLI."""

    def _run_git(
        self, args: list[str], cwd: Path | str | None = None
    ) -> subprocess.CompletedProcess:
        """Run a git command and return the result."""
        try:
            result = subprocess.run(
                ["git"] + args,
                cwd=cwd,
                capture_output=True,
                text=True,
                check=True,
            )
            return result
        except subprocess.CalledProcessError as e:
            # Mask token in error message if present
            error_msg = e.stderr or str(e)
            error_msg = re.sub(r"://[^@]+@", "://****@", error_msg)
            raise RuntimeError(f"Git command failed: {error_msg}") from e

    def _prepare_url(self, url: str, token: str | None = None) -> str:
        """Inject token into GitHub URL for authentication."""
        effective_token = token or settings.CATALOG_GIT_TOKEN
        if not effective_token:
            return url

        # Only inject if it's a https URL and doesn't already have a token
        if url.startswith("https://") and "@" not in url:
            return url.replace("https://", f"https://{effective_token}@")
        return url

    def test_connection(self, url: str, token: str | None = None) -> tuple[bool, str]:
        """Test Git connectivity by attempting to run 'git ls-remote'."""
        auth_url = self._prepare_url(url, token)

        try:
            # We use git ls-remote to check reachability and authentication.
            # This is provider-agnostic.
            result = subprocess.run(
                ["git", "ls-remote", "--symref", auth_url, "HEAD"],
                capture_output=True,
                text=True,
                timeout=15,
            )

            if result.returncode == 0:
                return True, "Connection successful — Git repository reached."

            # Parse error message for common issues
            stderr = result.stderr.lower()
            if "not found" in stderr:
                msg = "Repository not found. Check the URL."
            elif (
                "authentication failed" in stderr
                or "terminal" in stderr
                or "password" in stderr
            ):
                msg = "Authentication failed. Check your token or URL permissions."
            else:
                msg = f"Git operation failed: {result.stderr.strip()[:200]}"

            return False, msg

        except subprocess.TimeoutExpired:
            return False, "Connection timed out (15s)."
        except Exception as e:
            return False, f"Unexpected error: {str(e)}"

    def push_catalogs(
        self,
        local_dir: Path,
        remote_url: str,
        token: str | None = None,
        branch: str = "main",
    ) -> str:
        """Sync a local directory to a GitHub repository using local git CLI."""
        auth_url = self._prepare_url(remote_url, token)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            repo_path = tmp_path / "repo"

            # 1. Clone the repository (bare minimum)
            try:
                self._run_git(
                    [
                        "clone",
                        "--depth",
                        "1",
                        "--branch",
                        branch,
                        auth_url,
                        str(repo_path),
                    ]
                )
            except Exception as e:
                # If branch doesn't exist or repo is empty, try cloning without branch
                if "branch" in str(e) or "not found" in str(e).lower():
                    # Check if repo exists by cloning without branch
                    repo_path.mkdir(parents=True, exist_ok=True)
                    self._run_git(["init"], cwd=repo_path)
                    self._run_git(["remote", "add", "origin", auth_url], cwd=repo_path)
                else:
                    raise

            # 2. Update git config locally for this operation
            self._run_git(["config", "user.email", "flowo@iregene.com"], cwd=repo_path)
            self._run_git(["config", "user.name", "FlowO Bot"], cwd=repo_path)

            # 3. Synchronize files (mirror local_dir to repo_path, excluding ignored)
            ignored_patterns = {
                ".git",
                ".snakemake",
                "__pycache__",
                ".ipynb_checkpoints",
            }

            # Remove existing files in repo (except .git)
            for item in repo_path.iterdir():
                if item.name == ".git":
                    continue
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()

            # Copy files from local_dir
            for item in local_dir.iterdir():
                if item.name in ignored_patterns:
                    continue

                dest = repo_path / item.name
                if item.is_dir():
                    shutil.copytree(
                        item, dest, ignore=shutil.ignore_patterns(*ignored_patterns)
                    )
                else:
                    shutil.copy2(item, dest)

            # 4. Add, commit and push
            self._run_git(["add", "-A"], cwd=repo_path)

            # Check if there are changes
            status = self._run_git(["status", "--porcelain"], cwd=repo_path)
            if not status.stdout.strip():
                return "nothing_to_push"

            sync_msg = f"FlowO sync {datetime.now(UTC).strftime('%Y-%m-%d %H:%M')}"
            self._run_git(["commit", "-m", sync_msg], cwd=repo_path)

            # Push (force might be needed if history diverges, but we used depth 1)
            self._run_git(["push", "origin", branch], cwd=repo_path)

            return "pushed"

    def import_catalogs(
        self,
        remote_url: str,
        target_dir: Path,
        token: str | None = None,
        branch: str = "main",
        owner: str = "unknown",
    ) -> list[str]:
        """Import catalogs from a GitHub repository using local git CLI."""
        auth_url = self._prepare_url(remote_url, token)

        with tempfile.TemporaryDirectory() as tmp_dir:
            tmp_path = Path(tmp_dir)
            repo_path = tmp_path / "repo"

            # 1. Clone
            try:
                self._run_git(
                    [
                        "clone",
                        "--depth",
                        "1",
                        "--branch",
                        branch,
                        auth_url,
                        str(repo_path),
                    ]
                )
            except Exception as e:
                # If branch doesn't exist, try cloning without a specific branch (default branch)
                if "branch" in str(e).lower() or "not found" in str(e).lower():
                    if repo_path.exists():
                        shutil.rmtree(repo_path)
                    self._run_git(["clone", "--depth", "1", auth_url, str(repo_path)])
                else:
                    raise

            # 2. Identify candidate catalog directories
            # We look for directories containing .flowo.json or workflow/Snakefile
            candidates = []

            # Check root
            if (
                (repo_path / ".flowo.json").exists()
                or (repo_path / "workflow" / "Snakefile").exists()
                or (repo_path / "Snakefile").exists()
            ):
                candidates.append(".")

            # Check subdirectories recursively
            for d in repo_path.rglob("*"):
                if not d.is_dir() or d.name.startswith("."):
                    continue

                rel_d = d.relative_to(repo_path)
                if (d / ".flowo.json").exists():
                    candidates.append(str(rel_d))
                elif (d / "workflow" / "Snakefile").exists() or (
                    d / "Snakefile"
                ).exists():
                    # If this is a 'workflow' dir, the candidate is the parent
                    if d.name == "workflow":
                        p = rel_d.parent
                        candidates.append(str(p) if str(p) != "." else ".")
                    else:
                        candidates.append(str(rel_d))

            # Deduplicate and normalize
            candidates = sorted(set(candidates))

            # Slugify helper (matching workflow_catalog)
            def _slugify(name: str) -> str:
                slug = name.lower().strip()
                slug = re.sub(r"[^\w\s-]", "", slug)
                slug = re.sub(r"[\s_]+", "-", slug)
                slug = re.sub(r"-+", "-", slug).strip("-")
                return slug

            imported_slugs = []

            for rel_path_str in candidates:
                src_path = (
                    repo_path if rel_path_str == "." else repo_path / rel_path_str
                )

                # Determine slug from .flowo.json or dir name
                catalog_slug = None
                meta_file = src_path / ".flowo.json"
                if meta_file.exists():
                    try:
                        with open(meta_file) as f:
                            meta_json = json.load(f)
                            catalog_slug = meta_json.get("slug")
                    except Exception:
                        pass

                if not catalog_slug:
                    catalog_slug = (
                        src_path.name if rel_path_str != "." else Path(remote_url).stem
                    )
                    catalog_slug = _slugify(catalog_slug)

                # Ensure unique target dir
                catalog_target = target_dir / catalog_slug
                if catalog_target.exists():
                    catalog_target = (
                        target_dir
                        / f"{catalog_slug}-imported-{datetime.now(UTC).strftime('%Y%m%d%H%M%S')}"
                    )

                # Copy catalog content
                catalog_target.mkdir(parents=True, exist_ok=True)

                # We need to be careful what we copy - essentially everything in src_path
                # except .git and other candidates (if they are nested, but our candidate search usually finds roots)
                ignored_in_copy = {".git"}

                for item in src_path.iterdir():
                    if item.name in ignored_in_copy:
                        continue

                    dest = catalog_target / item.name
                    if item.is_dir():
                        shutil.copytree(
                            item, dest, ignore=shutil.ignore_patterns(".git")
                        )
                    else:
                        shutil.copy2(item, dest)

                # Ensure .flowo.json exists with correct slug and owner
                meta = {}
                if meta_file.exists():
                    try:
                        with open(catalog_target / ".flowo.json") as f:
                            meta = json.load(f)
                    except Exception:
                        pass

                if (
                    not meta
                    or meta.get("slug") != catalog_slug
                    or meta.get("owner") != owner
                ):
                    meta.update(
                        {
                            "name": meta.get("name")
                            or catalog_slug.replace("-", " ").title(),
                            "slug": catalog_slug,
                            "owner": owner,
                            "updated_at": datetime.now(UTC).isoformat(),
                        }
                    )
                    if "created_at" not in meta:
                        meta["created_at"] = meta["updated_at"]

                    with open(catalog_target / ".flowo.json", "w") as f:
                        json.dump(meta, f, indent=2, ensure_ascii=False)

                imported_slugs.append(catalog_slug)

        return imported_slugs


# Global singleton
git_service = GitService()
