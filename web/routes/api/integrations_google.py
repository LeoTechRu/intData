from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse, Response

from core.logger import logger
from core.models import WebUser
from core.services import (
    generate_auth_url,
    exchange_code,
    save_gcal_link,
    gcal_incremental,
)
from web.config import S
from web.dependencies import get_current_web_user

router = APIRouter()


@router.get("/connect")
async def connect(current_user: WebUser | None = Depends(get_current_web_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    redirect_uri = f"{S.PUBLIC_URL.rstrip('/')}/api/v1/integrations/google/callback"
    url = generate_auth_url(str(current_user.id), redirect_uri)
    return RedirectResponse(url)


@router.get("/callback")
async def callback(
    request: Request,
    code: str,
    state: str,
    current_user: WebUser | None = Depends(get_current_web_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    redirect_uri = f"{S.PUBLIC_URL.rstrip('/')}/api/v1/integrations/google/callback"
    token_data = await exchange_code(code, redirect_uri)
    await save_gcal_link(str(current_user.id), "primary", token_data)
    logger.info("gcal connected for user %s", current_user.id)
    return {"ok": True}


@router.post("/disconnect")
async def disconnect(current_user: WebUser | None = Depends(get_current_web_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    # Simple removal of link
    from core import db
    from core.models import GCalLink
    from sqlalchemy import delete

    async with db.async_session() as session:
        await session.execute(
            delete(GCalLink).where(
                GCalLink.user_id == str(current_user.id)
            )
        )
        await session.commit()
    logger.info("gcal disconnected for user %s", current_user.id)
    return {"ok": True}


@router.post("/webhook")
async def webhook(request: Request):
    token = request.headers.get("X-Goog-Channel-Token")
    # In this simple implementation, we expect token to be user_id
    if not token:
        return Response(status_code=200)
    try:
        user_id = token.split(":", 1)[0]
    except Exception:  # pragma: no cover
        return Response(status_code=200)
    await gcal_incremental(user_id, "primary")
    logger.debug("gcal webhook processed for %s", user_id)
    return Response(status_code=200)
