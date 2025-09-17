from __future__ import annotations

from typing import Any, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from core.models import (
    Project,
    TgUser,
    NotificationChannel,
    NotificationChannelKind,
    ProjectNotification,
)
from core.services.para_service import ParaService
from web.dependencies import get_current_tg_user

from .index import render_next_page


router = APIRouter(prefix="/projects", tags=["projects"])
ui_router = APIRouter(prefix="/projects", tags=["projects"], include_in_schema=False)


class ProjectCreate(BaseModel):
    name: str
    area_id: int
    description: Optional[str] = None
    slug: Optional[str] = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    area_id: int
    description: Optional[str]
    slug: Optional[str]

    @classmethod
    def from_model(cls, p: Project) -> "ProjectResponse":
        return cls(id=p.id, name=p.name, area_id=p.area_id, description=p.description, slug=p.slug)


@router.get("", response_model=List[ProjectResponse])
async def list_projects(current_user: TgUser | None = Depends(get_current_tg_user), area_id: int | None = Query(default=None), include_sub: int | None = Query(default=0)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with ParaService() as svc:
        if area_id is not None:
            items = await svc.list_projects_by_area(owner_id=current_user.telegram_id, area_id=area_id, include_sub=bool(include_sub))
        else:
            items = await svc.list_projects(owner_id=current_user.telegram_id)
    return [ProjectResponse.from_model(p) for p in items]


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(payload: ProjectCreate, current_user: TgUser | None = Depends(get_current_tg_user)):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with ParaService() as svc:
        try:
            p = await svc.create_project(
                owner_id=current_user.telegram_id,
                name=payload.name,
                area_id=payload.area_id,
                slug=payload.slug,
                description=payload.description,
            )
        except PermissionError as e:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    return ProjectResponse.from_model(p)


# ---------------------------------------------------------------------------
# Project notifications
# ---------------------------------------------------------------------------


class ChannelIn(BaseModel):
    type: NotificationChannelKind
    address: dict


class ProjectNotificationCreate(BaseModel):
    channel: ChannelIn
    rules: dict | None = None


class ProjectNotificationResponse(BaseModel):
    id: int
    channel: ChannelIn
    rules: dict | None = None

    @classmethod
    def from_models(
        cls, pn: ProjectNotification, ch: NotificationChannel
    ) -> "ProjectNotificationResponse":
        return cls(
            id=pn.id,
            channel=ChannelIn(type=ch.kind, address=ch.address),
            rules=pn.rules or {},
        )


@router.post(
    "/{project_id}/notifications",
    response_model=ProjectNotificationResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_project_notification(
    project_id: int,
    payload: ProjectNotificationCreate,
    current_user: TgUser | None = Depends(get_current_tg_user),
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    async with ParaService() as svc:
        project = await svc.session.get(Project, project_id)
        if not project or project.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)

        # Find or create channel
        from sqlalchemy import select

        stmt = select(NotificationChannel).where(
            NotificationChannel.owner_id == current_user.telegram_id,
            NotificationChannel.kind == payload.channel.type,
            NotificationChannel.address == payload.channel.address,
        )
        res = await svc.session.execute(stmt)
        channel = res.scalars().first()
        if channel is None:
            channel = NotificationChannel(
                owner_id=current_user.telegram_id,
                kind=payload.channel.type,
                address=payload.channel.address,
            )
            svc.session.add(channel)
            await svc.session.flush()

        pn = ProjectNotification(
            project_id=project_id,
            channel_id=channel.id,
            rules=payload.rules or {},
        )
        svc.session.add(pn)
        await svc.session.flush()

    return ProjectNotificationResponse.from_models(pn, channel)


@router.get(
    "/{project_id}/notifications",
    response_model=List[ProjectNotificationResponse],
)
async def list_project_notifications(
    project_id: int, current_user: TgUser | None = Depends(get_current_tg_user)
):
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    async with ParaService() as svc:
        project = await svc.session.get(Project, project_id)
        if not project or project.owner_id != current_user.telegram_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        from sqlalchemy import select

        stmt = (
            select(ProjectNotification, NotificationChannel)
            .join(NotificationChannel, ProjectNotification.channel_id == NotificationChannel.id)
            .where(ProjectNotification.project_id == project_id)
        )
        res = await svc.session.execute(stmt)
        items = [
            ProjectNotificationResponse.from_models(pn, ch) for pn, ch in res.all()
        ]
    return items


@ui_router.get("", include_in_schema=False, response_class=HTMLResponse)
@ui_router.get("/", include_in_schema=False, response_class=HTMLResponse)
async def projects_page() -> HTMLResponse:
    """Serve the Next.js Projects page."""

    return render_next_page("projects")


# Alias for centralized API mounting
api = router
