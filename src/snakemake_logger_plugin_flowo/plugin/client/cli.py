import argparse
import json
import logging
import os
import shutil
import tarfile
import time
import webbrowser
import zipfile
from fnmatch import fnmatch
from pathlib import Path
from urllib.parse import urljoin

import httpx
from tqdm import tqdm

from flowo_common.config import get_client_settings
from flowo_common.paths import user_snakemake_template_root
from flowo_common.token_config import write_user_config

logger = logging.getLogger("snakemake.flowo")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO, format="%(message)s")


def pull_catalog(slug: str | None = None, path: str = "."):
    """Download catalog ZIP and unpack it. Supports in-place sync if run inside a catalog dir."""
    cs = get_client_settings()
    host = cs.FLOWO_HOST
    token = cs.FLOWO_USER_TOKEN

    if not token:
        logger.error("❌ No API token found. Run: flowo login --host <your-flowo-host>")
        return

    target_dir = Path(path).resolve()
    flowo_json_path = target_dir / ".flowo.json"
    is_inplace = False

    # 1. Try to detect slug from local metadata if not provided
    if not slug and flowo_json_path.exists():
        try:
            with open(flowo_json_path, encoding="utf-8") as f:
                meta = json.load(f)
                slug = meta.get("slug")
                if slug:
                    is_inplace = True
                    logger.info(
                        f"🔄 Detected catalog '{slug}' in current directory. Syncing in-place..."
                    )
        except Exception as e:
            logger.warning(f"⚠️ Could not parse .flowo.json: {e}")

    if not slug:
        logger.error(
            "❌ Catalog slug is required if not running inside a catalog directory."
        )
        return

    headers = {"Authorization": f"Bearer {token}"}
    try:
        zip_path = Path(f"catalog_{slug}.zip")
        # Download ZIP with progress
        with httpx.Client(timeout=300.0) as client:
            with client.stream(
                "GET",
                f"{host}/api/v1/catalog/{slug}/download?format=zip",
                headers=headers,
            ) as response:
                if response.status_code != 200:
                    response.read()
                    logger.error(f"❌ Failed to download catalog: {response.text}")
                    return

                total_size = int(response.headers.get("Content-Length", 0))

                with (
                    open(zip_path, "wb") as f,
                    tqdm(
                        desc=f"Downloading {slug}",
                        total=total_size,
                        unit="iB",
                        unit_scale=True,
                        unit_divisor=1024,
                    ) as bar,
                ):
                    for chunk in response.iter_bytes(chunk_size=8192):
                        size = f.write(chunk)
                        bar.update(size)

            # 2. Determine expansion directory
            if is_inplace:
                extract_dir = target_dir
            else:
                extract_dir = target_dir / slug
                extract_dir.mkdir(parents=True, exist_ok=True)

            # 3. Automatically unpack
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(extract_dir)

            zip_path.unlink()
            if is_inplace:
                logger.info(
                    f"✅ Catalog '{slug}' synchronized successfully in {extract_dir}"
                )
            else:
                logger.info(f"✅ Catalog '{slug}' pulled and unpacked at {extract_dir}")

    except Exception as e:
        logger.error(f"❌ Error pulling catalog: {str(e)}")


def _get_ignore_patterns(source_dir: Path) -> list[str]:
    """Load ignore patterns from .flowoignore and .gitignore."""
    patterns = []
    # 1. Try .flowoignore first
    flowoignore = source_dir / ".flowoignore"
    if flowoignore.exists():
        with open(flowoignore, encoding="utf-8") as f:
            patterns.extend(
                [
                    line.strip()
                    for line in f
                    if line.strip() and not line.startswith("#")
                ]
            )

    # 2. Also try .gitignore if it exists
    gitignore = source_dir / ".gitignore"
    if gitignore.exists():
        with open(gitignore, encoding="utf-8") as f:
            patterns.extend(
                [
                    line.strip()
                    for line in f
                    if line.strip() and not line.startswith("#")
                ]
            )
    return list(set(patterns))


def create_catalog_zip(
    source_dir: Path, zip_path: Path, extra_excludes: list[str] = None
):
    """Create a ZIP archive of the catalog directory, excluding unwanted files."""
    default_excludes = [
        ".snakemake",
        ".git",
        "__pycache__",
        "*.pyc",
        ".DS_Store",
        ".ipynb_checkpoints",
        "node_modules",
        "results",
        "logs",
        "benchmarks",
        "resources",
        "output",
        ".pytest_cache",
    ]
    file_ignores = _get_ignore_patterns(source_dir)
    all_excludes = default_excludes + file_ignores + (extra_excludes or [])

    source_dir = source_dir.resolve()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            # Filter directories
            dirs[:] = [
                d
                for d in dirs
                if not any(fnmatch(d, p.rstrip("/")) for p in all_excludes)
            ]

            for file in files:
                if any(fnmatch(file, p) for p in all_excludes):
                    continue

                file_path = Path(root) / file
                rel_path = file_path.relative_to(source_dir)
                zipf.write(file_path, rel_path)


