import re
import shutil
import subprocess
import tempfile
from datetime import UTC, datetime
from pathlib import Path

from ...core.config import settings


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

    def init_repository(
        self,
        local_dir: Path,
        remote_url: str | None = None,
        token: str | None = None,
        branch: str = "main",
    ) -> None:
        """Initialize the local directory as a Git repository pointing to our monorepo."""
        effective_remote = remote_url or settings.CATALOG_GIT_REMOTE
        if not effective_remote:
            raise RuntimeError("Git remote URL is not configured.")

        # Always use the setting's remote, but inject either the provided token or the global setting's token
        effective_token = token or settings.CATALOG_GIT_TOKEN
        auth_url = self._prepare_url(effective_remote, effective_token)

        # 1. Initialize git if not present
        if not (local_dir / ".git").exists():
            self._run_git(["init"], cwd=local_dir)

        # 2. Configure remote origin
        try:
            self._run_git(["remote", "add", "origin", auth_url], cwd=local_dir)
        except Exception:
            self._run_git(["remote", "set-url", "origin", auth_url], cwd=local_dir)

        # 3. Configure bot identity
        self._run_git(["config", "user.email", "flowo@iregene.com"], cwd=local_dir)
        self._run_git(["config", "user.name", "FlowO Bot"], cwd=local_dir)

        # 4. Ensure branch exists
        try:
            self._run_git(["checkout", branch], cwd=local_dir)
        except Exception:
            try:
                self._run_git(["checkout", "-b", branch], cwd=local_dir)
            except Exception:
                pass

        gitignore_path = local_dir / ".gitignore"
        ignore_content = [
            ".snakemake/",
            "__pycache__/",
            "*.pyc",
            ".DS_Store",
        ]
        with open(gitignore_path, "w") as f:
            f.write("\n".join(ignore_content) + "\n")

    def push_to_monorepo(
        self,
        local_dir: Path,
        remote_url: str | None = None,
        token: str | None = None,
        branch: str = "main",
        commit_message: str | None = None,
    ) -> str:
        """Sync everything in the local directory to the monorepo."""
        # Only initialize if it's not already a Git repository
        if not (local_dir / ".git").exists():
            self.init_repository(local_dir, remote_url, token, branch)

        # 1. Add everything, then check if there are changes
        self._run_git(["add", "-A"], cwd=local_dir)
        status = self._run_git(["status", "--porcelain"], cwd=local_dir)

        if status.stdout.strip():
            # 2. Commit with provided message or a default timestamp-based message
            if not commit_message:
                commit_message = (
                    f"FlowO sync {datetime.now(UTC).strftime('%Y-%m-%d %H:%M')}"
                )
            self._run_git(["commit", "-m", commit_message], cwd=local_dir)

        # 3. Always attempt to push (Git will handle if already up-to-date)
        self._run_git(["push", "origin", branch], cwd=local_dir)

        return "pushed"

    def import_catalogs(
        self,
        target_dir: Path,
        remote_url: str | None = None,
        token: str | None = None,
        branch: str = "main",
        owner: str = "unknown",
    ) -> list[str]:
        """Import or update catalogs.
        If remote_url is provided, it imports from that source and copies into the local monorepo folder.
        If remote_url is None, it pulls updates from our monorepo.
        """
        # Only initialize if it's not already a Git repository
        if not (target_dir / ".git").exists():
            self.init_repository(target_dir, token, branch)

        monorepo_url = settings.CATALOG_GIT_REMOTE

        # 1. If we are syncing from our own monorepo (remote_url is None or matches monorepo)
        if not remote_url or (remote_url == monorepo_url):
            self._run_git(["fetch", "origin"], cwd=target_dir)
            self._run_git(["reset", "--hard", f"origin/{branch}"], cwd=target_dir)
            return self._scan_catalogs(target_dir)

        # 2. Importing from a DIFFERENT repository (Source Import)
        auth_source_url = self._prepare_url(remote_url, token)
        with tempfile.TemporaryDirectory() as tmp_dir:
            repo_path = Path(tmp_dir) / "source_repo"
            try:
                self._run_git(
                    [
                        "clone",
                        "--depth",
                        "1",
                        "--branch",
                        branch,
                        auth_source_url,
                        str(repo_path),
                    ]
                )
            except Exception:
                # Retry without branch if branch failed
                if repo_path.exists():
                    shutil.rmtree(repo_path)
                self._run_git(
                    ["clone", "--depth", "1", auth_source_url, str(repo_path)]
                )

            candidates = self._find_catalog_candidates(repo_path)
            imported_slugs = []
            for rel_path_str in candidates:
                src_path = (
                    repo_path if rel_path_str == "." else repo_path / rel_path_str
                )
                catalog_slug = self._get_slug(src_path, rel_path_str, remote_url)

                catalog_target = target_dir / catalog_slug
                if catalog_target.exists():
                    shutil.rmtree(catalog_target)

                shutil.copytree(
                    src_path,
                    catalog_target,
                    ignore=shutil.ignore_patterns(".git"),
                    dirs_exist_ok=True,
                )
                imported_slugs.append(catalog_slug)

            return imported_slugs

    def _find_catalog_candidates(self, repo_path: Path) -> list[str]:
        """Find directories that look like catalogs."""
        candidates = []
        if (repo_path / "workflow" / "Snakefile").exists() or (
            repo_path / "Snakefile"
        ).exists():
            candidates.append(".")

        for d in repo_path.rglob("*"):
            if not d.is_dir() or d.name.startswith("."):
                continue

            rel_d = d.relative_to(repo_path)
            if (d / "workflow" / "Snakefile").exists() or (d / "Snakefile").exists():
                if d.name == "workflow":
                    p = rel_d.parent
                    candidates.append(str(p) if str(p) != "." else ".")
                else:
                    candidates.append(str(rel_d))
        return sorted(set(candidates))

    def _get_slug(self, path: Path, rel_path: str, remote_url: str) -> str:
        """Determine slug from dir name."""
        slug = path.name if rel_path != "." else Path(remote_url).stem
        # Slugify
        slug = slug.lower().strip()
        slug = re.sub(r"[^\w\s-]", "", slug)
        slug = re.sub(r"[\s_]+", "-", slug)
        slug = re.sub(r"-+", "-", slug).strip("-")
        return slug

    def _scan_catalogs(self, root_dir: Path) -> list[str]:
        """Scan a directory for catalogs and return their slugs."""
        candidates = self._find_catalog_candidates(root_dir)
        slugs = []
        for rel_path_str in candidates:
            if rel_path_str == ".":
                continue  # Skip the root of CATALOG_DIR itself

            catalog_path = root_dir / rel_path_str
            slug = self._get_slug(catalog_path, rel_path_str, "")
            slugs.append(slug)
        return slugs


# Global singleton
git_service = GitService()
