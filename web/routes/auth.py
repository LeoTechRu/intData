from __future__ import annotations

import hashlib
import hmac
import json
import os
import time
from typing import Dict
from base64 import urlsafe_b64encode
from urllib.parse import urlencode, urlparse

import httpx
from fastapi import APIRouter, Form, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse, RedirectResponse
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer
from sqlalchemy import select

from core.logger import logger
from core.models import WebUser
from core.services.telegram_user_service import TelegramUserService
from core.services.web_user_service import WebUserService
from web.config import S
from web.security.authlog import log_event
from web.security.cookies import set_auth_cookies
from .index import render_next_page

router = APIRouter(tags=["auth"])

# itsdangerous serializer for magic links and short-lived tokens
serializer = URLSafeTimedSerializer(os.getenv("SECRET_KEY", S.TG_BOT_TOKEN or ""))


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


def _config_diagnostics(request: Request) -> list[dict]:
    """Return a list of config issues and log them.

    Includes only non-secret info suitable for end-user screenshotting.
    """
    issues: list[dict] = []
    # Telegram Login
    if S.TG_LOGIN_ENABLED:
        if not S.TG_BOT_TOKEN:
            issues.append(
                {
                    "code": "tg_login_no_token",
                    "message": "Telegram Login включен, но отсутствует TG_BOT_TOKEN.",
                }
            )
        if not S.TG_BOT_USERNAME:
            issues.append(
                {
                    "code": "tg_login_no_username",
                    "message": "Telegram Login включен, но не задан TG_BOT_USERNAME (без @).",
                }
            )
    # Public URL mismatch
    try:
        want = urlparse(str(S.PUBLIC_URL))
        got = urlparse(str(request.base_url))
        if (
            want.scheme
            and want.netloc
            and (want.scheme != got.scheme or want.netloc != got.netloc)
        ):
            issues.append(
                {
                    "code": "PUBLIC_URL_mismatch",
                    "message": f"Ожидается {want.scheme}://{want.netloc}, а запрос пришёл на {got.scheme}://{got.netloc}.",
                }
            )
    except Exception:
        pass

    # Log warnings once per request
    for it in issues:
        logger.warning("config: %s - %s", it.get("code"), it.get("message"))
    return issues


def wants_json(request: Request) -> bool:
    accept = (request.headers.get("accept") or "").lower()
    if "application/json" in accept:
        return True
    if request.headers.get("x-requested-with", "").lower() == "xmlhttprequest":
        return True
    if request.headers.get("hx-request"):
        return True
    return False


def _encode_payload(payload: dict[str, object | None]) -> str:
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    return urlsafe_b64encode(data.encode("utf-8")).decode("ascii").rstrip("=")


def _normalize_next(value: str | None) -> str | None:
    if not value:
        return None
    value = value.strip()
    if not value:
        return None
    if value.startswith("//"):
        return None
    if value.startswith("http://") or value.startswith("https://"):
        return None
    if not value.startswith("/"):
        return None
    return value


def auth_feedback(
    request: Request,
    *,
    active: str,
    ok: bool = False,
    flash: str | None = None,
    form_values: dict[str, object] | None = None,
    form_errors: dict[str, object] | None = None,
    status_code: int | None = None,
    redirect_to: str | None = None,
) -> JSONResponse | RedirectResponse:
    payload = {
        "ok": ok,
        "active": active,
        "flash": flash,
        "form_values": form_values or {},
        "form_errors": form_errors or {},
        "redirect": redirect_to,
        "config_warnings": _config_diagnostics(request),
    }
    code = status_code or (200 if ok else 400)
    if wants_json(request):
        return JSONResponse(payload, status_code=code)

    query: dict[str, str] = {"tab": active}
    if flash:
        query["flash"] = flash
    if redirect_to:
        query["redirect"] = redirect_to
    if form_values:
        query["values"] = _encode_payload(form_values)
    if form_errors:
        query["errors"] = _encode_payload(form_errors)
    encoded = urlencode(query)
    target = f"/auth?{encoded}" if encoded else "/auth"
    return RedirectResponse(target, status_code=status.HTTP_303_SEE_OTHER)


def get_auth_public_options(request: Request) -> dict[str, object]:
    tg_username = S.TG_BOT_USERNAME or "IntDataBot"
    return {
        "brand_name": S.BRAND_NAME or "Intelligent Data Pro",
        "tagline": "Ваш цифровой второй мозг для профессионального мышления и продуктивной работы",
        "tg_login_enabled": bool(S.TG_LOGIN_ENABLED),
        "tg_bot_username": tg_username,
        "tg_bot_login_url": f"https://t.me/{tg_username.lstrip('@')}" if S.TG_LOGIN_ENABLED else None,
        "recaptcha_site_key": S.RECAPTCHA_SITE_KEY or None,
        "magic_link_enabled": True,
        "config_warnings": _config_diagnostics(request),
    }