def create_catalog_tar_gz(
    source_dir: Path,
    slug: str,
    tgz_path: Path,
    extra_excludes: list[str] | None = None,
) -> None:
    """Tar.gz for ``POST /api/v1/catalog/upload`` — one top-level directory ``{slug}/``."""
    default_excludes = [
        ".snakemake",
        ".git",
        "__pycache__",
        "*.pyc",
        ".DS_Store",
        ".ipynb_checkpoints",
        "node_modules",
        "results",
        "logs",
        "benchmarks",
        "resources",
        "output",
        ".pytest_cache",
    ]
    file_ignores = _get_ignore_patterns(source_dir)
    all_excludes = default_excludes + file_ignores + (extra_excludes or [])

    source_dir = source_dir.resolve()
    with tarfile.open(tgz_path, "w:gz") as tf:
        for root, dirs, files in os.walk(source_dir):
            dirs[:] = [
                d
                for d in dirs
                if not any(fnmatch(d, p.rstrip("/")) for p in all_excludes)
            ]
            for file in files:
                if any(fnmatch(file, p) for p in all_excludes):
                    continue
                file_path = Path(root) / file
                rel_path = file_path.relative_to(source_dir)
                arcname = f"{slug}/{rel_path.as_posix()}"
                tf.add(file_path, arcname=arcname, recursive=False)


def upload_catalog(
    catalog_dir_path: str,
    token: str = None,
    host: str = None,
    exclude: list[str] = None,
):
    """Pack and upload a catalog to the Flowo platform via API."""
    catalog_dir = Path(catalog_dir_path).resolve()
    flowo_json_path = catalog_dir / ".flowo.json"

    if not catalog_dir.exists():
        logger.error(f"❌ Path {catalog_dir} does not exist.")
        return
    if not flowo_json_path.exists():
        logger.error(f"❌ '{flowo_json_path.name}' not found in {catalog_dir}.")
        logger.error(
            'Example: {"name": "My Catalog", "slug": "my-catalog", "version": "0.1.0"}'
        )
        return

    try:
        with open(flowo_json_path, encoding="utf-8") as f:
            meta = json.load(f)
            slug = meta.get("slug")
            if not slug:
                logger.error("❌ 'slug' field is missing in .flowo.json")
                return
    except Exception as e:
        logger.error(f"❌ Failed to parse .flowo.json: {e}")
        return

    # Get credentials from args, env, or config
    cs = get_client_settings()
    token = token or os.environ.get("FLOWO_USER_TOKEN") or cs.FLOWO_USER_TOKEN
    host = host or os.environ.get("FLOWO_HOST") or cs.FLOWO_HOST

    if not token:
        logger.error("❌ Token not found. Run `flowo login --host <url>` first.")
        return
    if not host:
        logger.error("❌ Host not found. Set FLOWO_HOST env var or use --host.")
        return

    headers = {"Authorization": f"Bearer {token}"}
    try:
        import tempfile

        with tempfile.TemporaryDirectory() as tmp_dir:
            zip_base = Path(tmp_dir) / f"catalog_{slug}_upload.zip"
            create_catalog_zip(catalog_dir, zip_base, exclude)

            logger.info(f"📦 Uploading catalog '{slug}'…")
            with httpx.Client(timeout=300.0) as client:
                with open(zip_base, "rb") as f:
                    response = client.post(
                        f"{host}/api/v1/catalog/{slug}/sync",
                        headers=headers,
                        files={
                            "file": (zip_base.name, f, "application/zip"),
                        },
                    )

                if response.status_code == 200:
                    result = response.json()
                    if result.get("status") != "completed":
                        logger.error(
                            f"❌ Server import did not complete: {result.get('error', result)}"
                        )
                    else:
                        logger.info(f"✅ Catalog '{slug}' synced successfully.")
                        summary = result.get("summary") or {}
                        added = int(summary.get("added") or 0)
                        modified = int(summary.get("modified") or 0)
                        deleted = int(summary.get("deleted") or 0)
                        skipped = int(summary.get("skipped") or 0)
                        logger.info(
                            f"📝 Import summary: {added} added, {modified} modified, "
                            f"{deleted} deleted, {skipped} unchanged (same content hash)."
                        )
                        if skipped and not (added or modified or deleted):
                            logger.info(
                                "ℹ️  Nothing changed on the server — local tree matches DB "
                                "byte-for-byte. Check you saved files and used the correct "
                                "`--path` to the catalog root."
                            )
                elif response.status_code == 404:
                    detail = ""
                    try:
                        body = response.json()
                        detail = str(body.get("detail", ""))
                    except Exception:
                        detail = response.text or ""
                    if "not found" in detail.lower():
                        logger.info(
                            f"📭 Server has no catalog '{slug}' yet — creating via "
                            "POST /api/v1/catalog/upload (tar.gz)…"
                        )
                        tgz_path = Path(tmp_dir) / f"catalog_{slug}_upload.tar.gz"
                        create_catalog_tar_gz(catalog_dir, slug, tgz_path, exclude)
                        with open(tgz_path, "rb") as gf:
                            up = client.post(
                                f"{host}/api/v1/catalog/upload",
                                headers=headers,
                                files={
                                    "file": (
                                        f"{slug}.tar.gz",
                                        gf,
                                        "application/gzip",
                                    ),
                                },
                            )
                        if up.status_code == 201:
                            logger.info(
                                f"✅ Catalog '{slug}' created and imported on the server."
                            )
                        else:
                            logger.error(f"❌ Create upload failed: {up.text}")
                    else:
                        logger.error(f"❌ Sync failed: {response.text}")
                else:
                    logger.error(f"❌ Upload failed: {response.text}")

    except Exception as e:
        logger.error(f"❌ Error uploading catalog: {str(e)}")


