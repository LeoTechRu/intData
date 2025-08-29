from fastapi import APIRouter, Depends

from core.models import WebUser, UserRole
from core.services.web_user_service import WebUserService
from core.services.telegram_user_service import TelegramUserService
from ...dependencies import role_required


router = APIRouter(tags=["admin"])


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



@router.post("/restart")
async def restart_service(
    target: str, current_user: WebUser = Depends(role_required(UserRole.admin))
):
    """Restart systemd unit for 'web' or 'bot' (requires sudoers setup).

    Returns JSON with result. The service user must have passwordless sudo for
    the corresponding units, e.g. in /etc/sudoers.d/leonidpro:
        www-data ALL=NOPASSWD: /bin/systemctl restart leonidpro-web, /bin/systemctl restart leonidpro-bot
    """
    import asyncio

    units = {"web": "leonidpro-web", "bot": "leonidpro-bot"}
    if target not in units:
        raise HTTPException(status_code=400, detail="invalid target")
    cmd = f"sudo -n systemctl restart {units[target]}"
    try:
        proc = await asyncio.create_subprocess_shell(
            cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
        )
        out, err = await proc.communicate()
        ok = proc.returncode == 0
        return {
            "ok": ok,
            "code": proc.returncode,
            "stdout": (out or b"").decode().strip(),
            "stderr": (err or b"").decode().strip(),
        }
    except Exception as e:  # pragma: no cover
        return {"ok": False, "error": str(e)}
