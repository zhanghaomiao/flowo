import argparse
from pathlib import Path

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


def main():
    parser = argparse.ArgumentParser(
        description="Flowo Logger Plugin Utility. Documentation: https://flowo-docs.pages.dev/"
    )
    parser.add_argument(
        "--generate-config",
        action="store_true",
        help="Generate default config at ~/.config/flowo/.env",
    )
    parser.add_argument(
        "--token",
        type=str,
        help="Optional API token to include in the generated config",
    )
    parser.add_argument(
        "--host",
        type=str,
        default=None,
        help="Optional API host to include in the generated config",
    )
    parser.add_argument(
        "--working-path",
        type=str,
        default=None,
        help="Optional working path to include in the generated config",
    )

    args = parser.parse_args()

    if args.generate_config:
        generate_config(args.token, args.host, args.working_path)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
