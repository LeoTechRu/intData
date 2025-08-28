from fastapi import APIRouter, Depends

from core.models import WebUser, UserRole
from core.services.web_user_service import WebUserService
from core.services.telegram_user_service import TelegramUserService
from ...dependencies import role_required


router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/role/{telegram_id}")
async def api_change_user_role(
    telegram_id: int,
    role: str,
    current_user: WebUser = Depends(role_required(UserRole.admin)),
):
    async with TelegramUserService() as service:
        await service.update_user_role(telegram_id, UserRole[role])
    return {"status": "ok"}


@router.post("/web/role/{user_id}")
async def api_change_web_user_role(
    user_id: int,
    role: str,
    current_user: WebUser = Depends(role_required(UserRole.admin)),
):
    async with WebUserService() as service:
        await service.update_user_role(user_id, UserRole[role])
    return {"status": "ok"}


@router.post("/web/link")
async def api_link_web_user(
    web_user_id: int,
    tg_user_id: int,
    current_user: WebUser = Depends(role_required(UserRole.admin)),
):
    async with WebUserService() as service:
        await service.link_telegram(web_user_id, tg_user_id)
    return {"status": "ok"}


@router.post("/web/unlink")
async def api_unlink_web_user(
    web_user_id: int,
    tg_user_id: int,
    current_user: WebUser = Depends(role_required(UserRole.admin)),
):
    async with WebUserService() as service:
        await service.unlink_telegram(web_user_id, tg_user_id)
    return {"status": "ok"}

