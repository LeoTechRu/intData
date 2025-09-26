"""Business logic for Telegram group moderation and analytics."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Sequence

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend import db
from backend.models import (
    Group,
    GroupActivityDaily,
    GroupRemovalLog,
    ProductStatus,
    TgUser,
    UserGroup,
    UserProduct,
)
from backend.utils import utcnow

from .crm_service import CRMService


@dataclass(slots=True)
class ActivityTotals:
    """Aggregated activity totals used for leaderboards and dashboards."""

    messages: int = 0
    reactions: int = 0
    last_activity: Optional[datetime] = None

    def bump(
        self,
        messages: int = 0,
        reactions: int = 0,
        last_activity: Optional[datetime] = None,
    ) -> None:
        self.messages += messages
        self.reactions += reactions
        if last_activity and (
            self.last_activity is None or last_activity > self.last_activity
        ):
            self.last_activity = last_activity


class GroupModerationService:
    """High-level helpers for roster management, activity stats and logs."""

    def __init__(
        self,
        session: Optional[AsyncSession] = None,
        *,
        crm: CRMService | None = None,
    ):
        self.session = session
        self._external = session is not None
        self._crm = crm

    async def __aenter__(self) -> "GroupModerationService":
        if self.session is None:
            self.session = db.async_session()
        if self._crm is None:
            self._crm = CRMService(self.session)
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if not self._external and self.session is not None:
            if exc_type is None:
                await self.session.commit()
            else:
                await self.session.rollback()
            await self.session.close()
        if not self._external:
            self.session = None
        self._crm = None

    @property
    def crm(self) -> CRMService:
        if self._crm is None:
            self._crm = CRMService(self.session)
        return self._crm

    # ------------------------------------------------------------------
    # Activity tracking
    # ------------------------------------------------------------------
    async def record_activity(
        self,
        *,
        group_id: int,
        user_id: int,
        messages: int = 0,
        reactions: int = 0,
        occurred_at: Optional[datetime] = None,
    ) -> GroupActivityDaily:
        """Increment counters for a given day without losing historical data."""

        occurred_at = occurred_at or utcnow()
        day = occurred_at.date()
        key = (group_id, user_id, day)
        record = await self.session.get(GroupActivityDaily, key)
        if record is None:
            record = GroupActivityDaily(
                group_id=group_id,
                user_id=user_id,
                activity_date=day,
                messages_count=0,
                reactions_count=0,
                last_activity_at=occurred_at,
            )
            self.session.add(record)
        record.messages_count += messages
        record.reactions_count += reactions
        if not record.last_activity_at or occurred_at > record.last_activity_at:
            record.last_activity_at = occurred_at
        record.updated_at = utcnow()
        return record

    async def activity_leaderboard(
        self,
        group_id: int,
        *,
        since: Optional[date] = None,
        limit: int = 10,
    ) -> List[Dict[str, Any]]:
        """Return aggregated activity and user metadata for leaderboards."""

        since = since or (date.today() - timedelta(days=7))
        stmt = (
            select(
                GroupActivityDaily.user_id,
                func.sum(GroupActivityDaily.messages_count).label("messages"),
                func.sum(GroupActivityDaily.reactions_count).label("reactions"),
                func.max(GroupActivityDaily.last_activity_at).label("last_activity"),
            )
            .where(
                GroupActivityDaily.group_id == group_id,
                GroupActivityDaily.activity_date >= since,
            )
            .group_by(GroupActivityDaily.user_id)
            .order_by(func.sum(GroupActivityDaily.messages_count).desc())
            .limit(limit)
        )
        rows = await self.session.execute(stmt)
        totals = rows.all()
        if not totals:
            return []
        user_stmt = select(TgUser).where(
            TgUser.telegram_id.in_([row.user_id for row in totals])
        )
        users_map = {
            user.telegram_id: user
            for user in (await self.session.execute(user_stmt)).scalars()
        }
        leaderboard: List[Dict[str, Any]] = []
        for row in totals:
            user = users_map.get(row.user_id)
            leaderboard.append(
                {
                    "user_id": row.user_id,
                    "user": user,
                    "messages": int(row.messages or 0),
                    "reactions": int(row.reactions or 0),
                    "last_activity": row.last_activity,
                }
            )
        return leaderboard

    async def _activity_totals_map(
        self,
        group_id: int,
        *,
        since: Optional[date] = None,
    ) -> Dict[int, ActivityTotals]:
        since = since or (date.today() - timedelta(days=30))
        stmt = (
            select(
                GroupActivityDaily.user_id,
                GroupActivityDaily.messages_count,
                GroupActivityDaily.reactions_count,
                GroupActivityDaily.last_activity_at,
            )
            .where(
                GroupActivityDaily.group_id == group_id,
                GroupActivityDaily.activity_date >= since,
            )
        )
        rows = await self.session.execute(stmt)
        aggregates: Dict[int, ActivityTotals] = defaultdict(ActivityTotals)
        for user_id, messages, reactions, last_activity in rows:
            aggregates[user_id].bump(
                messages=messages or 0,
                reactions=reactions or 0,
                last_activity=last_activity,
            )
        return aggregates

    # ------------------------------------------------------------------
    # Group roster & CRM metadata
    # ------------------------------------------------------------------
    async def update_member_profile(
        self,
        *,
        group_id: int,
        user_id: int,
        notes: Optional[str] = None,
        trial_expires_at: Optional[datetime] = None,
        tags: Optional[Sequence[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[UserGroup]:
        link = await self.session.get(UserGroup, (user_id, group_id))
        if not link:
            return None
        if notes is not None:
            link.crm_notes = notes
        if trial_expires_at is not None:
            link.trial_expires_at = trial_expires_at
        if tags is not None:
            link.crm_tags = list(tags)
        if metadata is not None:
            link.crm_metadata = metadata
        return link

    async def list_group_members(
        self,
        group_id: int,
        *,
        since: Optional[date] = None,
    ) -> List[Dict[str, Any]]:
        """Return roster with CRM metadata, products and activity totals."""

        link_rows = await self.session.execute(
            select(UserGroup, TgUser)
            .join(TgUser, TgUser.telegram_id == UserGroup.user_id)
            .where(UserGroup.group_id == group_id)
            .order_by(UserGroup.joined_at.asc())
        )
        pairs = link_rows.all()
        if not pairs:
            return []

        user_ids = [pair[0].user_id for pair in pairs]
        products_map = await self.crm.member_products(user_ids=user_ids)
        activity_map = await self._activity_totals_map(
            group_id, since=since
        )
        roster: List[Dict[str, Any]] = []
        for link, user in pairs:
            roster.append(
                {
                    "membership": link,
                    "user": user,
                    "products": products_map.get(link.user_id, []),
                    "activity": activity_map.get(link.user_id, ActivityTotals()),
                }
            )
        return roster

    async def members_without_product(
        self,
        *,
        group_id: int,
        product_id: int,
    ) -> List[UserGroup]:
        """List members of a group who lack a paid link to the given product."""

        rows = await self.session.execute(
            select(UserGroup)
            .outerjoin(
                UserProduct,
                (UserProduct.user_id == UserGroup.user_id)
                & (UserProduct.product_id == product_id)
                & (UserProduct.status == ProductStatus.paid),
            )
            .where(UserGroup.group_id == group_id, UserProduct.user_id.is_(None))
        )
        return rows.scalars().all()

    async def log_removal(
        self,
        *,
        group_id: int,
        user_id: int,
        product_id: Optional[int],
        initiator_web_id: Optional[int],
        initiator_tg_id: Optional[int],
        reason: Optional[str],
        result: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> GroupRemovalLog:
        entry = GroupRemovalLog(
            group_id=group_id,
            user_id=user_id,
            product_id=product_id,
            initiator_web_id=initiator_web_id,
            initiator_tg_id=initiator_tg_id,
            reason=reason,
            result=result,
            details=details or {},
        )
        self.session.add(entry)
        await self.session.flush()
        return entry

    async def removal_history(
        self,
        group_id: int,
        *,
        limit: int = 50,
    ) -> List[GroupRemovalLog]:
        stmt = (
            select(GroupRemovalLog)
            .where(GroupRemovalLog.group_id == group_id)
            .order_by(GroupRemovalLog.created_at.desc())
            .limit(limit)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    # ------------------------------------------------------------------
    # Dashboards
    # ------------------------------------------------------------------
    async def groups_overview(
        self,
        *,
        limit: int = 5,
        since_days: int = 7,
        group_ids: Optional[Sequence[int]] = None,
    ) -> List[Dict[str, Any]]:
        """Return aggregated moderation stats for selected groups."""

        if group_ids is not None:
            group_ids = [int(gid) for gid in group_ids if gid]
            if not group_ids:
                return []

        since = date.today() - timedelta(days=since_days)
        stmt: Select[Any] = (
            select(
                Group,
                func.count(UserGroup.user_id).label("members_total"),
            )
            .outerjoin(UserGroup, UserGroup.group_id == Group.telegram_id)
            .group_by(Group.id)
            .order_by(func.count(UserGroup.user_id).desc(), Group.title.asc())
            .limit(limit)
        )
        if group_ids is not None:
            stmt = stmt.where(Group.telegram_id.in_(group_ids))
        rows = await self.session.execute(stmt)
        overview: List[Dict[str, Any]] = []
        for group, members_total in rows.all():
            roster_rows = await self.session.execute(
                select(UserGroup.user_id).where(UserGroup.group_id == group.telegram_id)
            )
            user_ids = [row[0] for row in roster_rows]
            activity_map = await self._activity_totals_map(
                group.telegram_id, since=since
            )
            active_members = sum(
                1
                for totals in activity_map.values()
                if (totals.messages or totals.reactions)
            )
            quiet_members = max(0, int(members_total or 0) - active_members)
            last_activity = None
            for totals in activity_map.values():
                if totals.last_activity and (
                    last_activity is None or totals.last_activity > last_activity
                ):
                    last_activity = totals.last_activity
            products_map = await self.crm.member_products(user_ids=user_ids)
            paid_members = sum(
                1
                for links in products_map.values()
                if any(link.status == ProductStatus.paid for link in links)
            )
            unpaid_members = max(0, int(members_total or 0) - paid_members)
            overview.append(
                {
                    "group": group,
                    "members_total": int(members_total or 0),
                    "active_members": active_members,
                    "quiet_members": quiet_members,
                    "last_activity": last_activity,
                    "unpaid_members": unpaid_members,
                }
            )
        return overview


__all__ = ["GroupModerationService", "ActivityTotals"]
