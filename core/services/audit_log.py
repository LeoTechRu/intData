"""Audit log service for access-control operations."""
from __future__ import annotations

from typing import Optional, Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import AuthAuditEntry


class AuditLogService:
    """Persist audit events for security-sensitive operations."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "AuditLogService":
        if self.session is None:
            self.session = db.async_session()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if not self._external:
            if exc_type is None:
                await self.session.commit()
            else:  # pragma: no cover - defensive rollback
                await self.session.rollback()
            await self.session.close()

    async def log_role_assignment(
        self,
        *,
        actor_user_id: Optional[int],
        target_user_id: int,
        action: str,
        role_slug: Optional[str],
        scope_type: str,
        scope_id: Optional[int],
        details: Optional[dict[str, Any]] = None,
    ) -> AuthAuditEntry:
        entry = AuthAuditEntry(
            actor_user_id=actor_user_id,
            target_user_id=target_user_id,
            action=action,
            role_slug=role_slug,
            scope_type=scope_type,
            scope_id=scope_id,
            details=details or {},
        )
        self.session.add(entry)
        await self.session.flush()
        return entry

    async def list_recent(self, *, limit: int = 100) -> list[AuthAuditEntry]:
        """Return audit entries ordered from newest to oldest."""

        stmt = select(AuthAuditEntry).order_by(AuthAuditEntry.created_at.desc())
        if limit and limit > 0:
            stmt = stmt.limit(limit)
        result = await self.session.execute(stmt)
        return list(result.scalars().all())
