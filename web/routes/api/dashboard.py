from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from core.models import WebUser
from core.services.dashboard_service import build_dashboard_overview
from web.dependencies import get_current_web_user


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview")
async def dashboard_overview(current_user: WebUser | None = Depends(get_current_web_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    return await build_dashboard_overview(current_user)

