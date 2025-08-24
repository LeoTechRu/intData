"""Common dependencies for FastAPI routes in web app."""
from __future__ import annotations

from typing import Optional

from fastapi import Request, Depends, HTTPException, status

from core.models import WebUser, TgUser, UserRole
from core.services.web_user_service import WebUserService
from core.services.telegram_user_service import TelegramUserService


async def get_current_web_user(request: Request) -> Optional[WebUser]:
    """Return current web user based on cookie or Authorization header."""
    raw = request.cookies.get("web_user_id")
    if not raw:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            raw = auth.split(" ", 1)[1]
    if not raw:
        return None
    try:
        user_id = int(raw)
    except ValueError:
        return None
    async with WebUserService() as service:
        return await service.get_by_id(user_id)


async def get_current_tg_user(request: Request) -> Optional[TgUser]:
    raw = request.cookies.get("telegram_id")
    if not raw:
        return None
    try:
        telegram_id = int(raw)
    except ValueError:
        return None
    async with TelegramUserService() as service:
        return await service.get_by_telegram_id(telegram_id)


def role_required(required_role: UserRole | str):
    """Ensure current user has the required role."""

    required = (
        required_role if isinstance(required_role, UserRole) else UserRole[required_role]
    )

    async def verifier(
        current_user: Optional[WebUser] = Depends(get_current_web_user),
    ) -> WebUser:
        if not current_user:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        if UserRole[current_user.role].value < required.value:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return current_user

    return verifier
