from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from fastapi import Request
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.models import WebUser, TgUser
from backend.services.web_user_service import WebUserService
from backend.services.telegram_user_service import TelegramUserService


@dataclass
class OwnerCtx:
    owner_id: int
    has_tg: bool
    tg_id: int | None
    web_user_id: int


async def _resolve_web_user(request: Request) -> Optional[WebUser]:
    raw = request.cookies.get("web_user_id")
    if not raw:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            raw = auth.split(" ", 1)[1]
    if not raw:
        return None
    try:
        uid = int(raw)
    except ValueError:
        return None
    async with WebUserService() as svc:
        res = await svc.session.execute(
            select(WebUser)
            .options(selectinload(WebUser.telegram_accounts))
            .where(WebUser.id == uid)
        )
        return res.scalar_one_or_none()


async def get_current_owner(request: Request) -> OwnerCtx | None:
    """Resolve current owner from request cookies/headers.

    Result is cached in ``request.state.owner`` to avoid duplicate DB hits
    during a single request lifecycle (FastAPI dependency chain).
    """

    cached = getattr(request.state, "owner", None)
    if cached is not None:
        return cached

    web_user = await _resolve_web_user(request)
    if web_user is None:
        request.state.owner = None
        return None

    tg_user: Optional[TgUser] = None
    raw_tg = request.cookies.get("telegram_id")
    if raw_tg:
        try:
            tg_id = int(raw_tg)
        except ValueError:
            tg_id = None
        if tg_id is not None:
            async with TelegramUserService() as svc:
                tg_user = await svc.get_user_by_telegram_id(tg_id)
    if tg_user is None and web_user.telegram_accounts:
        tg_user = web_user.telegram_accounts[0]

    owner_id = tg_user.telegram_id if tg_user else -web_user.id
    ctx = OwnerCtx(
        owner_id=owner_id,
        has_tg=tg_user is not None,
        tg_id=tg_user.telegram_id if tg_user else None,
        web_user_id=web_user.id,
    )
    request.state.owner = ctx
    return ctx
