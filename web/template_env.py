from __future__ import annotations

from pathlib import Path
import os

from fastapi.templating import Jinja2Templates

from .config import S

TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))

_web_url = os.getenv("PUBLIC_URL") or (
    str(S.PUBLIC_URL) if S.PUBLIC_URL else "https://intdata.pro"
)
_TG_BOT_USERNAME = os.getenv("TG_BOT_USERNAME", S.TG_BOT_USERNAME)
_TG_BOT_USERNAME_with_at = "@" + _TG_BOT_USERNAME.lstrip("@")

templates.env.globals.update(
    BRAND_NAME=S.BRAND_NAME,
    PUBLIC_URL=S.PUBLIC_URL,
    BOT_LANDING_URL=S.BOT_LANDING_URL,
    TG_LOGIN_ENABLED=S.TG_LOGIN_ENABLED,
    TG_TG_BOT_USERNAME=S.TG_BOT_USERNAME,
    TG_BOT_USERNAME=("@" + (S.TG_BOT_USERNAME or "").lstrip("@")) if S.TG_BOT_USERNAME else None,
    RECAPTCHA_SITE_KEY=S.RECAPTCHA_SITE_KEY,
    CALENDAR_V2_ENABLED=S.CALENDAR_V2_ENABLED,
)

__all__ = ["templates"]
