from __future__ import annotations

from dotenv import load_dotenv, find_dotenv
from pydantic import (
    Field,
    AnyHttpUrl,
    AliasChoices,
    field_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict

# Загружаем корневой .env даже при запуске uvicorn из другого каталога
ROOT_ENV = find_dotenv(usecwd=False)
if ROOT_ENV:
    load_dotenv(ROOT_ENV, override=False)


class Settings(BaseSettings):
    # Основные переменные для веб-морды
    BOT_TOKEN: str = Field(..., description="Telegram Bot API token")
    BOT_USERNAME: str = Field(
        ...,
        description="Bot username без @",
        validation_alias=AliasChoices("BOT_USERNAME", "BOT_USERNAME"),
    )
    WEB_PUBLIC_URL: AnyHttpUrl | None = Field(
        default=None,
        description="Публичный базовый URL веб-морды",
        validation_alias=AliasChoices("WEB_PUBLIC_URL", "WEB_APP_URL"),
    )
    APP_BRAND_NAME: str = Field(
        default="LeonidPro",
        description="Application brand name для шаблонов",
    )
    BOT_LANDING_URL: AnyHttpUrl | None = Field(
        default=None,
        description="Публичный URL лендинга бота",
    )
    RECAPTCHA_SITE_KEY: str | None = Field(
        default=None,
        description="Site key для Google reCAPTCHA",
    )
    RECAPTCHA_SECRET_KEY: str | None = Field(
        default=None,
        description="Secret key для проверки reCAPTCHA",
    )
    SESSION_MAX_AGE: int = 86400
    ADMIN_IDS: str | None = Field(
        default=None,
        description="CSV-список ID администраторов",
        validation_alias=AliasChoices("ADMIN_TELEGRAM_IDS", "ADMIN_IDS"),
    )

    @field_validator("BOT_USERNAME")
    @classmethod
    def strip_at(cls, v: str) -> str:
        return v.lstrip("@").strip()

    model_config = SettingsConfigDict(
        env_file=ROOT_ENV if ROOT_ENV else ".env",
        case_sensitive=True,
        extra="ignore",  # <-- критично: не валимся на лишних переменных
    )


S = Settings()
