from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings


def get_env_files() -> list[str]:
    """Safely get environment files, avoiding permission errors in containers."""
    files = []
    try:
        # Check for user-level config
        home_cfg = Path.home() / ".config/flowo/.env"
        # In Docker, Path.home() might be /root. Check if we have access.
        if home_cfg.is_file():
            files.append(str(home_cfg))
    except (PermissionError, RuntimeError):
        # Fallback if home directory is restricted
        pass
    files.append(".env")
    return files


class Settings(BaseSettings):
    PROJECT_NAME: str = "flowo"
    API_V1_STR: str = "/api/v1"

    # Database settings
    POSTGRES_DB: str = "flowo_logs"
    POSTGRES_USER: str = "flowo"
    POSTGRES_PASSWORD: str = "flowo_password"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432
    SQL_ECHO: bool = False

    PORT: int = 3100
    DOMAIN: str = "localhost"
    PROTOCOL: str = "http"

    # FlowO Specific Settings (shared with plugin)
    FLOWO_USER_TOKEN: str | None = None
    FLOWO_HOST: str | None = None

    @model_validator(mode="after")
    def set_flowo_defaults(self) -> "Settings":
        if self.FLOWO_HOST is None:
            self.FLOWO_HOST = f"{self.PROTOCOL}://{self.DOMAIN}:{self.PORT}"
        return self

    FLOWO_WORKING_PATH: str = "/tmp/flowo_working_dir"
    CONTAINER_MOUNT_PATH: str = "/work_dir"

    # Template management
    TEMPLATE_DIR: str | None = None  # Defaults to FLOWO_WORKING_PATH/templates

    @model_validator(mode="after")
    def set_template_defaults(self) -> "Settings":
        if self.TEMPLATE_DIR is None:
            self.TEMPLATE_DIR = str(Path(self.FLOWO_WORKING_PATH) / "templates")
        return self

    # Optional Git sync for templates
    TEMPLATE_GIT_REMOTE: str | None = None  # e.g. https://github.com/user/workflows
    TEMPLATE_GIT_TOKEN: str | None = None  # PAT for private repos

    SECRET_KEY: str = "YOUR_SECRET_KEY"  # SHOULD BE CHANGED IN PRODUCTION
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost", "http://localhost:3100"]

    model_config = {
        "env_file": get_env_files(),
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "allow",
    }

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def ASYNC_SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"


settings = Settings()
