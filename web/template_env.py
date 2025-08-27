from __future__ import annotations

from pathlib import Path
import os

from fastapi.templating import Jinja2Templates

from .config import S

TEMPLATE_DIR = Path(__file__).resolve().parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))

_web_url = os.getenv("WEB_PUBLIC_URL") or (
    str(S.WEB_PUBLIC_URL) if S.WEB_PUBLIC_URL else "https://leonid.pro"
)
_bot_username = os.getenv("BOT_USERNAME", S.BOT_USERNAME)
_bot_username_with_at = "@" + _bot_username.lstrip("@")

templates.env.globals.update(
    APP_BRAND_NAME=os.getenv("APP_BRAND_NAME", "LeonidPro"),
    WEB_PUBLIC_URL=_web_url,
    BOT_USERNAME=_bot_username_with_at,
    BOT_LANDING_URL=os.getenv("BOT_LANDING_URL", f"{_web_url}/bot"),
    TG_LOGIN_ENABLED=os.getenv("TG_LOGIN_ENABLED", "1") == "1",
    TG_BOT_USERNAME=os.getenv("TG_BOT_USERNAME", _bot_username_with_at),
)

__all__ = ["templates"]