def login_user(
    request: Request,
    user: WebUser,
    *,
    next_url: str | None = None,
    prefer_json: bool = False,
    telegram_id: int | None = None,
):
    target = _normalize_next(next_url) or _normalize_next(request.query_params.get("next")) or "/"
    if prefer_json:
        response: Response = JSONResponse({"ok": True, "redirect": target})
    else:
        response = RedirectResponse(target, status_code=status.HTTP_303_SEE_OTHER)
    set_auth_cookies(response, web_user_id=user.id, telegram_id=telegram_id)
    return response


async def upsert_user_from_email(email: str) -> WebUser:
    """Get or create a web user by email.

    Username is derived from email local-part with a fallback suffix.
    """
    async with WebUserService() as wsvc:
        result = await wsvc.session.execute(
            select(WebUser).where(WebUser.email == email)
        )
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

    import asyncio
    import smtplib
    from email.message import EmailMessage

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
    token = S.TG_BOT_TOKEN
    if not S.TG_LOGIN_ENABLED or not token:
        raise HTTPException(status_code=503, detail="Telegram login disabled")

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
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid auth_date") from exc

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
    if not S.TG_LOGIN_ENABLED or not S.TG_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram login disabled")
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
    secret = hashlib.sha256(S.TG_BOT_TOKEN.encode()).digest()
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
    return render_next_page("auth")


@router.get("/login", include_in_schema=False)
async def login_redirect():
    return RedirectResponse("/auth", status_code=302)


@router.post("/auth/restore")
@router.post("/restore")
async def restore_password(
    request: Request,
    username: str = Form(...),
):
    """Send password reset email if user exists and has email."""
    async with WebUserService() as service:
        user = await service.get_by_username(username)
    if not user:
        return JSONResponse({"detail": "Пользователь не найден"}, status_code=404)
    if not user.email:
        return JSONResponse(
            {"detail": "У пользователя не указан email"}, status_code=400
        )
    try:
        token = serializer.dumps({"email": user.email, "kind": "magic"})
        magic_url = f"{os.getenv('APP_BASE_URL', 'https://intdata.pro')}/auth/magic?token={token}"
        await send_magic_email(user.email, magic_url)
        log_event(request, "restore_req", user, {"email": user.email})
    except Exception:
        pass
    return JSONResponse(
        {"detail": "Если email существует — отправили ссылку для восстановления."}
    )


