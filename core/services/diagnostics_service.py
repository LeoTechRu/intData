"""Business logic for diagnostics specialists, clients and results."""
from __future__ import annotations

import re
import secrets
from datetime import datetime, timezone
from typing import Any, Optional, Sequence

from sqlalchemy import Select, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core import db
from core.db import bcrypt
from core.models import (
    DiagnosticClient,
    DiagnosticResult,
    WebUser,
)
from core.services.access_control import AccessControlService, AccessScope
from core.services.web_user_service import WebUserService
from core.utils import utcnow

USERNAME_SANITIZE_RE = re.compile(r"[^a-z0-9]+")
DEFAULT_CLIENT_USERNAME_PREFIX = "diagnostic"


class DiagnosticsService:
    """Diagnostics domain operations wrapper."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "DiagnosticsService":
        if self.session is None:
            self.session = db.async_session()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if not self._external and self.session is not None:
            if exc_type is None:
                await self.session.commit()
            else:  # pragma: no cover - defensive rollback
                await self.session.rollback()
            await self.session.close()
        if not self._external:
            self.session = None

    # ------------------------------------------------------------------
    # Specialist helpers
    # ------------------------------------------------------------------

    async def authenticate_basic(
        self, *, login: str, password: str
    ) -> Optional[WebUser]:
        """Authenticate diagnostics specialist using Basic Auth credentials."""

        login = login.strip()
        if not login:
            return None
        wsvc = WebUserService(self.session)
        user = await wsvc.authenticate(login, password)
        if not user:
            # Fallback to email lookup when username differs from login
            result = await self.session.execute(
                select(WebUser).where(func.lower(WebUser.email) == login.lower())
            )
            candidate = result.scalar_one_or_none()
            if candidate and candidate.password_hash and candidate.check_password(password):
                user = candidate
        if not user:
            return None
        if not user.diagnostics_enabled or not user.diagnostics_active:
            return None
        return user

    async def list_specialists(self) -> list[WebUser]:
        stmt = (
            select(WebUser)
            .where(WebUser.diagnostics_enabled.is_(True))
            .options(selectinload(WebUser.diagnostic_profile))
            .order_by(WebUser.id.asc())
        )
        rows = await self.session.execute(stmt)
        return rows.scalars().all()

    async def get_specialist(self, specialist_id: int) -> Optional[WebUser]:
        result = await self.session.execute(
            select(WebUser).where(WebUser.id == specialist_id)
        )
        user = result.scalar_one_or_none()
        if user and user.diagnostics_enabled:
            return user
        return None

    async def ensure_specialist_role(
        self, user: WebUser, *, actor_user_id: Optional[int] = None
    ) -> None:
        async with AccessControlService(self.session) as access:
            await access.grant_role(
                target_user_id=user.id,
                role_slug="diagnostics_specialist",
                actor_user_id=actor_user_id,
                scope=AccessScope.global_scope(),
            )

    async def ensure_admin_role(
        self, user: WebUser, *, actor_user_id: Optional[int] = None
    ) -> None:
        async with AccessControlService(self.session) as access:
            await access.grant_role(
                target_user_id=user.id,
                role_slug="diagnostics_admin",
                actor_user_id=actor_user_id,
                scope=AccessScope.global_scope(),
            )

    async def ensure_client_role(
        self, user: WebUser, *, actor_user_id: Optional[int] = None
    ) -> None:
        async with AccessControlService(self.session) as access:
            await access.grant_role(
                target_user_id=user.id,
                role_slug="diagnostics_client",
                actor_user_id=actor_user_id,
                scope=AccessScope.global_scope(),
            )

    async def has_permission(self, user: WebUser, code: str) -> bool:
        async with AccessControlService(self.session) as access:
            effective = await access.list_effective_permissions(
                user, scope=AccessScope.global_scope()
            )
        return effective.has(code)

    async def is_admin(self, user: WebUser) -> bool:
        async with AccessControlService(self.session) as access:
            effective = await access.list_effective_permissions(
                user, scope=AccessScope.global_scope()
            )
        return effective.has_role("diagnostics_admin") or effective.has_role("admin")

    async def create_specialist(
        self,
        *,
        login: str,
        password: str,
        name: Optional[str] = None,
        surname: Optional[str] = None,
        phone: Optional[str] = None,
        available_diagnostics: Sequence[int] | None = None,
        actor_user_id: Optional[int] = None,
    ) -> WebUser:
        username = login.strip()
        if not username:
            raise ValueError("Login must not be empty")
        wsvc = WebUserService(self.session)
        user = await wsvc.register(username=username, password=password, email=login)
        display_parts = [part for part in (name, surname) if part]
        if display_parts:
            user.full_name = " ".join(display_parts)
        user.email = login
        user.phone = phone
        user.diagnostics_enabled = True
        user.diagnostics_active = True
        if available_diagnostics is not None:
            user.diagnostics_available = sorted(set(int(x) for x in available_diagnostics))
        await self.session.flush()
        await self.ensure_specialist_role(user, actor_user_id=actor_user_id)
        return user

    async def update_specialist(
        self,
        user: WebUser,
        *,
        login: Optional[str] = None,
        password: Optional[str] = None,
        name: Optional[str] = None,
        surname: Optional[str] = None,
        phone: Optional[str] = None,
        available_diagnostics: Sequence[int] | None = None,
    ) -> WebUser:
        wsvc = WebUserService(self.session)
        if login and login != user.username:
            existing = await wsvc.get_by_username(login)
            if existing and existing.id != user.id:
                raise ValueError("username taken")
            user.username = login
            user.email = login
        if password:
            user.password_hash = bcrypt.generate_password_hash(password)
        display_parts = [part for part in (name, surname) if part]
        if display_parts:
            user.full_name = " ".join(display_parts)
        if phone is not None:
            user.phone = phone
        if available_diagnostics is not None:
            user.diagnostics_available = sorted(
                {int(x) for x in available_diagnostics}
            )
        user.diagnostics_enabled = True
        await self.session.flush()
        return user

    async def toggle_specialist_active(self, user: WebUser) -> WebUser:
        if await self.is_admin(user):
            raise ValueError("Cannot deactivate diagnostics admin")
        user.diagnostics_active = not user.diagnostics_active
        await self.session.flush()
        return user

    # ------------------------------------------------------------------
    # Client helpers
    # ------------------------------------------------------------------

    async def list_clients(
        self,
        actor: WebUser,
        *,
        include_all: bool = False,
    ) -> list[DiagnosticClient]:
        stmt: Select[DiagnosticClient] = (
            select(DiagnosticClient)
            .options(
                selectinload(DiagnosticClient.user),
                selectinload(DiagnosticClient.results).selectinload(
                    DiagnosticResult.template
                ),
            )
            .order_by(DiagnosticClient.created_at.desc())
        )
        if not include_all:
            stmt = stmt.where(DiagnosticClient.specialist_id == actor.id)
        rows = await self.session.execute(stmt)
        return rows.scalars().all()

    async def get_client(
        self,
        client_id: int,
        *,
        include_results: bool = True,
    ) -> Optional[DiagnosticClient]:
        stmt = select(DiagnosticClient).where(DiagnosticClient.id == client_id)
        if include_results:
            stmt = stmt.options(
                selectinload(DiagnosticClient.user),
                selectinload(DiagnosticClient.results).selectinload(
                    DiagnosticResult.template
                ),
            )
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def set_client_new(self, client: DiagnosticClient, value: bool) -> None:
        client.is_new = value
        client.updated_at = utcnow()
        await self.session.flush()

    async def toggle_client_archive(self, client: DiagnosticClient) -> DiagnosticClient:
        client.in_archive = not client.in_archive
        client.updated_at = utcnow()
        await self.session.flush()
        return client

    async def record_result(self, payload: dict[str, Any]) -> DiagnosticClient:
        manager_id = int(payload.get("manager_id", 0) or 0)
        if manager_id <= 0:
            raise ValueError("manager_id is required")
        specialist = await self.get_specialist(manager_id)
        if not specialist or not specialist.diagnostics_active:
            raise ValueError("specialist not found or inactive")

        client_user = await self._resolve_client_user(payload)
        profile_query = (
            select(DiagnosticClient)
            .where(DiagnosticClient.user_id == client_user.id)
            .options(selectinload(DiagnosticClient.user))
        )
        existing_profile = await self.session.execute(profile_query)
        client_profile = existing_profile.scalar_one_or_none()
        if client_profile is None:
            client_profile = DiagnosticClient(
                user=client_user,
                specialist_id=specialist.id,
                contact_permission=bool(payload.get("contact_permission", True)),
            )
            self.session.add(client_profile)
            await self.session.flush()
        else:
            client_profile.specialist_id = specialist.id
            client_profile.contact_permission = bool(
                payload.get("contact_permission", True)
            )
        client_profile.is_new = bool(payload.get("new", True))
        client_profile.in_archive = bool(payload.get("in_archive", False))

        submitted_at = self._extract_timestamp(
            payload.get("date"), payload.get("result", {}).get("date")
        )
        diagnostic = payload.get("result", {})
        diagnostic_id = diagnostic.get("diagnostic-id")
        data = diagnostic.get("data") or {}
        open_answer = diagnostic.get("openAnswer") or diagnostic.get("open_answer")

        result_entry = DiagnosticResult(
            client_id=client_profile.id,
            specialist_id=specialist.id,
            diagnostic_id=int(diagnostic_id)
            if diagnostic_id is not None
            else None,
            payload=data,
            open_answer=open_answer,
            submitted_at=submitted_at,
        )
        self.session.add(result_entry)

        client_profile.last_result_at = submitted_at
        client_profile.updated_at = utcnow()
        await self.session.flush()
        return client_profile

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    async def _resolve_client_user(self, payload: dict[str, Any]) -> WebUser:
        email = (payload.get("email") or "").strip()
        phone = (payload.get("phone") or "").strip()
        name = (payload.get("name") or "").strip()

        user = None
        if email:
            user = await self._find_user_by_email(email)
        if not user and phone:
            user = await self._find_user_by_phone(phone)

        if user is None:
            username = await self._generate_unique_username(email or name or phone)
            password = secrets.token_urlsafe(12)
            wsvc = WebUserService(self.session)
            user = await wsvc.register(
                username=username,
                password=password,
                email=email or None,
                phone=phone or None,
            )
        if name:
            user.full_name = name
        if email and user.email != email:
            user.email = email
        if phone and user.phone != phone:
            user.phone = phone
        await self.session.flush()
        await self.ensure_client_role(user)
        return user

    async def _find_user_by_email(self, email: str) -> Optional[WebUser]:
        stmt = select(WebUser).where(func.lower(WebUser.email) == email.lower())
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def _find_user_by_phone(self, phone: str) -> Optional[WebUser]:
        stmt = select(WebUser).where(WebUser.phone == phone)
        result = await self.session.execute(stmt)
        return result.scalar_one_or_none()

    async def _generate_unique_username(self, seed: str) -> str:
        normalized = USERNAME_SANITIZE_RE.sub("-", seed.lower()).strip("-")
        if not normalized:
            normalized = f"{DEFAULT_CLIENT_USERNAME_PREFIX}-{secrets.token_hex(3)}"
        normalized = normalized[:60]
        wsvc = WebUserService(self.session)
        candidate = normalized
        suffix = 1
        existing = await wsvc.get_by_username(candidate)
        while existing is not None:
            suffix += 1
            candidate = f"{normalized}-{suffix}"[:64]
            existing = await wsvc.get_by_username(candidate)
        return candidate

    def _extract_timestamp(
        self, *candidates: Any, default: Optional[datetime] = None
    ) -> datetime:
        for value in candidates:
            if value is None:
                continue
            try:
                as_int = int(value)
            except (ValueError, TypeError):
                continue
            if as_int <= 0:
                continue
            return datetime.fromtimestamp(as_int / 1000, tz=timezone.utc)
        return default or utcnow()


__all__ = ["DiagnosticsService"]
