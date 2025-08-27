from __future__ import annotations

import hmac, hashlib, os, time
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
    TG_LOGIN_ENABLED=bool(os.getenv("TG_LOGIN_ENABLED")),
    TG_BOT_USERNAME=os.getenv("TG_BOT_USERNAME", S.TELEGRAM_BOT_USERNAME),
)


def base_context() -> Dict[str, object]:
    return {
        "page_title": "Авторизация",
        "now_ts": int(time.time()),
    }


def verify_telegram_auth(data: dict) -> dict:
    """Validate Telegram Login Widget signature."""
    token = os.getenv("TG_BOT_TOKEN")
    if not token:
        raise HTTPException(status_code=500, detail="TG_BOT_TOKEN is not configured")

    recv_hash = data.get("hash", "")
    check_data = "\n".join(
        f"{k}={data[k]}" for k in sorted([k for k in data.keys() if k != "hash"])
    )
    secret = hashlib.sha256(token.encode()).digest()
    calc_hash = hmac.new(secret, check_data.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(calc_hash, recv_hash):
        raise HTTPException(status_code=400, detail="Invalid Telegram signature")

    try:
        if time.time() - int(data.get("auth_date", "0")) > 86400:
            raise HTTPException(status_code=400, detail="Telegram auth expired")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid auth_date")

    return data


async def upsert_user_from_telegram(info: dict):
    telegram_id = int(info["id"])
    async with TelegramUserService() as tsvc:
        tg_user = await tsvc.update_from_telegram(
            telegram_id,
            username=info.get("username"),
            first_name=info.get("first_name"),
            last_name=info.get("last_name"),
            language_code=info.get("language_code"),
        )
    async with WebUserService() as wsvc:
        web_user = await wsvc.get_user_by_identifier(telegram_id)
        if not web_user:
            username = info.get("username") or f"tg{telegram_id}"
            password = os.urandom(16).hex()
            web_user = await wsvc.register(username=username, password=password)
            await wsvc.link_telegram(web_user.id, tg_user.id)
        return web_user


@router.get("/auth/telegram")
async def auth_telegram(request: Request):
    params = dict(request.query_params)
    info = verify_telegram_auth(params)
    user = await upsert_user_from_telegram(info)
    if getattr(user, "role", "") == "ban":
        return RedirectResponse("/ban", status_code=307)
    response = RedirectResponse("/", status_code=302)
    response.set_cookie(
        "web_user_id",
        str(user.id),
        max_age=S.SESSION_MAX_AGE,
        path="/",
        httponly=True,
        samesite="lax",
    )
    response.set_cookie(
        "telegram_id",
        str(info["id"]),
        max_age=S.SESSION_MAX_AGE,
        path="/",
        httponly=True,
        samesite="lax",
    )
    return response


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


@router.get("/auth")
async def auth_get(request: Request):
    return templates.TemplateResponse(request, "auth.html", {"now_ts": int(time.time())})


@router.get("/login", include_in_schema=False)
async def login_redirect():
    return RedirectResponse("/auth#login", status_code=302)


@router.get("/register", include_in_schema=False)
async def register_redirect():
    return RedirectResponse("/auth#register", status_code=302)


@router.get("/restore", include_in_schema=False)
async def restore_redirect():
    return RedirectResponse("/auth#restore", status_code=302)


@router.post("/login")
async def login(request: Request, username: str = Form(...), password: str = Form(...)):
    try:
        async with WebUserService() as service:
            user = await service.authenticate(username, password)
    except Exception as exc:  # pragma: no cover - defensive
        context = base_context()
        context.update({"telegram_id": request.cookies.get("telegram_id"), "flash": f"Technical error: {exc}"})
        return templates.TemplateResponse(request, "auth.html", context, status_code=500)
    if not user:
        context = base_context()
        context.update({"telegram_id": request.cookies.get("telegram_id"), "flash": "Invalid credentials"})
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
