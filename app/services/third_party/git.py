import re
import shutil
import subprocess
import tempfile
import uuid
from datetime import UTC, datetime
from pathlib import Path

from ...core.config import settings
from ..catalog.utils import _slugify, catalog_owner_segment


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
        """Inject token into Git URL for authentication.
        Works across common providers like GitHub, GitLab, and Gitea.
        """
        url = url.strip()
        effective_token = token or settings.CATALOG_GIT_TOKEN
        if not effective_token:
            return url

        # Only inject if it's a https URL and doesn't already have a token
        if url.startswith("https://") and "@" not in url:
            # For GitLab, oauth2:token is the cleanest way, but token@domain.com
            # is universally supported by GitHub, Gitea, and GitLab.
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

    def _detect_remote_default_branch(self, local_dir: Path) -> str | None:
        """Best-effort: detect remote default branch via HEAD symref."""
        try:
            out = self._run_git(
                ["ls-remote", "--symref", "origin", "HEAD"],
                cwd=local_dir,
            )
            # Example:
            # ref: refs/heads/main    HEAD
            # <sha>\tHEAD
            for line in (out.stdout or "").splitlines():
                line = line.strip()
                if (
                    line.startswith("ref:")
                    and "refs/heads/" in line
                    and line.endswith("HEAD")
                ):
                    ref = line.split()[1]
                    return ref.split("refs/heads/")[-1]
        except Exception:
            return None
        return None

    def push_to_monorepo(
        self,
        local_dir: Path,
        remote_url: str | None = None,
        token: str | None = None,
        branch: str = "main",
        commit_message: str | None = None,
    ) -> dict[str, str | bool | None]:
        """Sync everything under ``local_dir`` to the remote (``local_dir`` is the Git root)."""
        # Always (re)initialize to ensure remote URL/token are up-to-date.
        self.init_repository(local_dir, remote_url, token, branch)

        # If remote has a default branch, prefer pushing to it to avoid "pushed to main
        # but repo default branch is master" confusion.
        effective_branch = self._detect_remote_default_branch(local_dir) or branch
        try:
            self._run_git(["checkout", effective_branch], cwd=local_dir)
        except Exception:
            try:
                self._run_git(["checkout", "-b", effective_branch], cwd=local_dir)
            except Exception:
                effective_branch = branch

        # 1. Add everything, then check if there are changes
        self._run_git(["add", "-A"], cwd=local_dir)
        status = self._run_git(["status", "--porcelain"], cwd=local_dir)

        committed = False
        if status.stdout.strip():
            # 2. Commit with provided message or a default timestamp-based message
            if not commit_message:
                commit_message = (
                    f"FlowO sync {datetime.now(UTC).strftime('%Y-%m-%d %H:%M')}"
                )
            self._run_git(["commit", "-m", commit_message], cwd=local_dir)
            committed = True

        # 3. Always attempt to push (Git will handle if already up-to-date)
        self._run_git(["push", "origin", effective_branch], cwd=local_dir)

        commit_sha: str | None = None
        try:
            head = self._run_git(["rev-parse", "HEAD"], cwd=local_dir)
            commit_sha = (head.stdout or "").strip() or None
        except Exception:
            commit_sha = None

        return {
            "status": "pushed",
            "branch": effective_branch,
            "committed": committed,
            "commit_sha": commit_sha,
        }

    def peek_external_catalog_slugs(
        self,
        remote_url: str,
        token: str | None = None,
        branch: str = "main",
        subdirectory: str | None = None,
        root_slug_override: str | None = None,
    ) -> list[str]:
        """Return catalog slugs that an external Git import would use (no disk writes)."""
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
                if repo_path.exists():
                    shutil.rmtree(repo_path)
                self._run_git(
                    ["clone", "--depth", "1", auth_source_url, str(repo_path)]
                )

            if subdirectory:
                subdir_path = repo_path / subdirectory
                if not subdir_path.exists():
                    raise RuntimeError(
                        f"Subdirectory '{subdirectory}' not found in repository"
                    )
                candidates = self._find_catalog_candidates(subdir_path)
                base_offset = len(Path(subdirectory).parts)
                candidates = [
                    "." if path == "." else str(Path(*Path(path).parts[base_offset:]))
                    for path in candidates
                ]
            else:
                candidates = self._find_catalog_candidates(repo_path)

            slugs: list[str] = []
            override = (root_slug_override or "").strip()
            for rel_path_str in candidates:
                src_path = (
                    repo_path if rel_path_str == "." else repo_path / rel_path_str
                )
                if rel_path_str == "." and override:
                    catalog_slug = _slugify(override)
                else:
                    catalog_slug = self._get_slug(src_path, rel_path_str, remote_url)
                slugs.append(catalog_slug)
            return slugs

    def import_catalogs(
        self,
        target_dir: Path,
        remote_url: str | None = None,
        token: str | None = None,
        branch: str = "main",
        owner: str = "unknown",
        subdirectory: str | None = None,
        layout_owner_id: uuid.UUID | None = None,
        root_slug_override: str | None = None,
    ) -> list[str]:
        """Import or update catalogs.

        Monorepo sync returns **relative paths** under ``target_dir`` for each catalog tree.
        External imports copy into ``target_dir/<owner_segment>/<slug>/`` when
        ``layout_owner_id`` is set (required for non-monorepo imports).
        """
        monorepo_url = settings.CATALOG_GIT_REMOTE

        # 1. If we are syncing from our own monorepo (remote_url is None or matches monorepo)
        if not remote_url or (remote_url == monorepo_url):
            # Only monorepo sync needs target_dir itself to be a Git repository.
            if not (target_dir / ".git").exists():
                self.init_repository(
                    target_dir,
                    remote_url=remote_url,
                    token=token,
                    branch=branch,
                )
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

            # If subdirectory is specified, only scan that specific directory
            if subdirectory:
                subdir_path = repo_path / subdirectory
                if not subdir_path.exists():
                    raise RuntimeError(
                        f"Subdirectory '{subdirectory}' not found in repository"
                    )

                candidates = self._find_catalog_candidates(subdir_path)
                # Adjust relative paths to be relative to the subdirectory
                base_offset = len(Path(subdirectory).parts)
                candidates = [
                    "." if path == "." else str(Path(*Path(path).parts[base_offset:]))
                    for path in candidates
                ]
            else:
                candidates = self._find_catalog_candidates(repo_path)

            if layout_owner_id is None:
                raise RuntimeError(
                    "layout_owner_id is required when importing catalogs from an external Git repository"
                )

            imported_slugs: list[str] = []
            override = (root_slug_override or "").strip()
            for rel_path_str in candidates:
                src_path = (
                    repo_path if rel_path_str == "." else repo_path / rel_path_str
                )
                if rel_path_str == "." and override:
                    catalog_slug = _slugify(override)
                else:
                    catalog_slug = self._get_slug(src_path, rel_path_str, remote_url)

                catalog_target = (
                    target_dir / catalog_owner_segment(layout_owner_id) / catalog_slug
                )
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
        """Return relative path strings (from ``root_dir``) for each catalog directory."""
        candidates = self._find_catalog_candidates(root_dir)
        rel_paths: list[str] = []
        for rel_path_str in candidates:
            if rel_path_str == ".":
                continue
            rel_paths.append(rel_path_str)
        return sorted(set(rel_paths))


# Global singleton
git_service = GitService()
