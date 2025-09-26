"""Repositories for PARA calendar and notification models."""

from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.models import (
    Area,
    Project,
    CalendarItem,
    CalendarItemStatus,
    Alarm,
    NotificationChannel,
    NotificationChannelKind,
    ProjectNotification,
    GCalLink,
)
from backend.utils import utcnow
from .nexus_service import CRUDService
from .alarm_service import AlarmService


class AreaRepository(CRUDService[Area]):
    """CRUD repository for :class:`Area`."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(Area, session)


class ProjectRepository(CRUDService[Project]):
    """CRUD repository for :class:`Project`."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(Project, session)

    async def list(
        self,
        *,
        owner_id: Optional[int] = None,
        area_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> list[Project]:
        stmt = select(Project)
        if owner_id is not None:
            stmt = stmt.where(Project.owner_id == owner_id)
        if area_id is not None:
            stmt = stmt.where(Project.area_id == area_id)
        if status is not None:
            stmt = stmt.where(Project.status == status)
        res = await self.session.execute(stmt)
        return res.scalars().all()


class CalendarItemRepository(CRUDService[CalendarItem]):
    """Repository for calendar items with PARA validation."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(CalendarItem, session)

    async def create(
        self,
        *,
        owner_id: int,
        title: str,
        start_at: datetime,
        end_at: datetime | None = None,
        project_id: int | None = None,
        area_id: int | None = None,
        status: CalendarItemStatus = CalendarItemStatus.planned,
    ) -> CalendarItem:
        if project_id is None and area_id is None:
            raise ValueError("project_id or area_id is required")
        if project_id is not None and area_id is None:
            project = await self.session.get(Project, project_id)
            if not project:
                raise ValueError("project not found")
            area_id = project.area_id
        item = CalendarItem(
            owner_id=owner_id,
            title=title,
            start_at=start_at,
            end_at=end_at,
            project_id=project_id,
            area_id=area_id,
            status=status,
        )
        self.session.add(item)
        await self.session.flush()
        alarm_service = AlarmService(self.session)
        await alarm_service.create_alarm(item.id, utcnow())
        return item

    async def list(
        self,
        *,
        owner_id: Optional[int] = None,
        project_id: Optional[int] = None,
        area_id: Optional[int] = None,
        start_from: Optional[datetime] = None,
        start_to: Optional[datetime] = None,
        status: Optional[CalendarItemStatus] = None,
    ) -> list[CalendarItem]:
        stmt = select(CalendarItem).options(selectinload(CalendarItem.alarms))
        if owner_id is not None:
            stmt = stmt.where(CalendarItem.owner_id == owner_id)
        if project_id is not None:
            stmt = stmt.where(CalendarItem.project_id == project_id)
        if area_id is not None:
            stmt = stmt.where(CalendarItem.area_id == area_id)
        if start_from is not None:
            stmt = stmt.where(CalendarItem.start_at >= start_from)
        if start_to is not None:
            stmt = stmt.where(CalendarItem.start_at <= start_to)
        if status is not None:
            stmt = stmt.where(CalendarItem.status == status)
        res = await self.session.execute(stmt.order_by(CalendarItem.start_at))
        return res.scalars().all()

    async def update(self, obj_id: int, **kwargs) -> CalendarItem | None:
        obj = await super().update(obj_id, **kwargs)
        if obj is not None:
            obj.updated_at = utcnow()
            await self.session.flush()
        return obj


class AlarmRepository(CRUDService[Alarm]):
    """Repository for :class:`Alarm` objects."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(Alarm, session)

    async def list(
        self,
        *,
        item_id: Optional[int] = None,
        due_from: Optional[datetime] = None,
        due_to: Optional[datetime] = None,
        is_sent: Optional[bool] = None,
    ) -> list[Alarm]:
        stmt = select(Alarm)
        if item_id is not None:
            stmt = stmt.where(Alarm.item_id == item_id)
        if due_from is not None:
            stmt = stmt.where(Alarm.trigger_at >= due_from)
        if due_to is not None:
            stmt = stmt.where(Alarm.trigger_at <= due_to)
        if is_sent is not None:
            stmt = stmt.where(Alarm.is_sent == is_sent)
        res = await self.session.execute(stmt.order_by(Alarm.trigger_at))
        return res.scalars().all()

    async def update(self, obj_id: int, **kwargs) -> Alarm | None:
        obj = await super().update(obj_id, **kwargs)
        if obj is not None:
            obj.updated_at = utcnow()
            await self.session.flush()
        return obj


class ChannelRepository(CRUDService[NotificationChannel]):
    """Repository for user notification channels."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(NotificationChannel, session)

    async def list(
        self,
        *,
        owner_id: Optional[int] = None,
        kind: Optional[NotificationChannelKind] = None,
        is_active: Optional[bool] = None,
    ) -> list[NotificationChannel]:
        stmt = select(NotificationChannel)
        if owner_id is not None:
            stmt = stmt.where(NotificationChannel.owner_id == owner_id)
        if kind is not None:
            stmt = stmt.where(NotificationChannel.kind == kind)
        if is_active is not None:
            stmt = stmt.where(NotificationChannel.is_active == is_active)
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def update(self, obj_id: int, **kwargs) -> NotificationChannel | None:
        obj = await super().update(obj_id, **kwargs)
        if obj is not None:
            obj.updated_at = utcnow()
            await self.session.flush()
        return obj


class ProjectNotificationRepository(CRUDService[ProjectNotification]):
    """Repository for project notification subscriptions."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(ProjectNotification, session)

    async def list(
        self,
        *,
        project_id: Optional[int] = None,
        channel_id: Optional[int] = None,
        is_enabled: Optional[bool] = None,
    ) -> list[ProjectNotification]:
        stmt = select(ProjectNotification)
        if project_id is not None:
            stmt = stmt.where(ProjectNotification.project_id == project_id)
        if channel_id is not None:
            stmt = stmt.where(ProjectNotification.channel_id == channel_id)
        if is_enabled is not None:
            stmt = stmt.where(ProjectNotification.is_enabled == is_enabled)
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def update(self, obj_id: int, **kwargs) -> ProjectNotification | None:
        obj = await super().update(obj_id, **kwargs)
        if obj is not None:
            obj.updated_at = utcnow()
            await self.session.flush()
        return obj


class GCalLinkRepository(CRUDService[GCalLink]):
    """Repository for external Google Calendar links."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        super().__init__(GCalLink, session)

    async def list(
        self,
        *,
        owner_id: Optional[int] = None,
    ) -> list[GCalLink]:
        stmt = select(GCalLink)
        if owner_id is not None:
            stmt = stmt.where(GCalLink.owner_id == owner_id)
        res = await self.session.execute(stmt)
        return res.scalars().all()

    async def update(self, obj_id: int, **kwargs) -> GCalLink | None:
        obj = await super().update(obj_id, **kwargs)
        if obj is not None:
            obj.updated_at = utcnow()
            await self.session.flush()
        return obj
