from __future__ import annotations

import hmac
import hashlib
import time
from pathlib import Path
from typing import Dict

from fastapi import APIRouter, HTTPException, Request, Form, status
from fastapi.responses import HTMLResponse, RedirectResponse
from fastapi.templating import Jinja2Templates

from core.services.web_user_service import WebUserService
from core.services.telegram_user_service import TelegramUserService
from web.config import S

router = APIRouter(tags=["auth"])

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))
templates.env.globals.update(
    APP_BRAND_NAME="LeonidPro",
    APP_BASE_URL="https://leonid.pro",
    BOT_USERNAME="@LeonidBot",
    BOT_LANDING_URL="https://leonid.pro/bot",
)


def verify_telegram_login(data: Dict[str, str]) -> bool:
    recv_hash = data.get("hash", "")
    pairs = [f"{k}={v}" for k, v in sorted(data.items()) if k != "hash"]
    data_check_string = "\n".join(pairs)
    secret = hashlib.sha256(S.BOT_TOKEN.encode()).digest()
    calc_hash = hmac.new(secret, data_check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calc_hash, recv_hash):
        return False
    try:
        auth_date = int(data.get("auth_date", "0"))
    except ValueError:
        return False
    return auth_date > 0 and (time.time() - auth_date) <= S.SESSION_MAX_AGE


@router.get("", response_class=HTMLResponse)
async def auth_page(request: Request, tab: str = "login") -> HTMLResponse:
    telegram_id = request.cookies.get("telegram_id")
    origin = S.PUBLIC_BASE_URL or ""
    telegram_login_url = (
        "https://oauth.telegram.org/auth"
        f"?bot_id={S.BOT_TOKEN.split(':')[0]}"
        f"&origin={origin}"
        f"&redirect_url={origin}/auth/tg/callback&request_access=write"
    )
    active = tab if tab in {"login", "register"} else "login"
    context = {
        "telegram_login_url": telegram_login_url,
        "telegram_id": telegram_id,
        "page_title": "Авторизация",
        "active": active,
    }
    return templates.TemplateResponse(request, "auth.html", context)


@router.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    origin = S.PUBLIC_BASE_URL or ""
    telegram_login_url = (
        "https://oauth.telegram.org/auth"
        f"?bot_id={S.BOT_TOKEN.split(':')[0]}"
        f"&origin={origin}"
        f"&redirect_url={origin}/auth/tg/callback&request_access=write"
    )
    try:
        async with WebUserService() as service:
            user = await service.authenticate(username, password)
    except Exception as exc:  # pragma: no cover - defensive
        context = {
            "telegram_login_url": telegram_login_url,
            "telegram_id": request.cookies.get("telegram_id"),
            "page_title": "Авторизация",
            "flash": f"Technical error: {exc}",
            "active": "login",
        }
        return templates.TemplateResponse(request, "auth.html", context, status_code=500)
    if not user:
        context = {
            "telegram_login_url": telegram_login_url,
            "telegram_id": request.cookies.get("telegram_id"),
            "page_title": "Авторизация",
            "flash": "Invalid credentials",
            "active": "login",
        }
        return templates.TemplateResponse(request, "auth.html", context, status_code=400)
    if user.role == "ban":
        response = RedirectResponse("/ban", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
        response.delete_cookie("web_user_id", path="/")
        response.delete_cookie("telegram_id", path="/")
        return response
    response = RedirectResponse("/", status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(
        "web_user_id",
        str(user.id),
        max_age=S.SESSION_MAX_AGE,
        path="/",
        httponly=True,
        samesite="lax",
    )
    return response


@router.post("/register")
async def register(
    username: str = Form(...),
    password: str = Form(...),
    email: str | None = Form(None),
    phone: str | None = Form(None),
):
    async with WebUserService() as service:
        try:
            await service.register(username=username, password=password, email=email, phone=phone)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return RedirectResponse("/auth", status_code=status.HTTP_303_SEE_OTHER)


@router.post("/logout")
async def logout() -> RedirectResponse:
    response = RedirectResponse("/auth", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie("web_user_id", path="/")
    response.delete_cookie("telegram_id", path="/")
    return response


@router.api_route("/tg/callback", methods=["GET", "POST"])
async def telegram_callback(request: Request):
    """Handle Telegram login callback from widget."""
    if request.method == "POST":
        data = dict((await request.form()).items())
    else:
        data = dict(request.query_params.items())
    if not verify_telegram_login(data):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Bad Telegram signature")
    telegram_id = int(data["id"])
    async with TelegramUserService() as tsvc:
        await tsvc.update_from_telegram(
            telegram_id,
            username=data.get("username"),
            first_name=data.get("first_name"),
            last_name=data.get("last_name"),
            language_code=data.get("language_code"),
        )
    async with WebUserService() as wsvc:
        web_user = await wsvc.get_user_by_identifier(telegram_id)
    if web_user:
        if web_user.role == "ban":
            response = RedirectResponse("/ban", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
            response.delete_cookie("web_user_id", path="/")
            response.delete_cookie("telegram_id", path="/")
            return response
        response = RedirectResponse("/", status_code=status.HTTP_303_SEE_OTHER)
        response.set_cookie(
            "web_user_id",
            str(web_user.id),
            max_age=S.SESSION_MAX_AGE,
            path="/",
            httponly=True,
            samesite="lax",
        )
        response.set_cookie(
            "telegram_id",
            str(telegram_id),
            max_age=S.SESSION_MAX_AGE,
            path="/",
            httponly=True,
            samesite="lax",
        )
        return response
    response = RedirectResponse("/auth/create_web_account", status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(
        "telegram_id",
        str(telegram_id),
        max_age=S.SESSION_MAX_AGE,
        path="/",
        httponly=True,
        samesite="lax",
    )
    return response


@router.get("/create_web_account", response_class=HTMLResponse)
async def create_web_account_page(request: Request) -> HTMLResponse:
    telegram_id = request.cookies.get("telegram_id")
    if not telegram_id:
        return RedirectResponse("/auth", status_code=status.HTTP_303_SEE_OTHER)
    return templates.TemplateResponse(
        request,
        "auth/create_web_account.html",
        {"page_title": "Создание аккаунта"},
    )


@router.post("/create_web_account")
async def create_web_account(
    request: Request,
    action: str = Form(...),
    username: str = Form(""),
    password: str = Form(""),
):
    telegram_id = request.cookies.get("telegram_id")
    if not telegram_id:
        return RedirectResponse("/auth", status_code=status.HTTP_303_SEE_OTHER)
    if action == "cancel":
        response = templates.TemplateResponse(
            request,
            "auth/create_web_account.html",
            {
                "message": "Без создания аккаунта воспользоваться веб-версией нельзя",
                "page_title": "Создание аккаунта",
            },
        )
        response.delete_cookie("telegram_id", path="/")
        return response
    async with WebUserService() as wsvc:
        try:
            web_user = await wsvc.register(username=username, password=password)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
        async with TelegramUserService() as tsvc:
            tg_user = await tsvc.get_user_by_telegram_id(int(telegram_id))
        await wsvc.link_telegram(web_user.id, tg_user.id)
    response = RedirectResponse("/", status_code=status.HTTP_303_SEE_OTHER)
    response.set_cookie(
        "web_user_id",
        str(web_user.id),
        max_age=S.SESSION_MAX_AGE,
        path="/",
        httponly=True,
        samesite="lax",
    )
    response.set_cookie(
        "telegram_id",
        str(telegram_id),
        max_age=S.SESSION_MAX_AGE,
        path="/",
        httponly=True,
        samesite="lax",
    )
    return response
