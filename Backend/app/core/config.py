from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_PATH = Path(__file__).resolve().parent.parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_PATH) if _ENV_PATH.exists() else None,
        case_sensitive=True,
        extra="ignore",
    )

    APP_NAME: str = "RAVIT API"
    CORS_ORIGINS: str = Field(
        default="http://localhost:4200,http://127.0.0.1:4200",
    )
    DATABASE_URL: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
