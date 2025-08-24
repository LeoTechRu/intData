from __future__ import annotations

from typing import Optional, Any, Union
from datetime import datetime

import bcrypt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import WebUser, TgUser


def _parse_birthday(value: Optional[str]):
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise ValueError("Invalid date format")


class WebUserService:
    """Service for web users and authentication."""

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "WebUserService":
        if self.session is None:
            self.session = db.async_session()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if not self._external:
            if exc_type is None:
                await self.session.commit()
            else:
                await self.session.rollback()
            await self.session.close()

    async def get_by_id(self, user_id: int) -> Optional[WebUser]:
        return await self.session.get(WebUser, user_id)

    async def get_by_username(self, username: str) -> Optional[WebUser]:
        result = await self.session.execute(select(WebUser).where(WebUser.username == username))
        return result.scalar_one_or_none()

    async def register(self, *, username: str, password: str, email: Optional[str] = None, phone: Optional[str] = None) -> WebUser:
        if await self.get_by_username(username):
            raise ValueError("username taken")
        hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
        user = WebUser(username=username, password_hash=hashed, email=email, phone=phone)
        self.session.add(user)
        await self.session.flush()
        return user

    async def authenticate(self, username: str, password: str) -> Optional[WebUser]:
        user = await self.get_by_username(username)
        if not user:
            return None
        if not user.password_hash:
            return None
        if bcrypt.checkpw(password.encode(), user.password_hash.encode()):
            return user
        return None

    async def link_telegram(self, web_user_id: int, tg_user_id: int) -> WebUser:
        web_user = await self.get_by_id(web_user_id)
        tg_user = await self.session.get(TgUser, tg_user_id)
        if web_user is None or tg_user is None:
            raise ValueError("user not found")
        if web_user.telegram_user_id:
            raise ValueError("web user already linked")
        result = await self.session.execute(select(WebUser).where(WebUser.telegram_user_id == tg_user_id))
        if result.scalar_one_or_none():
            raise ValueError("telegram user already linked")
        web_user.telegram_user_id = tg_user_id
        await self.session.flush()
        return web_user

    async def unlink_telegram(self, web_user_id: int) -> WebUser:
        web_user = await self.get_by_id(web_user_id)
        if web_user is None:
            raise ValueError("user not found")
        web_user.telegram_user_id = None
        await self.session.flush()
        return web_user

    async def update_profile(self, web_user_id: int, data: dict[str, Any]) -> Optional[WebUser]:
        user = await self.get_by_id(web_user_id)
        if not user:
            return None
        if "birthday" in data:
            birthday = data.get("birthday")
            if isinstance(birthday, str):
                birthday = _parse_birthday(birthday)
            user.birthday = birthday
        for field in ["full_name", "email", "phone", "language", "privacy_settings"]:
            if field in data and data[field] is not None:
                setattr(user, field, data[field])
        await self.session.flush()
        return user

    async def get_user_by_identifier(self, identifier: Union[int, str]) -> Optional[WebUser]:
        if isinstance(identifier, int) or (isinstance(identifier, str) and identifier.isdigit()):
            telegram_id = int(identifier)
            result = await self.session.execute(
                select(WebUser).join(TgUser, WebUser.telegram_user_id == TgUser.id).where(TgUser.telegram_id == telegram_id)
            )
            return result.scalar_one_or_none()
        else:
            return await self.get_by_username(str(identifier))
