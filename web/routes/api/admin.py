from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

import core.db as db
from core.models import WebUser
from core.services.web_user_service import WebUserService
from core.services.telegram_user_service import TelegramUserService
from core.services.audit_log import AuditLogService
from ...dependencies import role_required


router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/role/{telegram_id}")
async def api_change_user_role(
    telegram_id: int,
    role: str,
    current_user: WebUser = Depends(role_required("admin")),
):
    async with TelegramUserService() as service:
        await service.update_user_role(telegram_id, role)
    return {"status": "ok"}


@router.post("/web/role/{user_id}")
async def api_change_web_user_role(
    user_id: int,
    role: str,
    current_user: WebUser = Depends(role_required("admin")),
):
    async with WebUserService() as service:
        await service.update_user_role(
            user_id,
            role,
            actor_user_id=current_user.id,
        )
    return {"status": "ok"}


@router.post("/web/link")
async def api_link_web_user(
    web_user_id: int,
    tg_user_id: int,
    current_user: WebUser = Depends(role_required("admin")),
):
    async with WebUserService() as service:
        await service.link_telegram(web_user_id, tg_user_id)
    return {"status": "ok"}


@router.post("/web/unlink")
async def api_unlink_web_user(
    web_user_id: int,
    tg_user_id: int,
    current_user: WebUser = Depends(role_required("admin")),
):
    async with WebUserService() as service:
        await service.unlink_telegram(web_user_id, tg_user_id)
    return {"status": "ok"}



@router.post("/restart")
async def restart_service(
    target: str, current_user: WebUser = Depends(role_required("admin"))
):
    """Restart systemd unit for 'web' or 'bot' (requires sudoers setup).

    Returns JSON with result. The service user must have passwordless sudo for
    the corresponding units, e.g. in /etc/sudoers.d/intData:
        www-data ALL=NOPASSWD: /bin/systemctl restart intdata-web, /bin/systemctl restart intdata-bot
    """
    import asyncio

    units = {"web": "intdata-web", "bot": "intdata-bot"}
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


@router.get("/audit/logs")
async def list_audit_logs(
    limit: int = 100,
    current_user: WebUser = Depends(role_required("admin")),
):
    """Expose the access-control audit trail (migrated from NexusCore)."""

    limit = max(1, min(limit, 500))

    async with db.async_session() as session:  # type: ignore
        audit = AuditLogService(session)
        entries = await audit.list_recent(limit=limit)
        user_ids = {entry.target_user_id for entry in entries if entry.target_user_id}
        user_ids.update(
            uid for uid in (entry.actor_user_id for entry in entries) if uid
        )
        user_map = {}
        if user_ids:
            stmt = select(WebUser).where(WebUser.id.in_(user_ids))
            result = await session.execute(stmt)
            user_map = {user.id: user for user in result.scalars()}

    def _serialize_user(user_id: int | None) -> dict[str, int | None | str]:
        if not user_id:
            return {"id": None, "username": None, "full_name": None}
        user = user_map.get(user_id)
        if not user:
            return {"id": user_id, "username": None, "full_name": None}
        display_name = user.full_name or user.username
        return {
            "id": user.id,
            "username": user.username,
            "full_name": user.full_name,
            "display": display_name,
        }

    payload = []
    for entry in entries:
        payload.append(
            {
                "id": entry.id,
                "actor": _serialize_user(entry.actor_user_id),
                "target": _serialize_user(entry.target_user_id),
                "action": entry.action,
                "role_slug": entry.role_slug,
                "scope_type": entry.scope_type,
                "scope_id": entry.scope_id,
                "details": entry.details or {},
                "created_at": entry.created_at.isoformat()
                if entry.created_at
                else None,
            }
        )

    return payload
