from __future__ import annotations

from pathlib import Path
from typing import Dict, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from fastapi.templating import Jinja2Templates

from core.models import User, UserRole
from core.services.telegram import UserService

router = APIRouter(prefix="/profile", tags=["profile"])

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))


async def get_current_user(request: Request) -> User:
    """Extract current user from cookie, session or Authorization header."""
    user_id: Optional[int] = None

    # 1. Cookie set on login
    telegram_cookie = request.cookies.get("telegram_id")
    if telegram_cookie:
        try:
            user_id = int(telegram_cookie)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid telegram_id cookie") from exc

    # 2. Session
    if user_id is None and "session" in request.scope:
        user_id = request.session.get("user_id")

    # 3. Authorization header (Bearer token)
    if user_id is None:
        auth = request.headers.get("Authorization")
        if auth and auth.startswith("Bearer "):
            token = auth.split(" ", 1)[1]
            try:
                user_id = int(token)
            except ValueError as exc:
                raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    async with UserService() as user_service:
        user = await user_service.get_user_by_telegram_id(user_id)
        if user is None:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return user


@router.get("/{telegram_id}")
async def view_profile(
    telegram_id: int,
    request: Request,
    edit: bool = False,
    current_user: User = Depends(get_current_user),
):
    """Show profile page with optional edit mode."""
    if current_user.telegram_id != telegram_id and UserRole(current_user.role) != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    async with UserService() as service:
        info = await service.get_contact_info(telegram_id)
        if not info:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

    context = {
        "request": request,
        "profile_user": info["user"],
        "info": info,
        "groups": info["groups"],
        "editing": edit,
        "role_name": info["role_name"],
        "current_role_name": UserRole(current_user.role).name,
        "user": current_user,
        "is_admin": current_user.is_admin,
        "page_title": "Профиль",
    }
    return templates.TemplateResponse("profile.html", context)


@router.post("/{telegram_id}")
async def update_profile(
    telegram_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
):
    if current_user.telegram_id != telegram_id and UserRole(current_user.role) != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)

    form = await request.form()
    birthday_str = form.get("birthday")
    birthday = None
    if birthday_str:
        try:
            birthday = datetime.strptime(birthday_str, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Неверный формат даты")

    data = {
        "full_display_name": form.get("full_display_name"),
        "first_name": form.get("first_name"),
        "last_name": form.get("last_name"),
        "username": form.get("username"),
        "email": form.get("email"),
        "phone": form.get("phone"),
        "birthday": birthday,
        "language_code": form.get("language_code"),
    }

    async with UserService() as service:
        await service.update_user_profile(telegram_id, data)

    return RedirectResponse(
        url=f"/profile/{telegram_id}",
        status_code=status.HTTP_303_SEE_OTHER,
    )
