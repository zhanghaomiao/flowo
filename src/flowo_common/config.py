"""Client-side settings (env + ~/.config/flowo/config.toml). No FastAPI/DB fields."""

from __future__ import annotations

import os
import tomllib
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# API prefix for report ingestion; kept in sync with app.core.config.Settings.API_V1_STR
DEFAULT_API_V1_STR = "/api/v1"


def load_user_toml_defaults() -> None:
    """Load ~/.config/flowo/config.toml as low-priority environment defaults."""
    try:
        config_path = Path.home() / ".config/flowo/config.toml"
        if not config_path.is_file():
            return
        data = tomllib.loads(config_path.read_text(encoding="utf-8"))
    except (OSError, PermissionError, RuntimeError, tomllib.TOMLDecodeError):
        return

    for key, value in data.items():
        if isinstance(value, str):
            os.environ.setdefault(key, value)


class ClientSettings(BaseSettings):
    """Subset of settings used by the Snakemake logger plugin and ``flowo`` CLI."""

    FLOWO_HOST: str | None = None
    FLOWO_USER_TOKEN: str | None = None
    FLOWO_WORKING_PATH: str = "/tmp/flowo_working_dir"

    model_config = SettingsConfigDict(
        case_sensitive=True,
        extra="ignore",
        env_file=".env",
        env_file_encoding="utf-8",
    )


def get_client_settings() -> ClientSettings:
    """Resolve client settings on each call so tests and late ``.env`` updates behave predictably."""
    load_user_toml_defaults()
    return ClientSettings()
