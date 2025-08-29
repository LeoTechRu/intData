from __future__ import annotations

"""Pydantic schemas for PARA calendar and notification models."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

from core.models import CalendarItemStatus, NotificationChannelKind


class AreaSchema(BaseModel):
    id: int
    name: str
    color: str | None = None
    parent_id: int | None = None
    depth: int
    slug: str
    mp_path: str


class ProjectSchema(BaseModel):
    id: int
    name: str
    area_id: int
    status: str


class CalendarItemBase(BaseModel):
    title: str
    start_at: datetime
    end_at: datetime | None = None
    project_id: int | None = None
    area_id: int | None = None
    status: CalendarItemStatus = CalendarItemStatus.planned

    @field_validator("area_id")
    @classmethod
    def validate_para(cls, v, info):
        project_id = info.data.get("project_id") if hasattr(info, "data") else None
        if v is None and project_id is None:
            raise ValueError("project_id or area_id required")
        return v


class CalendarItemCreate(CalendarItemBase):
    pass


class CalendarItemRead(CalendarItemBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime


class AlarmBase(BaseModel):
    item_id: int
    trigger_at: datetime
    is_sent: bool = False


class AlarmCreate(AlarmBase):
    pass


class AlarmRead(AlarmBase):
    id: int
    created_at: datetime
    updated_at: datetime


class ChannelBase(BaseModel):
    kind: NotificationChannelKind
    address: str
    is_active: bool = True


class ChannelCreate(ChannelBase):
    pass


class ChannelRead(ChannelBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime


class ProjectNotificationBase(BaseModel):
    project_id: int
    channel_id: int
    is_enabled: bool = True


class ProjectNotificationCreate(ProjectNotificationBase):
    pass


class ProjectNotificationRead(ProjectNotificationBase):
    id: int
    created_at: datetime
    updated_at: datetime


class GCalLinkBase(BaseModel):
    calendar_id: str
    access_token: str | None = None
    refresh_token: str | None = None


class GCalLinkCreate(GCalLinkBase):
    pass


class GCalLinkRead(GCalLinkBase):
    id: int
    owner_id: int
    created_at: datetime
    updated_at: datetime
