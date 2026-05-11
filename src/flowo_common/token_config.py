"""Write ~/.config/flowo/config.toml for ``flowo login``."""

from __future__ import annotations

import json
from pathlib import Path


def write_user_config(host: str, token: str, working_path: str) -> Path:
    config_dir = Path.home() / ".config/flowo"
    config_dir.mkdir(parents=True, exist_ok=True)
    toml_path = config_dir / "config.toml"

    toml_template = f"""
FLOWO_HOST = {json.dumps(host)}
FLOWO_USER_TOKEN = {json.dumps(token)}
FLOWO_WORKING_PATH = {json.dumps(working_path)}
"""
    toml_path.write_text(toml_template.strip() + "\n", encoding="utf-8")
    try:
        toml_path.chmod(0o600)
    except OSError:
        pass
    return toml_path
