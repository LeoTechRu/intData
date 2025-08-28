from __future__ import annotations

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from web.dependencies import role_required
from core.models import UserRole
from web.config import S


router = APIRouter(prefix="/admin/settings", tags=["admin"])


class BrandingIn(BaseModel):
    APP_BRAND_NAME: str
    WEB_PUBLIC_URL: str
    BOT_LANDING_URL: str


class TelegramIn(BaseModel):
    TG_LOGIN_ENABLED: bool
    BOT_USERNAME: str | None = None
    BOT_TOKEN: str | None = None


@router.get("", name="api:admin_settings_get", dependencies=[Depends(role_required(UserRole.admin))])
async def get_settings():
    return {
        "branding": {
            "APP_BRAND_NAME": S.APP_BRAND_NAME,
            "WEB_PUBLIC_URL": S.WEB_PUBLIC_URL,
            "BOT_LANDING_URL": S.BOT_LANDING_URL,
        },
        "telegram": {
            "TG_LOGIN_ENABLED": S.TG_LOGIN_ENABLED,
            "BOT_USERNAME": S.BOT_USERNAME,
            "BOT_TOKEN": bool(S.BOT_TOKEN),  # do not leak value
        },
    }


@router.patch("/branding", name="api:admin_settings_branding", dependencies=[Depends(role_required(UserRole.admin))])
async def patch_branding(payload: BrandingIn):
    st = S._store  # use shared store
    await st.set_async("branding.APP_BRAND_NAME", payload.APP_BRAND_NAME)
    await st.set_async("branding.WEB_PUBLIC_URL", payload.WEB_PUBLIC_URL)
    await st.set_async("branding.BOT_LANDING_URL", payload.BOT_LANDING_URL)
    # warm cache for immediate effect
    st._cache["branding.APP_BRAND_NAME"] = payload.APP_BRAND_NAME
    st._cache["branding.WEB_PUBLIC_URL"] = payload.WEB_PUBLIC_URL
    st._cache["branding.BOT_LANDING_URL"] = payload.BOT_LANDING_URL
    return {"ok": True}


@router.patch("/telegram", name="api:admin_settings_telegram", dependencies=[Depends(role_required(UserRole.admin))])
async def patch_telegram(payload: TelegramIn):
    st = S._store
    await st.set_async("telegram.TG_LOGIN_ENABLED", "1" if payload.TG_LOGIN_ENABLED else "0")
    if payload.BOT_USERNAME is not None:
        await st.set_async("telegram.BOT_USERNAME", payload.BOT_USERNAME.lstrip("@"))
    if payload.BOT_TOKEN:
        await st.set_async("telegram.BOT_TOKEN", payload.BOT_TOKEN, is_secret=True)
    st._cache["telegram.TG_LOGIN_ENABLED"] = "1" if payload.TG_LOGIN_ENABLED else "0"
    if payload.BOT_USERNAME is not None:
        st._cache["telegram.BOT_USERNAME"] = payload.BOT_USERNAME.lstrip("@")
    if payload.BOT_TOKEN:
        # do not cache secrets if encryption enabled; keep placeholder True
        st._cache["telegram.BOT_TOKEN"] = "***"
    return {"ok": True}
