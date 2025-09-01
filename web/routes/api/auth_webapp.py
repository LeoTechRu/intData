from __future__ import annotations

import hmac
import json
import time
import urllib.parse
from hashlib import sha256

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from web.config import S
from web.security.cookies import set_auth_cookies
from core.logger import logger
from core.services.telegram_user_service import TelegramUserService
from core.services.web_user_service import WebUserService


router = APIRouter(prefix="/auth", tags=["auth"])


class ExchangeIn(BaseModel):
    init_data: str
    href: str | None = None


def _parse_init_data(raw: str) -> dict[str, str]:
    parts = urllib.parse.parse_qsl(raw, keep_blank_values=True)
    return {k: v for k, v in parts}


def _check_telegram_webapp_auth(data: dict) -> dict:
    """Validate Telegram WebApp initData signature.

    https://core.telegram.org/bots/webapps#validating-data-received-via-the-web-app
    """
    if not S.TG_LOGIN_ENABLED or not S.TG_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram WebApp SSO disabled")

    recv_hash = data.get("hash")
    if not recv_hash:
        raise HTTPException(status_code=400, detail="Missing hash")

    pairs = []
    for k in sorted(k for k in data.keys() if k != "hash"):
        pairs.append(f"{k}={data[k]}")
    data_check_string = "\n".join(pairs)

    secret_key = sha256((S.TG_BOT_TOKEN or "").encode()).digest()
    calc_hash = hmac.new(secret_key, data_check_string.encode(), sha256).hexdigest()

    if not hmac.compare_digest(calc_hash, recv_hash):
        raise HTTPException(status_code=401, detail="Bad signature")

    try:
        auth_date = int(data.get("auth_date", "0"))
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid auth_date")
    if abs(int(time.time()) - auth_date) > 300:
        raise HTTPException(status_code=401, detail="Auth data expired")

    user_json = data.get("user")
    if not user_json:
        raise HTTPException(status_code=400, detail="No user in initData")
    try:
        user = json.loads(user_json)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user payload")
    if "id" not in user:
        raise HTTPException(status_code=400, detail="Invalid user payload")
    return user


@router.post("/tg-webapp/exchange", name="api:auth_webapp_exchange")
async def exchange(req: Request, payload: ExchangeIn):
    data = _parse_init_data(payload.init_data)
    try:
        tg_user_payload = _check_telegram_webapp_auth(data)
    except HTTPException as e:
        logger.warning("tg-webapp auth failed: %s", e.detail)
        raise

    async with TelegramUserService() as tsvc:
        tg = await tsvc.update_from_telegram(
            tg_user_payload["id"],
            username=tg_user_payload.get("username"),
            first_name=tg_user_payload.get("first_name"),
            last_name=tg_user_payload.get("last_name"),
            language_code=tg_user_payload.get("language_code"),
        )

    async with WebUserService() as wsvc:
        wuser = await wsvc.get_user_by_identifier(int(tg_user_payload["id"]))
        if not wuser:
            username = tg_user_payload.get("username") or f"tg{tg_user_payload['id']}"
            password = (str(tg_user_payload["id"]))
            wuser = await wsvc.register(username=username, password=password)
            await wsvc.link_telegram(wuser.id, tg.id)

    if getattr(wuser, "role", "") == "ban":
        raise HTTPException(status_code=403, detail="banned")

    resp = JSONResponse({"ok": True, "web_user_id": wuser.id})
    set_auth_cookies(resp, web_user_id=wuser.id, telegram_id=tg_user_payload["id"])
    return resp
