from __future__ import annotations

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from core.models import TgUser, WebUser, UserStats


async def ensure_tg_user(session: AsyncSession, telegram_id: int, **kwargs) -> TgUser:
    stmt = sa.select(TgUser).where(TgUser.telegram_id == telegram_id)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()
    if user is None:
        user = TgUser(telegram_id=telegram_id)
        session.add(user)
    for key, value in kwargs.items():
        setattr(user, key, value)
    await session.flush()
    return user


async def ensure_web_user(
    session: AsyncSession,
    *,
    user_id: int | None = None,
    username: str | None = None,
    **kwargs,
) -> WebUser:
    stmt = None
    if user_id is not None:
        stmt = sa.select(WebUser).where(WebUser.id == user_id)
    elif username is not None:
        stmt = sa.select(WebUser).where(sa.func.lower(WebUser.username) == username.lower())
    if stmt is not None:
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()
    else:
        user = None

    if user is None:
        params = {"username": username} if username is not None else {}
        if user_id is not None:
            params["id"] = user_id
        user = WebUser(**params)
        session.add(user)

    for key, value in kwargs.items():
        setattr(user, key, value)

    await session.flush()
    return user


async def ensure_user_stats(
    session: AsyncSession,
    owner_id: int,
    **kwargs,
) -> UserStats:
    stats = await session.get(UserStats, owner_id)
    if stats is None:
        stats = UserStats(owner_id=owner_id)
        session.add(stats)
    for key, value in kwargs.items():
        setattr(stats, key, value)
    await session.flush()
    return stats
