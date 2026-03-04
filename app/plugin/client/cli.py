import argparse
import shutil
import zipfile
from pathlib import Path

import httpx

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


def pull_workflow(workflow_id_or_name: str):
    """Download workflow ZIP and unpack it."""
    host = settings.FLOWO_HOST
    token = settings.FLOWO_USER_TOKEN

    if not token:
        logger.error(
            "❌ No API token found. Please run --generate-config --token YOUR_TOKEN first."
        )
        return

    # 1. Resolve ID if name is provided (simple check)
    workflow_id = workflow_id_or_name

    headers = {"Authorization": f"Bearer {token}"}
    try:
        # Download ZIP
        with httpx.Client(timeout=60.0) as client:
            response = client.get(
                f"{host}/api/v1/workflows/{workflow_id}/download", headers=headers
            )
            if response.status_code != 200:
                logger.error(f"❌ Failed to download workflow: {response.text}")
                return

            # Save to temporary ZIP
            zip_path = Path(f"workflow_{workflow_id}.zip")
            with open(zip_path, "wb") as f:
                f.write(response.content)

            # 2. Automatically unpack (as requested by user)
            extract_dir = Path.cwd()  # Extract to current directory or a specific one
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(extract_dir)

            zip_path.unlink()
            logger.info(
                f"✅ Workflow {workflow_id} pulled and unpacked at {extract_dir}"
            )

    except Exception as e:
        logger.error(f"❌ Error pulling workflow: {str(e)}")


def sync_workflow(workflow_id_or_name: str, path: str = "."):
    """Pack local directory into ZIP and upload to platform."""
    host = settings.FLOWO_HOST
    token = settings.FLOWO_USER_TOKEN

    if not token:
        logger.error(
            "❌ No API token found. Please run --generate-config --token YOUR_TOKEN first."
        )
        return

    workflow_id = workflow_id_or_name
    workflow_dir = Path(path).resolve()

    if not workflow_dir.exists():
        logger.error(f"❌ Path {workflow_dir} does not exist.")
        return

    headers = {"Authorization": f"Bearer {token}"}
    try:
        # 1. Automatically pack into ZIP
        zip_base = f"workflow_{workflow_id}_upload"
        zip_path = Path(shutil.make_archive(zip_base, "zip", workflow_dir))

        # 2. Upload to platform
        with httpx.Client(timeout=120.0) as client:
            with open(zip_path, "rb") as f:
                files = {"file": (zip_path.name, f, "application/zip")}
                response = client.post(
                    f"{host}/api/v1/workflows/{workflow_id}/sync",
                    headers=headers,
                    files=files,
                )

            if response.status_code == 200:
                result = response.json()
                git_status = result.get("git_sync", "none")
                logger.info(f"✅ Workflow {workflow_id} synced successfully.")
                if git_status == "success":
                    logger.info("🚀 Changes also pushed to GitHub.")
                elif git_status == "failed":
                    logger.warning(
                        f"⚠️ Files updated on platform, but Git push failed: {result.get('error')}"
                    )
            else:
                logger.error(f"❌ Failed to sync workflow: {response.text}")

        zip_path.unlink()

    except Exception as e:
        logger.error(f"❌ Error syncing workflow: {str(e)}")


def pull_catalog(slug: str):
    """Download catalog ZIP and unpack it."""
    host = settings.FLOWO_HOST
    token = settings.FLOWO_USER_TOKEN

    if not token:
        logger.error(
            "❌ No API token found. Please run --generate-config --token YOUR_TOKEN first."
        )
        return

    headers = {"Authorization": f"Bearer {token}"}
    try:
        # Download ZIP
        with httpx.Client(timeout=60.0) as client:
            response = client.get(
                f"{host}/api/v1/catalog/{slug}/download", headers=headers
            )
            if response.status_code != 200:
                logger.error(f"❌ Failed to download catalog: {response.text}")
                return

            # Save to temporary ZIP
            zip_path = Path(f"catalog_{slug}.zip")
            with open(zip_path, "wb") as f:
                f.write(response.content)

            # Automatically unpack
            extract_dir = Path.cwd() / slug
            extract_dir.mkdir(parents=True, exist_ok=True)
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(extract_dir)

            zip_path.unlink()
            logger.info(f"✅ Catalog {slug} pulled and unpacked at {extract_dir}")

    except Exception as e:
        logger.error(f"❌ Error pulling catalog: {str(e)}")


