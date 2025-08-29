from __future__ import annotations

import hmac, hashlib, os, time, json
from typing import Dict

import httpx

from fastapi import APIRouter, HTTPException, Request, Form, status
from fastapi.responses import HTMLResponse, RedirectResponse
from ..template_env import templates
from ..security.cookies import set_auth_cookies
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from sqlalchemy import select

from core.services.web_user_service import WebUserService
from core.services.telegram_user_service import TelegramUserService
from core.models import WebUser
from web.config import S
from web.security.authlog import log_event
from core.logger import logger
from urllib.parse import urlparse

router = APIRouter(tags=["auth"])

# itsdangerous serializer for magic links and short-lived tokens
serializer = URLSafeTimedSerializer(os.getenv("SECRET_KEY", S.BOT_TOKEN or ""))


async def verify_recaptcha_token(token: str | None) -> bool:
    """Validate reCAPTCHA token if configured."""

    if not S.RECAPTCHA_SECRET_KEY:
        return True
    if not token:
        return False
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://www.google.com/recaptcha/api/siteverify",
                data={"secret": S.RECAPTCHA_SECRET_KEY, "response": token},
                timeout=10,
            )
            data = resp.json()
            return data.get("success", False)
    except Exception:  # pragma: no cover - network failure
        return False


def base_context() -> Dict[str, object]:
    return {
        "page_title": "Авторизация",
        "now_ts": int(time.time()),
    }


def _config_diagnostics(request: Request) -> list[dict]:
    """Return a list of config issues and log them.

    Includes only non-secret info suitable for end-user screenshotting.
    """
    issues: list[dict] = []
    # Telegram Login
    if S.TG_LOGIN_ENABLED:
        if not S.BOT_TOKEN:
            issues.append({
                "code": "tg_login_no_token",
                "message": "Telegram Login включен, но отсутствует BOT_TOKEN.",
            })
        if not S.BOT_USERNAME:
            issues.append({
                "code": "tg_login_no_username",
                "message": "Telegram Login включен, но не задан BOT_USERNAME (без @).",
            })
    # Public URL mismatch
    try:
        want = urlparse(str(S.WEB_PUBLIC_URL))
        got = urlparse(str(request.base_url))
        if want.scheme and want.netloc and (want.scheme != got.scheme or want.netloc != got.netloc):
            issues.append({
                "code": "web_public_url_mismatch",
                "message": f"Ожидается {want.scheme}://{want.netloc}, а запрос пришёл на {got.scheme}://{got.netloc}.",
            })
    except Exception:
        pass

    # Log warnings once per request
    for it in issues:
        logger.warning("config: %s - %s", it.get("code"), it.get("message"))
    return issues


def render_auth(
    request: Request,
    active: str = "login",
    form_values: dict | None = None,
    form_errors: dict | None = None,
    flash: str | None = None,
    status_code: int | None = None,
    config_warnings: list[dict] | None = None,
):
    return templates.TemplateResponse(
        request,
        "auth.html",
        {
            "now_ts": int(time.time()),
            "active_tab": active,
            "form_values": form_values or {},
            "form_errors_json": json.dumps(form_errors or {}, ensure_ascii=False),
            "flash": flash,
            "config_warnings": config_warnings or _config_diagnostics(request),
        },
        status_code=status_code or 200,
    )


def login_user(request: Request, user: WebUser) -> RedirectResponse:
    """Set cookies for authenticated user and redirect home."""
    response = RedirectResponse("/", status_code=status.HTTP_303_SEE_OTHER)
    set_auth_cookies(response, web_user_id=user.id)
    return response


async def upsert_user_from_email(email: str) -> WebUser:
    """Get or create a web user by email.

    Username is derived from email local-part with a fallback suffix.
    """
    async with WebUserService() as wsvc:
        result = await wsvc.session.execute(select(WebUser).where(WebUser.email == email))
        user = result.scalar_one_or_none()
        if user:
            return user
        # Create a new user with a random password; user may change later via profile
        base_username = (email.split("@", 1)[0] or "user").strip().replace(" ", "_")
        candidate = base_username
        attempt = 1
        existing = await wsvc.get_by_username(candidate)
        while existing:
            attempt += 1
            candidate = f"{base_username}{attempt}"
            existing = await wsvc.get_by_username(candidate)
        password = os.urandom(16).hex()
        user = await wsvc.register(username=candidate, password=password, email=email)
        return user


