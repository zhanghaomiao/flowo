import os
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings

from flowo_common.config import load_user_toml_defaults

load_user_toml_defaults()


def get_env_files() -> list[str]:
    """Safely get environment files, avoiding permission errors in containers."""
    return [".env"]


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

    # Catalog management
    CATALOG_DIR: str | None = None  # Defaults to CONTAINER_MOUNT_PATH/catalog
    # Official Snakemake workflow template (git clone target), NOT under per-user catalog trees.
    SNAKEMAKE_WORKFLOW_TEMPLATE_DIR: str | None = None
    # Read-only export cache for DAG generation, etc.
    # Default under CONTAINER_MOUNT_PATH so it can be persisted/mounted in Docker.
    CATALOG_EXPORT_DIR: str | None = (
        None  # Defaults to CONTAINER_MOUNT_PATH/.flowo_exported_catalogs
    )
    # DAG tooling runtime
    DAG_VENV_DIR: str | None = None  # Defaults to CONTAINER_MOUNT_PATH/.flowo_dag_venv
    DAG_AUTO_INSTALL_IMPORTS: bool = False  # Install missing imports into DAG venv
    DAG_AUTO_TOUCH_MISSING_INPUTS: bool = (
        True  # Touch missing inputs for rulegraph-only
    )

    @model_validator(mode="after")
    def set_catalog_defaults(self) -> "Settings":
        if self.CATALOG_DIR is None:
            # Use CONTAINER_MOUNT_PATH (container-side) for file storage,
            # FLOWO_WORKING_PATH is the host-side path used for Docker volume mapping
            self.CATALOG_DIR = str(Path(self.CONTAINER_MOUNT_PATH) / "catalog")
        if self.CATALOG_EXPORT_DIR is None:
            self.CATALOG_EXPORT_DIR = str(
                Path(self.CONTAINER_MOUNT_PATH) / ".flowo_exported_catalogs"
            )
        if self.DAG_VENV_DIR is None:
            self.DAG_VENV_DIR = str(Path(self.CONTAINER_MOUNT_PATH) / ".flowo_dag_venv")
        if self.SNAKEMAKE_WORKFLOW_TEMPLATE_DIR is None:
            # Prefer container mount when it exists and is writable (Docker). On a bare
            # host, ``/work_dir`` etc. often does not exist — fall back to FLOWO_WORKING_PATH
            # so ``flowo catalog new`` can clone the official template without extra env.
            container_base = Path(self.CONTAINER_MOUNT_PATH)
            working_base = Path(self.FLOWO_WORKING_PATH)
            use_container = container_base.exists() and os.access(
                container_base,
                os.W_OK,
            )
            base = container_base if use_container else working_base
            self.SNAKEMAKE_WORKFLOW_TEMPLATE_DIR = str(
                base / "snakemake-workflow-template"
            )
        return self

    # Optional Git sync for catalogs
    CATALOG_GIT_REMOTE: str | None = None  # e.g. https://github.com/user/workflows
    CATALOG_GIT_TOKEN: str | None = None  # PAT for private repos

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
