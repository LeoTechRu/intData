from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates

from core.models import User, UserRole
from core.services.telegram import UserService

router = APIRouter(prefix="/profile", tags=["profile"])

# Configure templates relative to this file
TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))


async def get_current_user(request: Request) -> User:
    """Dependency that extracts the current user from cookie, session or Authorization header."""
    user_id: Optional[int] = None

    # 1. Try to read telegram_id from cookie set during login
    telegram_cookie = request.cookies.get("telegram_id")
    if telegram_cookie:
        try:
            user_id = int(telegram_cookie)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid telegram_id cookie") from exc

    # 2. Fallback to session
    if user_id is None and "session" in request.scope:
        user_id = request.session.get("user_id")

    # 3. Fallback to Authorization header (JWT/Bearer token)
    if user_id is None:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1]
            try:
                user_id = int(token)
            except ValueError as exc:  # invalid token format
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    async with UserService() as user_service:
        user = await user_service.get_user_by_telegram_id(user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user


@router.get("/{telegram_id}")
async def get_profile(
    request: Request,
    telegram_id: int,
    edit: bool = False,
    current_user: User = Depends(get_current_user),
):
    """Render profile page. Users may view only their own profile."""
    if telegram_id != current_user.telegram_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    async with UserService() as user_service:
        user = await user_service.get_user_by_telegram_id(telegram_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        groups = await user_service.list_user_groups(telegram_id)

    context = {
        "request": request,
        "user": user,
        "groups": groups,
        "editing": edit,
        "role_name": UserRole(user.role).name,
    }
    return templates.TemplateResponse("profile.html", context)


@router.post("/{telegram_id}")
async def update_profile(
    request: Request,
    telegram_id: int,
    current_user: User = Depends(get_current_user),
):
    """Update user profile with role-based access control."""
    if telegram_id != current_user.telegram_id and current_user.role < UserRole.moderator.value:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")

    try:
        data: Dict[str, Any] = await request.json()
    except Exception:
        form = await request.form()
        data = dict(form)

    async with UserService() as user_service:
        user = await user_service.get_user_by_telegram_id(telegram_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        for field, value in data.items():
            if hasattr(user, field):
                setattr(user, field, value)

    return RedirectResponse(url=f"/profile/{telegram_id}", status_code=status.HTTP_303_SEE_OTHER)