@router.post("/auth/login")
@router.post("/login")
async def login(
    request: Request,
    username: str = Form(...),
    password: str = Form(...),
    g_recaptcha_response: str | None = Form(None, alias="g-recaptcha-response"),
    next_url: str | None = Form(None, alias="next"),
):
    prefer_json = wants_json(request)
    if not await verify_recaptcha_token(g_recaptcha_response):
        return auth_feedback(
            request,
            active="login",
            form_values={"username": username},
            flash="Проверка reCAPTCHA не пройдена",
            status_code=400,
        )

    user: WebUser | None = None
    try:
        async with WebUserService() as service:
            user = await service.authenticate(username, password)
            if not user:
                existing = await service.get_by_username(username)
                if existing:
                    if existing.email:
                        try:
                            token = serializer.dumps(
                                {
                                    "email": existing.email,
                                    "kind": "magic",
                                }
                            )
                            magic_url = f"{os.getenv('APP_BASE_URL', 'https://intdata.pro')}/auth/magic?token={token}"
                            await send_magic_email(existing.email, magic_url)
                            log_event(
                                request,
                                "restore_req",
                                existing,
                                {"email": existing.email},
                            )
                        except Exception:
                            pass
                    try:
                        log_event(request, "login_fail", None, {"username": username})
                    except Exception:
                        pass
                    return auth_feedback(
                        request,
                        active="login",
                        form_values={"username": username},
                        form_errors={
                            "username": "Неверный логин или пароль",
                            "password": "Неверный логин или пароль",
                        },
                        flash="Неверный логин или пароль",
                        status_code=400,
                    )
                try:
                    new_user = await service.register(username=username, password=password)
                except ValueError:
                    return auth_feedback(
                        request,
                        active="login",
                        form_values={"username": username},
                        flash="Не удалось создать пользователя",
                        status_code=400,
                    )

                telegram_cookie = request.cookies.get("telegram_id")
                tg_id_int: int | None = None
                if telegram_cookie:
                    try:
                        tg_id_int = int(telegram_cookie)
                    except ValueError:
                        tg_id_int = None
                if tg_id_int is not None:
                    async with TelegramUserService() as tsvc:
                        tg_user = await tsvc.get_user_by_telegram_id(tg_id_int)
                    if tg_user:
                        await service.link_telegram(new_user.id, tg_user.id)
                    else:
                        tg_id_int = None
                try:
                    log_event(request, "register_ok", new_user)
                except Exception:
                    pass

                redirect_target = _normalize_next(next_url) or f"/users/{new_user.username}?edit=1"
                return login_user(
                    request,
                    new_user,
                    next_url=redirect_target,
                    prefer_json=prefer_json,
                    telegram_id=tg_id_int,
                )
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("login: unexpected error")
        return auth_feedback(
            request,
            active="login",
            form_values={"username": username},
            form_errors={
                "username": "Техническая ошибка",
                "password": "Техническая ошибка",
            },
            flash="Техническая ошибка. Попробуйте ещё раз позже.",
            status_code=500,
        )

    assert user is not None
    if user.role == "ban":
        if prefer_json:
            response = JSONResponse(
                {
                    "ok": False,
                    "redirect": "/ban",
                    "flash": "Доступ к аккаунту заблокирован",
                },
                status_code=status.HTTP_403_FORBIDDEN,
            )
        else:
            response = RedirectResponse(
                "/ban", status_code=status.HTTP_307_TEMPORARY_REDIRECT
            )
        response.delete_cookie("web_user_id", path="/")
        response.delete_cookie("telegram_id", path="/")
        return response
    try:
        log_event(request, "login_ok", user)
    except Exception:
        pass
    return login_user(
        request,
        user,
        next_url=next_url,
        prefer_json=prefer_json,
    )


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
    if not S.TG_LOGIN_ENABLED or not S.TG_BOT_TOKEN:
        raise HTTPException(status_code=503, detail="Telegram login disabled")
    if request.method == "POST":
        data = dict((await request.form()).items())
    else:
        data = dict(request.query_params.items())
    if not verify_telegram_login(data):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Bad Telegram signature"
        )
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
            response = RedirectResponse(
                "/ban", status_code=status.HTTP_307_TEMPORARY_REDIRECT
            )
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
    response = RedirectResponse("/auth", status_code=status.HTTP_303_SEE_OTHER)
    set_auth_cookies(response, telegram_id=telegram_id)
    return response


# Magic link flow
@router.post("/auth/magic/request")
async def magic_request(
    request: Request,
    email: str = Form(...),
    form_ts: str = Form("0"),
    hp_url: str = Form(""),
):
    """Request a magic login link via email with basic anti-bot checks."""
    # Honeypot field filled or submission too fast => treat as spam
    if hp_url:
        return auth_feedback(
            request,
            active="restore",
            form_values={"email": email},
            status_code=200,
        )
    try:
        ts = int(form_ts)
    except ValueError:
        ts = 0
    if ts and time.time() - ts < 3:  # submitted too quickly after form render
        return auth_feedback(
            request,
            active="restore",
            form_values={"email": email},
            status_code=200,
        )

    token = serializer.dumps({"email": email, "kind": "magic"})
    magic_url = (
        f"{os.getenv('APP_BASE_URL', 'https://intdata.pro')}/auth/magic?token={token}"
    )
    try:
        await send_magic_email(email, magic_url)  # если есть почтовик
    except Exception:
        print("MAGIC:", magic_url)
    return auth_feedback(
        request,
        active="restore",
        ok=True,
        form_values={"email": email},
        flash="Если email существует — отправили ссылку для входа.",
        status_code=200,
    )


@router.get("/auth/magic")
async def magic_consume(request: Request, token: str):
    try:
        data = serializer.loads(token, max_age=60 * 30)  # 30 минут
        if data.get("kind") != "magic":
            raise BadSignature("kind")
        email = data["email"]
    except (BadSignature, SignatureExpired):
        return auth_feedback(
            request,
            active="login",
            flash="Ссылка недействительна или устарела.",
            status_code=400,
        )

    # Найти/создать пользователя по email и залогинить
    user = await upsert_user_from_email(email)  # подменить на вашу реализацию
    if getattr(user, "role", "") == "ban":
        return RedirectResponse("/ban", status_code=307)
    try:
        log_event(request, "magic_ok", user, {"email": email})
    except Exception:
        pass
    return login_user(
        request,
        user,
        prefer_json=wants_json(request),
    )
