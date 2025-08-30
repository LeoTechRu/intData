from __future__ import annotations

from functools import lru_cache
from typing import Optional, Literal
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl, ValidationInfo, field_validator
import os


class EnvSettings(BaseSettings):
    # General
    LOG_LEVEL: str = "INFO"

    # DB/Redis
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "postgres"
    DB_HOST: str = "localhost"
    DB_NAME: str = "intData"
    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379

    # Branding (ENV defaults)
    BRAND_NAME: str = "intData"
    PUBLIC_URL: AnyHttpUrl = "http://localhost:5800"  # type: ignore[assignment]
    BOT_LANDING_URL: AnyHttpUrl | None = None  # type: ignore[assignment]

    # Bot
    TG_BOT_TOKEN: Optional[str] = None
    TG_BOT_USERNAME: Optional[str] = None  # без @

    ADMIN_CHAT_ID: Optional[str] = None
    ADMIN_TELEGRAM_IDS: str = ""

    # Web/Auth
    LOCAL_URL: AnyHttpUrl | None = None  # type: ignore[assignment]
    LOGIN_CALLBACK_URL: AnyHttpUrl | None = None  # type: ignore[assignment]
    SESSION_MAX_AGE: int = 86400
    TG_LOGIN_ENABLED: bool = True
    CALENDAR_V2_ENABLED: bool = False
    RECAPTCHA_SITE_KEY: Optional[str] = None
    RECAPTCHA_SECRET_KEY: Optional[str] = None
    APP_MODE: Literal["single", "multiplayer"] = "single"

    # Google Calendar
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    GCAL_WEBHOOK_URL: AnyHttpUrl | None = None  # type: ignore[assignment]

    # pydantic-settings v2 style configuration
    model_config = SettingsConfigDict(
        env_file=os.getenv("INTDATA__ENV_FILE", ".env"),
        case_sensitive=False,
        extra="allow",  # ignore unrelated env vars (e.g., deployment-specific)
    )

    @field_validator("TG_BOT_USERNAME", mode="before")
    @classmethod
    def strip_at(cls, v: str | None) -> str | None:  # noqa: D401
        if not v:
            return v
        return str(v).lstrip("@").strip()

    @field_validator("BOT_LANDING_URL", mode="before")
    @classmethod
    def default_bot_landing(
        cls, v: AnyHttpUrl | None, info: ValidationInfo
    ) -> AnyHttpUrl | None:  # noqa: D401
        if v:
            return v
        base = str(info.data.get("PUBLIC_URL")).rstrip("/")
        return f"{base}/bot"

    @field_validator("LOCAL_URL", mode="before")
    @classmethod
    def default_LOCAL_URL(
        cls, v: AnyHttpUrl | None, info: ValidationInfo
    ) -> AnyHttpUrl | None:  # noqa: D401
        if v:
            return v
        return info.data.get("PUBLIC_URL")

    @field_validator("LOGIN_CALLBACK_URL", mode="before")
    @classmethod
    def default_login_cb(
        cls, v: AnyHttpUrl | None, info: ValidationInfo
    ) -> AnyHttpUrl | None:  # noqa: D401
        if v:
            return v
        base = str(info.data.get("PUBLIC_URL")).rstrip("/")
        return f"{base}/auth/callback"


# --- Runtime overrides from DB ---
try:
    from core.settings_store import SettingsStore  # type: ignore
except Exception:  # pragma: no cover - optional in tests
    class SettingsStore:  # type: ignore
        def reload(self):
            pass

        def get(self, key: str):
            return None

        def get_secret(self, key: str):
            return None


class Settings:
    """Env + DB overrides. Use S = settings() to get singleton."""

    def __init__(self, env: EnvSettings, store: SettingsStore):
        self._env = env
        self._store = store

    def reload(self):
        self._store.reload()

    # read helpers with override priority (DB -> ENV)
    @property
    def BRAND_NAME(self):
        return self._store.get("branding.BRAND_NAME") or self._env.BRAND_NAME

    @property
    def PUBLIC_URL(self):
        return self._store.get("branding.PUBLIC_URL") or str(self._env.PUBLIC_URL)

    @property
    def BOT_LANDING_URL(self):
        return self._store.get("branding.BOT_LANDING_URL") or str(self._env.BOT_LANDING_URL)

    @property
    def TG_BOT_USERNAME(self):
        return self._store.get("telegram.TG_BOT_USERNAME") or self._env.TG_BOT_USERNAME

    @property
    def TG_BOT_TOKEN(self):
        return self._store.get_secret("telegram.TG_BOT_TOKEN") or self._env.TG_BOT_TOKEN
    @TG_BOT_TOKEN.setter
    def TG_BOT_TOKEN(self, value):  # pragma: no cover - used in tests
        self._env.TG_BOT_TOKEN = value

    @property
    def TG_LOGIN_ENABLED(self):
        v = self._store.get("telegram.TG_LOGIN_ENABLED")
        if v is None:
            return self._env.TG_LOGIN_ENABLED
        return str(v).strip() not in {"0", "false", "False"}

    @property
    def CALENDAR_V2_ENABLED(self):
        v = self._store.get("calendar.CALENDAR_V2_ENABLED")
        if v is None:
            return self._env.CALENDAR_V2_ENABLED
        return str(v).strip() not in {"0", "false", "False"}

    @property
    def APP_MODE(self):
        return self._store.get("app.APP_MODE") or self._env.APP_MODE

    @property
    def LOGIN_CALLBACK_URL(self):
        return str(self._env.LOGIN_CALLBACK_URL)

    @property
    def SESSION_MAX_AGE(self):
        return int(self._env.SESSION_MAX_AGE)

    @property
    def RECAPTCHA_SECRET_KEY(self):
        return self._env.RECAPTCHA_SECRET_KEY

    @property
    def RECAPTCHA_SITE_KEY(self):
        return self._env.RECAPTCHA_SITE_KEY

    @property
    def GOOGLE_CLIENT_ID(self):
        return self._store.get("google.GOOGLE_CLIENT_ID") or self._env.GOOGLE_CLIENT_ID

    @property
    def GOOGLE_CLIENT_SECRET(self):
        return self._store.get_secret("google.GOOGLE_CLIENT_SECRET") or self._env.GOOGLE_CLIENT_SECRET

    @property
    def GCAL_WEBHOOK_URL(self):
        val = self._store.get("google.GCAL_WEBHOOK_URL")
        if val:
            return val
        return str(self._env.GCAL_WEBHOOK_URL) if self._env.GCAL_WEBHOOK_URL else None

    @property
    def ADMIN_IDS(self):
        return self._env.ADMIN_TELEGRAM_IDS
    # expose raw env for DB/Redis etc
    @property
    def env(self):
        return self._env


@lru_cache(1)
def settings() -> Settings:
    env = EnvSettings()
    store = SettingsStore()
    return Settings(env, store)


S = settings()
