import argparse
import json
import os
import zipfile
from fnmatch import fnmatch
from pathlib import Path

import httpx
from tqdm import tqdm

from ... import logger
from ...core.config import settings


def generate_config(
    token: str | None = None, host: str | None = None, working_path: str | None = None
):
    config_dir = Path.home() / ".config/flowo"
    config_dir.mkdir(parents=True, exist_ok=True)
    config_path = config_dir / ".env"

    host = host or settings.FLOWO_HOST
    token = token or settings.FLOWO_USER_TOKEN
    working_path = working_path or settings.FLOWO_WORKING_PATH

    # Use current settings as defaults
    template = f"""
### FlowO API Reporting (Secure)
FLOWO_HOST={host}
FLOWO_USER_TOKEN={token}
FLOWO_WORKING_PATH={working_path}
"""
    with open(config_path, "w") as f:
        f.write(template.strip())
    logger.info(f"✅ Config generated at {config_path}")


def pull_catalog(slug: str | None = None, path: str = "."):
    """Download catalog ZIP and unpack it. Supports in-place sync if run inside a catalog dir."""
    host = settings.FLOWO_HOST
    token = settings.FLOWO_USER_TOKEN

    if not token:
        logger.error(
            "❌ No API token found. Please run --generate-config --token YOUR_TOKEN first."
        )
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
    ]
    all_excludes = default_excludes + (extra_excludes or [])

    source_dir = source_dir.resolve()
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(source_dir):
            # Filter directories
            dirs[:] = [d for d in dirs if not any(fnmatch(d, p) for p in all_excludes)]

            for file in files:
                if any(fnmatch(file, p) for p in all_excludes):
                    continue

                file_path = Path(root) / file
                rel_path = file_path.relative_to(source_dir)
                zipf.write(file_path, rel_path)


def upload_catalog(
    catalog_dir_path: str,
    token: str = None,
    host: str = None,
    exclude: list[str] = None,
):
    """Pack and upload a catalog to the Flowo platform."""
    catalog_dir = Path(catalog_dir_path).resolve()
    flowo_json_path = catalog_dir / ".flowo.json"

    if not catalog_dir.exists():
        logger.error(f"❌ Path {catalog_dir} does not exist.")
        return
    if not flowo_json_path.exists():
        logger.error(f"❌ '{flowo_json_path.name}' not found in {catalog_dir}.")
        logger.error(
            "Please create a '.flowo.json' file to define this catalog. Example:"
        )
        logger.error(
            '{\n  "name": "My Catalog",\n  "slug": "my-catalog-slug",\n  "version": "0.1.0"\n}'
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

    # Use arguments or config search
    token = token or (os.environ.get("FLOWO_USER_TOKEN"))
    host = host or (os.environ.get("FLOWO_HOST"))

    if not token or not host:
        # Fallback to config file
        # Assuming get_config is available from ...core.config or a new .config
        # For now, using existing settings as per original file structure
        token = token or settings.FLOWO_USER_TOKEN
        host = host or settings.FLOWO_HOST

    if not token:
        logger.error(
            "❌ Token not found. Use --token or set FLOWO_USER_TOKEN environment variable."
        )
        return
    if not host:
        logger.error(
            "❌ Host not found. Use --host or set FLOWO_HOST environment variable."
        )
        return

    headers = {"Authorization": f"Bearer {token}"}
    try:
        import tempfile

        with tempfile.TemporaryDirectory() as tmp_dir:
            zip_base = Path(tmp_dir) / f"catalog_{slug}_upload.zip"
            create_catalog_zip(catalog_dir, zip_base, exclude)

            # 1. Upload to sync endpoint
            logger.info(f"📦 Uploading catalog '{slug}' to Flowo platform...")
            with httpx.Client(timeout=120.0) as client:
                with open(zip_base, "rb") as f:
                    files = {"file": (zip_base.name, f, "application/zip")}
                    response = client.post(
                        f"{host}/api/v1/catalog/{slug}/sync",
                        headers=headers,
                        files=files,
                    )

            if response.status_code == 200:
                logger.info(f"✅ Catalog {slug} uploaded successfully.")

                # 2. Trigger Git Push
                logger.info("🚀 Pushing changes to GitHub...")
                with httpx.Client(timeout=120.0) as client:
                    git_response = client.post(
                        f"{host}/api/v1/catalog/git/push",
                        headers=headers,
                        json={},
                    )

                if git_response.status_code == 200:
                    logger.info("✅ Changes pushed to GitHub.")
                else:
                    logger.warning(
                        f"⚠️ Files updated on platform, but Git push failed: {git_response.text}"
                    )
            else:
                logger.error(f"❌ Failed to upload catalog: {response.text}")

    except Exception as e:
        logger.error(f"❌ Error uploading catalog: {str(e)}")


def main():
    parser = argparse.ArgumentParser(
        description="Flowo Logger Plugin Utility. Documentation: https://flowo-docs.pages.dev/"
    )
    subparsers = parser.add_subparsers(dest="command", help="Sub-commands")

    # Global options
    parser.add_argument(
        "--generate-config",
        action="store_true",
        help="Generate default config at ~/.config/flowo/.env",
    )
    parser.add_argument("--token", type=str, help="Optional API token")
    parser.add_argument("--host", type=str, help="Optional API host")
    parser.add_argument("--working-path", type=str, help="Optional working path")

    # --- Catalog commands ---
    cat_parser = subparsers.add_parser(
        "catalog", help="Manage workflow templates (Catalogs)"
    )
    cat_sub = cat_parser.add_subparsers(dest="cat_cmd")

    cat_pull = cat_sub.add_parser("pull", help="Download or sync catalog template")
    cat_pull.add_argument(
        "slug", nargs="?", help="Catalog Slug (optional if run inside catalog dir)"
    )
    cat_pull.add_argument("--path", default=".", help="Local path for download or sync")

    cat_download = cat_sub.add_parser(
        "download", help="Download catalog template (alias for pull)"
    )
    cat_download.add_argument(
        "slug", nargs="?", help="Catalog Slug (optional if run inside catalog dir)"
    )
    cat_download.add_argument("--path", default=".", help="Local path for download")

    cat_upload = cat_sub.add_parser("upload", help="Upload local catalog to platform")
    cat_upload.add_argument("--path", default=".", help="Local path to catalog files")
    cat_upload.add_argument(
        "--exclude", "-e", action="append", help="Patterns to exclude (e.g. data/*)"
    )

    # --- Global Top-level commands ---
    upload_parser = subparsers.add_parser(
        "upload", help="Upload local catalog to platform (alias for catalog upload)"
    )
    upload_parser.add_argument(
        "--path", default=".", help="Local path to catalog files"
    )
    upload_parser.add_argument(
        "--exclude", "-e", action="append", help="Patterns to exclude"
    )

    args = parser.parse_args()

    if args.generate_config:
        generate_config(args.token, args.host, args.working_path)

    # Logic routing
    if args.command == "catalog":
        if args.cat_cmd in ["pull", "download"]:
            pull_catalog(args.slug, path=getattr(args, "path", "."))
        elif args.cat_cmd == "upload":
            upload_catalog(args.path, exclude=args.exclude)
        else:
            cat_parser.print_help()

    elif args.command == "upload":
        upload_catalog(args.path, exclude=args.exclude)

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