def catalog_new_from_template(name: str, output_parent: Path, with_git: bool) -> None:
    """Clone/pull template into cache, then copy to ``output_parent / name``."""
    from snakemake_logger_plugin_flowo.plugin.client.template_local import (
        SNAKEMAKE_WORKFLOW_TEMPLATE_GIT,
        ensure_template,
    )

    root = user_snakemake_template_root(get_client_settings().FLOWO_WORKING_PATH)
    if not (root / "workflow").is_dir():
        logger.info("📥 Template missing; running pull first…")
        try:
            ensure_template(root, SNAKEMAKE_WORKFLOW_TEMPLATE_GIT)
        except RuntimeError as e:
            logger.error(f"❌ {e}")
            return

    output_parent = output_parent.resolve()
    output_parent.mkdir(parents=True, exist_ok=True)
    dest = (output_parent / name).resolve()
    if dest.exists():
        logger.error(f"❌ Destination already exists: {dest}")
        return

    def _ignore(_src: str, names: list[str]) -> list[str]:
        if with_git:
            return []
        return [n for n in names if n == ".git"]

    try:
        shutil.copytree(root, dest, ignore=_ignore, dirs_exist_ok=False)
    except OSError as e:
        logger.error(f"❌ Copy failed: {e}")
        return

    # So `flowo catalog upload` can find slug; must match an existing catalog on the server.
    flowo_meta = {
        "name": name.replace("-", " ").strip() or name,
        "slug": name,
        "version": "0.1.0",
    }
    try:
        (dest / ".flowo.json").write_text(
            json.dumps(flowo_meta, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
    except OSError as e:
        logger.warning("⚠️ Could not write .flowo.json: %s", e)

    logger.info(f"✅ Created project at {dest} (from template at {root})")
    logger.info(
        "ℹ️  This directory is only on your machine until you upload it. "
        "In the web UI, create a catalog whose slug is %r (same slug rules as the New catalog name), "
        "then run: flowo catalog upload --path %s",
        name,
        dest,
    )


def login(
    host: str | None,
    working_path: str | None,
    ttl_days: int | None,
    timeout_seconds: int = 300,
) -> None:
    resolved_host = (host or get_client_settings().FLOWO_HOST or "").strip().rstrip("/")
    if not resolved_host:
        logger.error(
            "❌ Host not found. Run: flowo login --host https://your-flowo-host"
        )
        return

    resolved_working_path = working_path or get_client_settings().FLOWO_WORKING_PATH
    try:
        with httpx.Client(timeout=15.0) as client:
            start = client.post(
                f"{resolved_host}/api/v1/tokens/cli/start",
                json={"ttl_days": ttl_days},
            )
            start.raise_for_status()
            payload = start.json()
            device_code = payload["device_code"]
            user_code = payload["user_code"]
            interval = int(payload.get("interval_seconds") or 2)
            login_url = urljoin(
                f"{resolved_host}/",
                payload["verification_uri_complete"].lstrip("/"),
            )

            logger.info("🔐 FlowO device login code: %s", user_code)
            logger.info("🌐 Opening browser for FlowO login: %s", login_url)
            if not webbrowser.open(login_url):
                logger.info("Open this URL in your browser:\n%s", login_url)

            deadline = time.monotonic() + timeout_seconds
            while time.monotonic() < deadline:
                time.sleep(interval)
                poll = client.get(
                    f"{resolved_host}/api/v1/tokens/cli/poll/{device_code}"
                )
                if poll.status_code == 404:
                    logger.error("❌ Login request expired. Run `flowo login` again.")
                    return
                poll.raise_for_status()
                result = poll.json()
                if result.get("status") == "pending":
                    continue
                token = result.get("token")
                if not token:
                    logger.error("❌ Login was approved but no token was returned.")
                    return
                config_path = write_user_config(
                    resolved_host, token, resolved_working_path
                )
                logger.info(
                    "✅ Login complete. Credentials written to %s (file mode 0600 where supported)",
                    config_path,
                )
                return

            logger.error("❌ Login timed out. Run `flowo login` again when ready.")
    except httpx.HTTPError as e:
        logger.error("❌ Login failed: %s", e)


def main():
    parser = argparse.ArgumentParser(
        description="Flowo Logger Plugin Utility. Documentation: https://flowo-docs.pages.dev/"
    )
    subparsers = parser.add_subparsers(dest="command", help="Sub-commands")

    # Global options (usable with any subcommand, e.g. ``flowo --host URL catalog pull``)
    parser.add_argument("--host", type=str, help="Optional API host")
    parser.add_argument("--working-path", type=str, help="Optional working path")

    login_parser = subparsers.add_parser(
        "login",
        help="Open browser login and write ~/.config/flowo/config.toml with a user API token",
    )
    login_parser.add_argument(
        "--host",
        type=str,
        help="Flowo base URL (e.g. https://flowo.example.com); defaults from FLOWO_HOST",
    )
    login_parser.add_argument(
        "--working-path",
        type=str,
        help="Working path to write into ~/.config/flowo/config.toml",
    )
    login_parser.add_argument(
        "--ttl-days",
        type=int,
        default=90,
        help="Token lifetime in days (default: 90)",
    )
    login_parser.add_argument(
        "--no-expiry",
        action="store_true",
        help="Create a token without an expiration date",
    )

    # --- Catalog commands ---
    cat_parser = subparsers.add_parser(
        "catalog", help="Manage workflow templates (Catalogs)"
    )
    cat_sub = cat_parser.add_subparsers(dest="cat_cmd")

    cat_pull = cat_sub.add_parser(
        "pull",
        help="Download catalog ZIP from Flowo and unpack (sync in-place inside a catalog dir)",
    )
    cat_pull.add_argument(
        "slug", nargs="?", help="Catalog Slug (optional if run inside catalog dir)"
    )
    cat_pull.add_argument(
        "--path", default=".", help="Local directory for unpack or sync"
    )

    cat_upload = cat_sub.add_parser("upload", help="Upload local catalog to platform")
    cat_upload.add_argument("--path", default=".", help="Local path to catalog files")
    cat_upload.add_argument(
        "--exclude", "-e", action="append", help="Patterns to exclude (e.g. data/*)"
    )

    cat_new = cat_sub.add_parser(
        "new",
        help="Copy template into a new local directory (excludes .git by default)",
    )
    cat_new.add_argument("name", help="New directory name under --output")
    cat_new.add_argument(
        "--output",
        "-o",
        default=".",
        help="Parent directory for the new folder (default: current)",
    )
    cat_new.add_argument(
        "--with-git",
        action="store_true",
        help="Copy the template's .git directory as well",
    )

    args = parser.parse_args()

    if args.command == "login":
        login(
            getattr(args, "host", None),
            args.working_path,
            None if getattr(args, "no_expiry", False) else args.ttl_days,
        )
    elif args.command == "catalog":
        if args.cat_cmd == "pull":
            pull_catalog(args.slug, path=getattr(args, "path", "."))
        elif args.cat_cmd == "upload":
            upload_catalog(
                args.path,
                token=None,
                host=args.host,
                exclude=args.exclude,
            )
        elif args.cat_cmd == "new":
            catalog_new_from_template(
                args.name,
                Path(args.output),
                bool(getattr(args, "with_git", False)),
            )
        else:
            cat_parser.print_help()

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
