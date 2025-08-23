from __future__ import annotations
from pathlib import Path
from dotenv import load_dotenv, find_dotenv
from pydantic import Field, AnyHttpUrl, AliasChoices, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Всегда грузим КОРНЕВОЙ .env (repo root), даже если uvicorn запущен из другого cwd
ROOT_ENV = find_dotenv(usecwd=False)
if ROOT_ENV:
    load_dotenv(ROOT_ENV, override=False)


class Settings(BaseSettings):
    # Основные переменные для веб-морды
    BOT_TOKEN: str = Field(..., description="Telegram Bot API token")
    TELEGRAM_BOT_USERNAME: str = Field(
        ...,
        description="Bot username без @",
        validation_alias=AliasChoices("TELEGRAM_BOT_USERNAME", "BOT_USERNAME"),
    )
    PUBLIC_BASE_URL: AnyHttpUrl | None = Field(
        default=None,
        description="Публичный базовый URL веб-морды",
        validation_alias=AliasChoices("PUBLIC_BASE_URL", "WEB_APP_URL"),
    )
    SESSION_MAX_AGE: int = 86400

    @field_validator("TELEGRAM_BOT_USERNAME")
    @classmethod
    def strip_at(cls, v: str) -> str:
        return v.lstrip("@").strip()

    model_config = SettingsConfigDict(
        env_file=ROOT_ENV if ROOT_ENV else ".env",
        case_sensitive=True,
        extra="ignore",  # <-- критично: не валимся на лишних переменных
    )

S = Settings()
