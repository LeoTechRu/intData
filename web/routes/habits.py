from fastapi import APIRouter, Depends, HTTPException, Request, status

from core.auth.owner import OwnerCtx, get_current_owner
from core.models import WebUser
from core.services.nexus_service import HabitService
from web.dependencies import get_current_web_user
from ..template_env import templates

ui_router = APIRouter(prefix="/habits", tags=["habits"], include_in_schema=False)


@ui_router.get("")
async def habits_page(
    request: Request,
    current_user: WebUser | None = Depends(get_current_web_user),
    owner: OwnerCtx | None = Depends(get_current_owner),
):
    if owner is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    habits = []
    if owner.has_tg:
        async with HabitService() as svc:
            habits = await svc.list_habits(owner_id=owner.owner_id)
    context = {
        "current_user": current_user,
        "current_role_name": getattr(current_user, "role", ""),
        "is_admin": getattr(current_user, "role", "") == "admin",
        "page_title": "Привычки",
        "habits": habits,
        "show_tg_cta": not owner.has_tg,
    }
    return templates.TemplateResponse(request, "habits.html", context)
