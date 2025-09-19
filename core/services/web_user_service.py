from __future__ import annotations

from typing import Optional, Any, Union, List
import re
from datetime import datetime
import secrets
from sqlalchemy import select, text, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from core import db
from core.models import WebUser, TgUser, WebTgLink, UserRole, Role, UserRoleLink
from core.db import bcrypt
from core.utils import utcnow
from core.services.access_control import AccessControlService, AccessScope
from core.services.profile_service import ProfileService, VISIBILITY_CHOICES


def _parse_birthday(value: Optional[str]):
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise ValueError("Invalid date format")


def _guess_identifier_kind(identifier: str) -> str:
    value = (identifier or "").strip()
    if "@" in value:
        return "email"
    digits = re.sub(r"\D", "", value)
    if value.startswith("+") and digits:
        return "phone"
    if digits and digits == value:
        return "phone"
    return "username"


def _normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"[^0-9+]", "", value)
    return digits or None


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
        """Fetch a user by username case-insensitively.

        The database stores the username with the original casing, but lookups
        and uniqueness checks should not depend on letter case.  We therefore
        normalise the input and compare using ``lower`` on both sides."""
        normalized = username.lower()
        result = await self.session.execute(
            select(WebUser).where(func.lower(WebUser.username) == normalized)
        )
        return result.scalar_one_or_none()

    async def get_by_email(self, email: str) -> Optional[WebUser]:
        normalized = email.lower().strip()
        if not normalized:
            return None
        result = await self.session.execute(
            select(WebUser).where(func.lower(WebUser.email) == normalized)
        )
        return result.scalar_one_or_none()

    async def get_by_phone(self, phone: str) -> Optional[WebUser]:
        normalized = _normalize_phone(phone)
        if not normalized:
            return None
        result = await self.session.execute(
            select(WebUser).where(WebUser.phone == normalized)
        )
        return result.scalar_one_or_none()

    async def get_by_identifier(self, identifier: str) -> Optional[WebUser]:
        kind = _guess_identifier_kind(identifier)
        if kind == "email":
            return await self.get_by_email(identifier)
        if kind == "phone":
            return await self.get_by_phone(identifier)
        return await self.get_by_username(identifier)

    async def register(
        self,
        *,
        username: str,
        password: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
    ) -> WebUser:
        if await self.get_by_username(username):
            raise ValueError("username taken")
        normalized_phone = _normalize_phone(phone)
        email_owner = await self.get_by_email(email) if email else None
        phone_owner = (
            await self.get_by_phone(normalized_phone)
            if normalized_phone
            else None
        )
        base_user = email_owner or phone_owner
        if base_user and base_user.username:
            raise ValueError("identifier already registered")

        hashed = bcrypt.generate_password_hash(password)
        if base_user:
            base_user.username = username
            base_user.password_hash = hashed
            if email:
                base_user.email = email
            if normalized_phone:
                base_user.phone = normalized_phone
            base_user.updated_at = utcnow()
            user = base_user
        else:
            user = WebUser(
                username=username,
                password_hash=hashed,
                email=email,
                phone=normalized_phone,
            )
            self.session.add(user)
        try:
            await self.session.flush()
        except IntegrityError:
            # Attempt to fix potential sequence desynchronization and retry
            await self.session.rollback()
            user.id = None
            result = await self.session.execute(select(func.max(WebUser.id)))
            next_id = (result.scalar() or 0) + 1
            await self.session.execute(
                text("SELECT setval('users_web_id_seq', :nid, true)"),
                {"nid": next_id},
            )
            self.session.add(user)
            await self.session.flush()
        access = AccessControlService(self.session)
        await access.grant_role(
            target_user_id=user.id,
            role_slug=user.role,
            scope=AccessScope.global_scope(),
        )
        return user

    async def authenticate(
        self, identifier: str, password: str
    ) -> Optional[WebUser]:
        user = await self.get_by_identifier(identifier)
        if not user or not user.password_hash:
            return None
        if user.check_password(password):
            return user
        return None

    async def ensure_test_user(self) -> Optional[str]:
        """Create ``test`` user with random password if missing.

        Returns the generated password if a new user was created, otherwise
        ``None``.
        """
        result = await self.session.execute(
            select(WebUser).where(WebUser.username == "test")
        )
        if result.scalar_one_or_none():
            return None
        password = secrets.token_urlsafe(12)
        hashed = bcrypt.generate_password_hash(password)
        user = WebUser(
            username="test",
            password_hash=hashed,
            role=UserRole.admin.name,
        )
        self.session.add(user)
        await self.session.flush()
        access = AccessControlService(self.session)
        await access.grant_role(
            target_user_id=user.id,
            role_slug=user.role,
            scope=AccessScope.global_scope(),
        )
        return password

    async def link_telegram(
        self, web_user_id: int, tg_user_id: int, link_type: str | None = None
    ) -> WebUser:
        web_user = await self.get_by_id(web_user_id)
        tg_user = await self.session.get(TgUser, tg_user_id)
        if web_user is None or tg_user is None:
            raise ValueError("user not found")
        result = await self.session.execute(
            select(WebTgLink).where(WebTgLink.tg_user_id == tg_user_id)
        )
        existing = result.scalar_one_or_none()
        if existing:
            if existing.web_user_id == web_user_id:
                return web_user
            raise ValueError("telegram user already linked to another account")
        link = WebTgLink(
            web_user_id=web_user_id,
            tg_user_id=tg_user_id,
            link_type=link_type,
        )
        self.session.add(link)
        await self.session.flush()
        return web_user

    async def unlink_telegram(
        self, web_user_id: int, tg_user_id: int
    ) -> WebUser:
        web_user = await self.get_by_id(web_user_id)
        if web_user is None:
            raise ValueError("user not found")
        result = await self.session.execute(
            select(WebTgLink).where(
                WebTgLink.web_user_id == web_user_id,
                WebTgLink.tg_user_id == tg_user_id,
            )
        )
        link = result.scalar_one_or_none()
        if link:
            await self.session.delete(link)
        await self.session.flush()
        return web_user

    async def update_user_role(
        self,
        user_id: int,
        new_role: UserRole | str,
        *,
        actor_user_id: Optional[int] = None,
    ) -> bool:
        user = await self.get_by_id(user_id)
        if not user:
            return False
        role_slug = (
            new_role.name if isinstance(new_role, UserRole) else str(new_role)
        ).lower()
        user.role = role_slug
        await self.session.flush()

        access = AccessControlService(self.session)

        stmt = (
            select(UserRoleLink, Role)
            .join(Role, Role.id == UserRoleLink.role_id)
            .where(UserRoleLink.user_id == user.id)
            .where(UserRoleLink.scope_type == "global")
            .where(UserRoleLink.scope_id.is_(None))
        )
        result = await self.session.execute(stmt)
        for link, role in result.all():
            if role.slug != role_slug and role.is_system:
                await access.revoke_role(
                    target_user_id=user.id,
                    role_slug=role.slug,
                    actor_user_id=actor_user_id,
                    scope=AccessScope.global_scope(),
                )

        await access.grant_role(
            target_user_id=user.id,
            role_slug=role_slug,
            actor_user_id=actor_user_id,
            scope=AccessScope.global_scope(),
        )
        return True

    async def update_profile(
        self, web_user_id: int, data: dict[str, Any]
    ) -> Optional[WebUser]:
        user = await self.get_by_id(web_user_id)
        if not user:
            return None
        profile_updates: dict[str, Any] = {}
        privacy_settings = dict(user.privacy_settings or {})
        if "birthday" in data:
            birthday = data.get("birthday")
            if isinstance(birthday, str):
                birthday = _parse_birthday(birthday)
            user.birthday = birthday
        for field in [
            "full_name",
            "email",
            "phone",
            "language",
            "privacy_settings",
        ]:
            if field in data and data[field] is not None:
                setattr(user, field, data[field])
        if data.get("headline"):
            profile_updates["headline"] = data["headline"]
        if data.get("summary"):
            profile_updates["summary"] = data["summary"]
        if data.get("bio") and "summary" not in data:
            profile_updates["summary"] = data["bio"]
        if data.get("avatar_url"):
            profile_updates["avatar_url"] = data["avatar_url"]
            privacy_settings["avatar_url"] = data["avatar_url"]
        if data.get("cover_url"):
            profile_updates["cover_url"] = data["cover_url"]
        if data.get("tags"):
            profile_updates["tags"] = data["tags"]
        if data.get("sections"):
            profile_updates["sections"] = data["sections"]
        links = data.get("links") or data.get("profile_links")
        if links:
            profile_meta = profile_updates.setdefault("profile_meta", {})
            profile_meta["links"] = links
        profile_updates.setdefault(
            "display_name", user.full_name or user.username
        )
        profile_updates.setdefault("slug", user.username)
        profile_updates.setdefault("force_slug", True)

        raw_visibility = data.get("directory_visibility") or data.get("profile_visibility")
        normalized_visibility = None
        if isinstance(raw_visibility, str):
            candidate = raw_visibility.strip().lower()
            if candidate in VISIBILITY_CHOICES:
                normalized_visibility = candidate

        async with ProfileService(self.session) as profiles:
            profile = await profiles.upsert_profile_meta(
                entity_type="user",
                entity_id=user.id,
                updates=profile_updates,
            )
            if normalized_visibility:
                await profiles.apply_visibility(profile, normalized_visibility, actor=user)

        if normalized_visibility:
            privacy_settings["profile_visibility"] = normalized_visibility

        if privacy_settings != (user.privacy_settings or {}):
            user.privacy_settings = privacy_settings
        await self.session.flush()
        return user

    async def list_users(self) -> List[WebUser]:
        result = await self.session.execute(
            select(WebUser).options(selectinload(WebUser.telegram_accounts))
        )
        return result.scalars().all()

    async def get_user_by_identifier(
        self, identifier: Union[int, str]
    ) -> Optional[WebUser]:
        if isinstance(identifier, int) or (
            isinstance(identifier, str) and identifier.isdigit()
        ):
            telegram_id = int(identifier)
            result = await self.session.execute(
                select(WebUser)
                .join(WebTgLink, WebTgLink.web_user_id == WebUser.id)
                .join(TgUser, WebTgLink.tg_user_id == TgUser.id)
                .where(TgUser.telegram_id == telegram_id)
            )
            return result.scalar_one_or_none()
        else:
            return await self.get_by_username(str(identifier))
