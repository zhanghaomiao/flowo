
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

    # Application settings
    LOG_LEVEL: str = "INFO"
    SQL_ECHO: bool = True

    # SQL settings
    BACKEND_CORS_ORIGINS: list[str] = ["*"]

    class Config:
        env_file = "../.env"
        env_file_encoding = "utf-8"
        case_sensitive = True
        extra = "allow"

    @property
    def SQLALCHEMY_DATABASE_URI(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"


settings = Settings()
