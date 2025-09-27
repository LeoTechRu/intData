"""Common dependencies for FastAPI routes in web app."""
from __future__ import annotations

import inspect
from typing import Optional, Sequence, Callable, Awaitable

from fastapi import Request, Depends, HTTPException, status

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from backend.models import WebUser, TgUser
from backend.services.web_user_service import WebUserService
from backend.services.telegram_user_service import TelegramUserService
from backend.services.access_control import (
    AccessControlService,
    AccessScope,
    EffectivePermissions,
)


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
        result = await service.session.execute(
            select(WebUser)
            .options(selectinload(WebUser.telegram_accounts))
            .where(WebUser.id == user_id)
        )
        return result.scalar_one_or_none()


async def get_current_tg_user(
    request: Request,
    current_user: Optional[WebUser] = Depends(get_current_web_user),
) -> Optional[TgUser]:
    raw = request.cookies.get("telegram_id")
    if raw:
        try:
            telegram_id = int(raw)
        except ValueError:
            return None
        async with TelegramUserService() as service:
            return await service.get_user_by_telegram_id(telegram_id)
    if current_user and current_user.telegram_accounts:
        return current_user.telegram_accounts[0]
    return None


async def get_effective_permissions(
    request: Request,
    *,
    current_user: Optional[WebUser] = None,
    scope: AccessScope = AccessScope.global_scope(),
) -> Optional[EffectivePermissions]:
    """Return cached effective permissions for the current request."""

    if current_user is None:
        current_user = await get_current_web_user(request)
    if not current_user:
        return None
    cache = getattr(request.state, "access_cache", {})
    key = (scope.scope_type, scope.scope_id)
    if key in cache:
        return cache[key]
    async with AccessControlService() as access:
        effective = await access.list_effective_permissions(
            current_user, scope=scope
        )
    cache[key] = effective
    request.state.access_cache = cache
    return effective


ScopeResolver = Callable[[Request], AccessScope | Awaitable[AccessScope]]


def permission_required(
    *permission_codes: str,
    roles: Sequence[str] | None = None,
    scope_resolver: ScopeResolver | None = None,
):
    """Ensure current user owns the requested permissions or roles."""

    async def verifier(
        request: Request,
        current_user: Optional[WebUser] = Depends(get_current_web_user),
    ) -> WebUser:
        if not current_user:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        scope = AccessScope.global_scope()
        if scope_resolver is not None:
            resolved = scope_resolver(request)
            scope = await resolved if inspect.isawaitable(resolved) else resolved
        effective = await get_effective_permissions(
            request,
            current_user=current_user,
            scope=scope,
        )
        if effective is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        if roles and not any(effective.has_role(role.lower()) for role in roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        normalized_codes = [code for code in permission_codes if code]
        if normalized_codes and not effective.has_all(normalized_codes):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Insufficient permissions",
            )
        return current_user

    return verifier


def role_required(*role_slugs: str):
    normalized = [slug.lower() for slug in role_slugs if slug]
    return permission_required(roles=normalized)


__all__ = [
    "get_current_web_user",
    "get_current_tg_user",
    "permission_required",
    "role_required",
    "get_effective_permissions",
]