async def send_magic_email(email: str, link: str) -> None:  # pragma: no cover - network
    """Send magic link email via SMTP using environment settings.

    Falls back to stdout if SMTP is not configured. Expected environment variables:

    - ``SMTP_HOST`` – SMTP server hostname
    - ``SMTP_PORT`` – SMTP port (defaults to ``587``)
    - ``SMTP_USER`` – username for authentication
    - ``SMTP_PASSWORD`` – password for authentication
    - ``EMAIL_FROM`` – sender address
    """
    host = os.getenv("SMTP_HOST")
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASSWORD")
    sender = os.getenv("EMAIL_FROM", user)
    port = int(os.getenv("SMTP_PORT", "587"))

    if not all([host, port, user, password, sender]):
        # No SMTP configuration; emulate sending
        print(f"[magic] send to {email}: {link}")
        return

    from email.message import EmailMessage
    import asyncio, smtplib

    def _send() -> None:
        msg = EmailMessage()
        msg["Subject"] = "Magic login link"
        msg["From"] = sender
        msg["To"] = email
        msg.set_content(f"Click the link to sign in: {link}")
        with smtplib.SMTP(host, port) as smtp:
            try:
                smtp.starttls()
            except Exception:
                pass
            smtp.login(user, password)
            smtp.send_message(msg)

    await asyncio.to_thread(_send)


def verify_telegram_auth(data: dict) -> dict:
    """Validate Telegram Login Widget signature."""
    token = S.BOT_TOKEN
    if not token:
        raise HTTPException(status_code=503, detail="Telegram login disabled (no BOT_TOKEN)")

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
    set_auth_cookies(response, web_user_id=user.id, telegram_id=info["id"])
    try:
        log_event(request, "tg_ok", user, {"tg_id": info.get("id")})
    except Exception:
        pass
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
    return render_auth(request, active=request.query_params.get("tab", "login"))


@router.get("/login", include_in_schema=False)
async def login_redirect():
    return RedirectResponse("/auth#login", status_code=302)


@router.get("/register", include_in_schema=False)
async def register_redirect():
    return RedirectResponse("/auth#register", status_code=302)


@router.get("/restore", include_in_schema=False)
async def restore_redirect():
    return RedirectResponse("/auth#restore", status_code=302)


@router.post("/auth/restore")
@router.post("/restore")
async def restore_password(
    request: Request,
    email: str = Form(...),
    form_ts: str = Form(""),
    hp_url: str = Form(""),
):
    """Password recovery request (stub).

    Logs the request and renders the restore tab with a flash message.
    """
    # Basic honeypot/anti-spam: ignore if hidden field is filled
    if hp_url:
        return render_auth(request, active="restore", form_values={"email": email})

    try:
        log_event(request, "restore_req", None, {"email": email})
    except Exception:
        pass
    return render_auth(
        request,
        active="restore",
        form_values={"email": email},
        flash="Если email существует — отправили ссылку для восстановления.",
    )


@router.post("/auth/login")
@router.post("/login")
async def login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    g_recaptcha_response: str | None = Form(None, alias="g-recaptcha-response"),
):
    if not await verify_recaptcha_token(g_recaptcha_response):
        return render_auth(
            request,
            active="login",
            form_values={"username": username},
            flash="reCAPTCHA validation failed",
            status_code=400,
        )
    try:
        async with WebUserService() as service:
            user = await service.authenticate(username, password)
    except Exception as exc:  # pragma: no cover - defensive
        return render_auth(
            request,
            active="login",
            form_values={"username": username},
            form_errors={"username": "Technical error", "password": str(exc)},
            flash=f"Technical error: {exc}",
            status_code=500,
        )
    if not user:
        try:
            log_event(request, "login_fail", None, {"username": username})
        except Exception:
            pass
        return render_auth(
            request,
            active="login",
            form_values={"username": username},
            form_errors={"username": "Неверный логин или пароль", "password": "Неверный логин или пароль"},
            flash="Invalid credentials",
            status_code=400,
        )
    if user.role == "ban":
        response = RedirectResponse("/ban", status_code=status.HTTP_307_TEMPORARY_REDIRECT)
        response.delete_cookie("web_user_id", path="/")
        response.delete_cookie("telegram_id", path="/")
        return response
    try:
        log_event(request, "login_ok", user)
    except Exception:
        pass
    return login_user(request, user)


