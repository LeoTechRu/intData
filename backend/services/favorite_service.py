from __future__ import annotations

from typing import List, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from backend import db
from backend.models import UserFavorite


class FavoriteService:
    """CRUD helpers for :class:`UserFavorite`."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "FavoriteService":
        if self.session is None:
            self.session = db.async_session()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:  # pragma: no cover - similar to other services
        if not self._external:
            if exc_type is None:
                await self.session.commit()
            else:
                await self.session.rollback()
            await self.session.close()

    async def list_favorites(self, owner_id: int) -> List[UserFavorite]:
        res = await self.session.execute(
            select(UserFavorite).where(UserFavorite.owner_id == owner_id).order_by(UserFavorite.position)
        )
        return list(res.scalars())

    async def add_favorite(self, owner_id: int, label: str, path: str) -> UserFavorite:
        cnt = await self.session.scalar(
            select(func.count()).select_from(UserFavorite).where(UserFavorite.owner_id == owner_id)
        )
        if cnt and cnt >= 6:
            raise ValueError("limit")
        exists = await self.session.scalar(
            select(func.count()).select_from(UserFavorite).where(
                UserFavorite.owner_id == owner_id, UserFavorite.path == path
            )
        )
        if exists and exists > 0:
            raise ValueError("exists")
        max_pos = await self.session.scalar(
            select(func.max(UserFavorite.position)).where(UserFavorite.owner_id == owner_id)
        )
        fav = UserFavorite(owner_id=owner_id, label=label, path=path, position=(max_pos or 0) + 1)
        self.session.add(fav)
        await self.session.flush()
        return fav

    async def remove_favorite(self, owner_id: int, fav_id: int) -> None:
        fav = await self.session.get(UserFavorite, fav_id)
        if fav and fav.owner_id == owner_id:
            await self.session.delete(fav)

    async def update_favorite(
        self, owner_id: int, fav_id: int, label: Optional[str] = None, position: Optional[int] = None
    ) -> Optional[UserFavorite]:
        fav = await self.session.get(UserFavorite, fav_id)
        if not fav or fav.owner_id != owner_id:
            return None
        if label is not None:
            fav.label = label
        if position is not None:
            fav.position = position
        await self.session.flush()
        return fav
