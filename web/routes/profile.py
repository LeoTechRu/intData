from __future__ import annotations

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.templating import Jinja2Templates

from core.models import WebUser
from core.services.web_user_service import WebUserService
from web.dependencies import get_current_web_user

router = APIRouter(prefix="/profile", tags=["profile"])

TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
templates = Jinja2Templates(directory=str(TEMPLATE_DIR))
templates.env.globals.update(
    APP_BRAND_NAME="LeonidPro",
    APP_BASE_URL="https://leonid.pro",
    BOT_USERNAME="@LeonidBot",
    BOT_LANDING_URL="https://leonid.pro/bot",
)


@router.get("")
async def profile_root(
    current_user: Optional[WebUser] = Depends(get_current_web_user),
):
    from fastapi.responses import RedirectResponse
    from fastapi import status

    if current_user and current_user.role == "ban":
        return RedirectResponse(
            "/ban", status_code=status.HTTP_307_TEMPORARY_REDIRECT
        )
    if not current_user:
        return RedirectResponse(
            "/auth", status_code=status.HTTP_302_FOUND
        )
    return RedirectResponse(
        f"/profile/{current_user.username}",
        status_code=status.HTTP_302_FOUND,
    )


@router.get("/{username}")
async def view_profile(
    username: str,
    request: Request,
    edit: bool = False,
    current_user: Optional[WebUser] = Depends(get_current_web_user),
):
    from fastapi.responses import RedirectResponse
    from fastapi import status

    if current_user and current_user.role == "ban":
        return RedirectResponse(
            "/ban", status_code=status.HTTP_307_TEMPORARY_REDIRECT
        )
    async with WebUserService() as service:
        profile_user = await service.get_user_by_identifier(username)
    if not profile_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    if not current_user or (
        current_user.id != profile_user.id and current_user.role != "admin"
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    context = {
        "profile_user": profile_user,
        "editing": edit,
        "user": current_user,
    }
    return templates.TemplateResponse(request, "profile.html", context)


@router.post("/{username}")
async def update_profile(
    username: str,
    request: Request,
    current_user: Optional[WebUser] = Depends(get_current_web_user),
):
    from fastapi.responses import RedirectResponse
    from fastapi import status

    if current_user and current_user.role == "ban":
        return RedirectResponse(
            "/ban", status_code=status.HTTP_307_TEMPORARY_REDIRECT
        )
    async with WebUserService() as service:
        profile_user = await service.get_user_by_identifier(username)
        if not profile_user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        if not current_user or (
            current_user.id != profile_user.id and current_user.role != "admin"
        ):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
        form = await request.form()
        await service.update_profile(profile_user.id, dict(form))
    return RedirectResponse(
        f"/profile/{username}", status_code=status.HTTP_303_SEE_OTHER
    )