def sync_catalog(slug: str, path: str = "."):
    """Pack local catalog directory into ZIP and upload to platform."""
    host = settings.FLOWO_HOST
    token = settings.FLOWO_USER_TOKEN

    if not token:
        logger.error(
            "❌ No API token found. Please run --generate-config --token YOUR_TOKEN first."
        )
        return

    catalog_dir = Path(path).resolve()
    if not catalog_dir.exists():
        logger.error(f"❌ Path {catalog_dir} does not exist.")
        return

    headers = {"Authorization": f"Bearer {token}"}
    try:
        # Pack into ZIP
        zip_base = f"catalog_{slug}_upload"
        zip_path = Path(shutil.make_archive(zip_base, "zip", catalog_dir))

        # Upload to sync endpoint
        with httpx.Client(timeout=120.0) as client:
            with open(zip_path, "rb") as f:
                files = {"file": (zip_path.name, f, "application/zip")}
                response = client.post(
                    f"{host}/api/v1/catalog/{slug}/sync",
                    headers=headers,
                    files=files,
                )

            if response.status_code == 200:
                result = response.json()
                git_status = result.get("git_sync", "none")
                logger.info(f"✅ Catalog {slug} synced successfully.")
                if git_status == "success":
                    logger.info("🚀 Changes also pushed to GitHub.")
                elif git_status == "failed":
                    logger.warning(
                        f"⚠️ Files updated on platform, but Git push failed: {result.get('error')}"
                    )
            else:
                logger.error(f"❌ Failed to sync catalog: {response.text}")

        zip_path.unlink()

    except Exception as e:
        logger.error(f"❌ Error syncing catalog: {str(e)}")


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

    # --- Workflow commands (Legacy & Explicit) ---
    # Backward compatibility aliases
    pull_parser = subparsers.add_parser(
        "pull", help="[Workflow] Download workflow from platform"
    )
    pull_parser.add_argument("workflow_id", help="Workflow UUID or Name")

    sync_parser = subparsers.add_parser(
        "sync", help="[Workflow] Upload local workflow to platform"
    )
    sync_parser.add_argument("workflow_id", help="Workflow UUID or Name")
    sync_parser.add_argument("--path", default=".", help="Local path (default: .)")

    # Explicit workflow group
    wf_parser = subparsers.add_parser(
        "workflow", help="Manage execution instances (Workflows)"
    )
    wf_sub = wf_parser.add_subparsers(dest="wf_cmd")

    wf_pull = wf_sub.add_parser("pull", help="Download workflow instance")
    wf_pull.add_argument("workflow_id", help="Workflow UUID or Name")

    wf_sync = wf_sub.add_parser("sync", help="Sync local project to workflow instance")
    wf_sync.add_argument("workflow_id", help="Workflow UUID or Name")
    wf_sync.add_argument("--path", default=".", help="Local path")

    # --- Catalog commands ---
    cat_parser = subparsers.add_parser(
        "catalog", help="Manage workflow templates (Catalogs)"
    )
    cat_sub = cat_parser.add_subparsers(dest="cat_cmd")

    cat_pull = cat_sub.add_parser("pull", help="Download catalog template")
    cat_pull.add_argument("slug", help="Catalog Slug")

    cat_download = cat_sub.add_parser(
        "download", help="Download catalog template (alias for pull)"
    )
    cat_download.add_argument("slug", help="Catalog Slug")

    cat_sync = cat_sub.add_parser("sync", help="Upload catalog template")
    cat_sync.add_argument("slug", help="Catalog Slug")
    cat_sync.add_argument("--path", default=".", help="Local path to catalog files")

    args = parser.parse_args()

    if args.generate_config:
        generate_config(args.token, args.host, args.working_path)

    # Logic routing
    if args.command == "pull":
        pull_workflow(args.workflow_id)
    elif args.command == "sync":
        sync_workflow(args.workflow_id, args.path)

    elif args.command == "workflow":
        if args.wf_cmd == "pull":
            pull_workflow(args.workflow_id)
        elif args.wf_cmd == "sync":
            sync_workflow(args.workflow_id, args.path)
        else:
            wf_parser.print_help()

    elif args.command == "catalog":
        if args.cat_cmd in ["pull", "download"]:
            pull_catalog(args.slug)
        elif args.cat_cmd == "sync":
            sync_catalog(args.slug, args.path)
        else:
            cat_parser.print_help()

    else:
        parser.print_help()


if __name__ == "__main__":
    main()
