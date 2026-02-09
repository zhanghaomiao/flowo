import argparse
from pathlib import Path

from ... import logger
from ...core.config import settings


def generate_config(token: str | None = None):
    config_dir = Path.home() / ".config/flowo"
    config_dir.mkdir(parents=True, exist_ok=True)
    config_path = config_dir / ".env"

    token_to_use = token or settings.FLOWO_USER_TOKEN
    token_line = (
        f"FLOWO_USER_TOKEN={token_to_use}" if token_to_use else "# FLOWO_USER_TOKEN="
    )

    # Use current settings as defaults
    template = f"""
### FlowO API Reporting (Secure)
FLOWO_HOST={settings.FLOWO_HOST}
{token_line}
FLOWO_WORKING_PATH={settings.FLOWO_WORKING_PATH}
"""
    with open(config_path, "w") as f:
        f.write(template.strip())
    logger.info(f"✅ Config generated at {config_path}")


def main():
    parser = argparse.ArgumentParser(description="Flowo Logger Plugin Utility")
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

    args = parser.parse_args()

    if args.generate_config:
        generate_config(args.token)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
