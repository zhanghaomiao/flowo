from pathlib import Path

from pydantic_settings import BaseSettings


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
    FLOWO_HOST: str = f"{PROTOCOL}://{DOMAIN}:{PORT}"
    FLOWO_WORKING_PATH: str = "/tmp/flowo_working_dir"
    CONTAINER_MOUNT_PATH: str = "/work_dir"

    SECRET_KEY: str = "YOUR_SECRET_KEY"  # SHOULD BE CHANGED IN PRODUCTION
    BACKEND_CORS_ORIGINS: list[str] = ["http://localhost", "http://localhost:3100"]

    class Config:
        env_file = (
            str(Path.home() / ".config/flowo/.env"),
            ".env",
        )
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "allow"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def ASYNC_SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"


settings = Settings()