@router.post("/auth/register")
@router.post("/register")
async def register(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    email: str | None = Form(None),
    phone: str | None = Form(None),
    g_recaptcha_response: str | None = Form(None, alias="g-recaptcha-response"),
):
    if not await verify_recaptcha_token(g_recaptcha_response):
        return render_auth(
            request,
            active="register",
            form_values={"username": username, "email": email},
            flash="reCAPTCHA validation failed",
            status_code=400,
        )
    async with WebUserService() as service:
        try:
            await service.register(username=username, password=password, email=email, phone=phone)
        except ValueError:
            from fastapi.responses import JSONResponse
            return JSONResponse({"detail": "username taken"}, status_code=400)
    return RedirectResponse("/auth", status_code=status.HTTP_303_SEE_OTHER)


@router.api_route("/auth/logout", methods=["GET", "POST"])
async def logout() -> RedirectResponse:
    """Clear auth cookies and redirect to login page."""
    response = RedirectResponse("/auth", status_code=status.HTTP_303_SEE_OTHER)
    response.delete_cookie("web_user_id", path="/")
    response.delete_cookie("telegram_id", path="/")
    return response


@router.api_route("/auth/tg/callback", methods=["GET", "POST"])
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
        set_auth_cookies(response, web_user_id=web_user.id, telegram_id=telegram_id)
        try:
            log_event(request, "tg_ok", web_user, {"tg_id": telegram_id})
        except Exception:
            pass
        return response
    response = RedirectResponse(
        "/auth/create_web_account", status_code=status.HTTP_303_SEE_OTHER
    )
    set_auth_cookies(response, telegram_id=telegram_id)
    return response


# Magic link flow
@router.post("/auth/magic/request")
async def magic_request(request: Request, email: str = Form(...), form_ts: str = Form("0"), hp_url: str = Form("")):
    """Request a magic login link via email with basic anti-bot checks."""
    # Honeypot field filled or submission too fast => treat as spam
    if hp_url:
        return render_auth(request, active="restore", form_values={"email": email})
    try:
        ts = int(form_ts)
    except ValueError:
        ts = 0
    if ts and time.time() - ts < 3:  # submitted too quickly after form render
        return render_auth(request, active="restore", form_values={"email": email})

    token = serializer.dumps({"email": email, "kind": "magic"})
    magic_url = f"{os.getenv('APP_BASE_URL','https://leonid.pro')}/auth/magic?token={token}"
    try:
        await send_magic_email(email, magic_url)  # если есть почтовик
    except Exception:
        print("MAGIC:", magic_url)
    return render_auth(
        request,
        active="restore",
        form_values={"email": email},
        flash="Если email существует — отправили ссылку для входа.",
    )


@router.get("/auth/magic")
async def magic_consume(request: Request, token: str):
    try:
        data = serializer.loads(token, max_age=60 * 30)  # 30 минут
        if data.get("kind") != "magic":
            raise BadSignature("kind")
        email = data["email"]
    except (BadSignature, SignatureExpired):
        return render_auth(request, active="login", flash="Ссылка недействительна или устарела.")

    # Найти/создать пользователя по email и залогинить
    user = await upsert_user_from_email(email)  # подменить на вашу реализацию
    if getattr(user, "role", "") == "ban":
        return RedirectResponse("/ban", status_code=307)
    try:
        log_event(request, "magic_ok", user, {"email": email})
    except Exception:
        pass
    return login_user(request, user)


@router.get("/auth/create_web_account", response_class=HTMLResponse)
async def create_web_account_page(request: Request) -> HTMLResponse:
    telegram_id = request.cookies.get("telegram_id")
    if not telegram_id:
        return RedirectResponse("/auth", status_code=status.HTTP_303_SEE_OTHER)
    # Unified auth page: open the register tab
    return RedirectResponse("/auth#register", status_code=status.HTTP_303_SEE_OTHER)


@router.post("/auth/create_web_account")
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
        response = RedirectResponse("/auth", status_code=status.HTTP_303_SEE_OTHER)
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
    set_auth_cookies(response, web_user_id=web_user.id, telegram_id=telegram_id)
    return response
