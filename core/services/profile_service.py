"""ProfileService: unified profile management and access control."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Optional, Sequence

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core import db
from core.models import (
    EntityProfile,
    EntityProfileGrant,
    UserGroup,
    UserRoleLink,
    WebTgLink,
    WebUser,
)
from core.services.access_control import AccessControlService
from core.utils import utcnow

VISIBILITY_CHOICES = {"private", "authenticated", "public"}

DEFAULT_SECTIONS: list[dict[str, str]] = [
    {"id": "overview", "title": "Обзор"},
    {"id": "activity", "title": "Активность"},
    {"id": "relations", "title": "Связи"},
]


def normalize_slug(value: Optional[str], fallback: str) -> str:
    """Normalize slugs to `kebab-case` and fallback to provided string."""
    candidate = (value or "").strip().lower()
    candidate = re.sub(r"[^a-z0-9]+", "-", candidate)
    candidate = candidate.strip("-")
    return candidate or fallback


@dataclass(slots=True)
class ViewerContext:
    user: Optional[WebUser]
    is_authenticated: bool
    is_admin: bool
    telegram_ids: set[int]
    group_ids: set[int]
    owned_group_ids: set[int]
    project_ids: set[int]
    area_ids: set[int]


@dataclass(slots=True)
class ProfileAccess:
    profile: EntityProfile
    sections: list[dict[str, Any]]
    matched_grants: list[EntityProfileGrant]
    is_owner: bool
    is_admin: bool


class ProfileService:
    """Service responsible for CRUD and access checks for entity profiles."""

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "ProfileService":
        if self.session is None:
            self.session = db.async_session()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:  # pragma: no cover
        if not self._external:
            if exc_type is None:
                await self.session.commit()
            else:
                await self.session.rollback()
            await self.session.close()

    # ------------------------------------------------------------------
    # Viewer context helpers
    # ------------------------------------------------------------------

    async def _load_viewer_context(self, viewer: Optional[WebUser]) -> ViewerContext:
        telegram_ids: set[int] = set()
        group_ids: set[int] = set()
        owned_group_ids: set[int] = set()
        project_ids: set[int] = set()
        area_ids: set[int] = set()
        is_admin = False
        if viewer:
            tg_rows = await self.session.execute(
                select(WebTgLink.tg_user_id).where(WebTgLink.web_user_id == viewer.id)
            )
            tg_ids = tg_rows.scalars().all()
            if tg_ids:
                telegram_ids.update(tg_ids)
                group_rows = await self.session.execute(
                    select(
                        UserGroup.group_id,
                        UserGroup.is_owner,
                        UserGroup.is_moderator,
                    ).where(UserGroup.user_id.in_(tg_ids))
                )
                for group_id, is_owner, _ in group_rows.all():
                    group_ids.add(group_id)
                    if is_owner:
                        owned_group_ids.add(group_id)
            role_rows = await self.session.execute(
                select(UserRoleLink.scope_type, UserRoleLink.scope_id).where(
                    UserRoleLink.user_id == viewer.id,
                    UserRoleLink.scope_type.in_(["project", "area"]),
                )
            )
            for scope_type, scope_id in role_rows.all():
                if scope_type == "project" and scope_id is not None:
                    project_ids.add(scope_id)
                if scope_type == "area" and scope_id is not None:
                    area_ids.add(scope_id)
            async with AccessControlService(self.session) as access:
                effective = await access.list_effective_permissions(viewer)
            is_admin = bool(effective and effective.has_role("admin"))
        return ViewerContext(
            user=viewer,
            is_authenticated=viewer is not None,
            is_admin=is_admin,
            telegram_ids=telegram_ids,
            group_ids=group_ids,
            owned_group_ids=owned_group_ids,
            project_ids=project_ids,
            area_ids=area_ids,
        )

    # ------------------------------------------------------------------
    # Profile CRUD
    # ------------------------------------------------------------------

    async def ensure_profile(
        self,
        *,
        entity_type: str,
        entity_id: int,
        slug: str,
        display_name: str,
        defaults: Optional[dict[str, Any]] = None,
        force_slug: bool = False,
    ) -> EntityProfile:
        defaults = defaults or {}
        normalized_slug = normalize_slug(slug, f"{entity_type}-{entity_id}")
        stmt = select(EntityProfile).where(
            EntityProfile.entity_type == entity_type,
            EntityProfile.entity_id == entity_id,
        ).options(selectinload(EntityProfile.grants))
        result = await self.session.execute(stmt)
        profile = result.scalars().first()
        if profile:
            changed = False
            if force_slug and profile.slug != normalized_slug:
                profile.slug = normalized_slug
                changed = True
            if display_name and profile.display_name != display_name:
                profile.display_name = display_name
                changed = True
            for field in ("headline", "summary", "avatar_url", "cover_url"):
                value = defaults.get(field)
                if value is not None and getattr(profile, field) != value:
                    setattr(profile, field, value)
                    changed = True
            if "tags" in defaults and defaults["tags"] is not None:
                if profile.tags != defaults["tags"]:
                    profile.tags = defaults["tags"]
                    changed = True
            if "profile_meta" in defaults and defaults["profile_meta"] is not None:
                if profile.profile_meta != defaults["profile_meta"]:
                    profile.profile_meta = defaults["profile_meta"]
                    changed = True
            if "sections" in defaults and defaults["sections"] is not None:
                if profile.sections != defaults["sections"]:
                    profile.sections = defaults["sections"]
                    changed = True
            if changed:
                profile.updated_at = utcnow()
            return profile
        meta_payload = defaults.get("profile_meta") or {}
        if entity_type == "user":
            meta_payload = dict(meta_payload)
            if "visibility" not in meta_payload:
                meta_payload["visibility"] = "private"
            if "profile_visibility" not in meta_payload:
                meta_payload["profile_visibility"] = meta_payload.get("visibility", "private")

        # Default user profiles start as private; visibility is expanded via explicit grants.
        profile = EntityProfile(
            entity_type=entity_type,
            entity_id=entity_id,
            slug=normalized_slug,
            display_name=display_name,
            headline=defaults.get("headline"),
            summary=defaults.get("summary"),
            avatar_url=defaults.get("avatar_url"),
            cover_url=defaults.get("cover_url"),
            tags=defaults.get("tags", []),
            profile_meta=meta_payload,
            sections=defaults.get("sections", DEFAULT_SECTIONS.copy()),
        )
        self.session.add(profile)
        await self.session.flush()
        return profile

    async def update_profile_data(
        self,
        *,
        entity_type: str,
        slug: str,
        data: dict[str, Any],
    ) -> EntityProfile:
        normalized_slug = slug.lower()
        stmt = (
            select(EntityProfile)
            .where(
                EntityProfile.entity_type == entity_type,
                func.lower(EntityProfile.slug) == normalized_slug,
            )
            .options(selectinload(EntityProfile.grants))
        )
        result = await self.session.execute(stmt)
        profile = result.scalars().first()
        if not profile and entity_type == "user":
            profile = await self._auto_create_user_profile_from_slug(slug)
        if not profile:
            raise ValueError("profile not found")
        if data.get("slug"):
            profile.slug = normalize_slug(data["slug"], f"{entity_type}-{profile.entity_id}")
        for key in (
            "display_name",
            "headline",
            "summary",
            "avatar_url",
            "cover_url",
            "tags",
            "sections",
            "profile_meta",
        ):
            if key in data and data[key] is not None:
                setattr(profile, key, data[key])
        profile.updated_at = utcnow()
        await self.session.flush()
        return profile

    async def replace_grants(
        self,
        profile: EntityProfile,
        payload: Sequence[dict[str, Any]],
        *,
        actor: Optional[WebUser] = None,
    ) -> list[EntityProfileGrant]:
        await self.session.refresh(profile, attribute_names=["grants"])
        existing = list(profile.grants)
        keep_ids: set[int] = set()
        now = utcnow()
        general_payload = {
            item.get("audience_type")
            for item in payload
            if item.get("audience_type") in {"public", "authenticated"}
        }
        for item in payload:
            audience = item.get("audience_type")
            subject_id = item.get("subject_id")
            sections = item.get("sections")
            expires_at = item.get("expires_at")
            if audience in {"public", "authenticated"}:
                subject_id = None
            match = next(
                (
                    grant
                    for grant in existing
                    if grant.audience_type == audience
                    and (
                        (subject_id is None and grant.subject_id is None)
                        or (subject_id is not None and grant.subject_id == subject_id)
                    )
                ),
                None,
            )
            if match:
                keep_ids.add(match.id)
                match.sections = sections
                match.expires_at = expires_at
                match.created_by = actor.id if actor else match.created_by
                match.created_at = now
            else:
                grant = EntityProfileGrant(
                    profile=profile,
                    audience_type=audience,
                    subject_id=subject_id,
                    sections=sections,
                    expires_at=expires_at,
                    created_by=actor.id if actor else None,
                    created_at=now,
                )
                self.session.add(grant)
        for grant in existing:
            if not grant.id or grant.id in keep_ids:
                continue
            if grant.audience_type in {"public", "authenticated"}:
                if grant.audience_type not in general_payload:
                    await self.session.delete(grant)
                continue
            await self.session.delete(grant)
        await self.session.flush()
        await self.session.refresh(profile)
        return list(profile.grants)

    async def apply_visibility(
        self,
        profile: EntityProfile,
        visibility: str,
        *,
        actor: Optional[WebUser] = None,
    ) -> EntityProfile:
        """Synchronize high-level visibility with general grants."""

        if visibility not in VISIBILITY_CHOICES:
            raise ValueError(f"visibility must be one of {sorted(VISIBILITY_CHOICES)}")

        payload: list[dict[str, Any]] = []
        if visibility == "public":
            payload.append({
                "audience_type": "public",
                "subject_id": None,
                "sections": None,
                "expires_at": None,
            })
            payload.append({
                "audience_type": "authenticated",
                "subject_id": None,
                "sections": None,
                "expires_at": None,
            })
        elif visibility == "authenticated":
            payload.append({
                "audience_type": "authenticated",
                "subject_id": None,
                "sections": None,
                "expires_at": None,
            })

        for grant in profile.grants:
            if grant.audience_type in {"public", "authenticated"}:
                continue
            payload.append({
                "audience_type": grant.audience_type,
                "subject_id": grant.subject_id,
                "sections": list(grant.sections or []) if grant.sections else None,
                "expires_at": grant.expires_at,
            })

        await self.replace_grants(profile, payload, actor=actor)
        await self.session.refresh(profile)

        meta = dict(profile.profile_meta or {})
        updated_meta = False
        if meta.get("visibility") != visibility:
            meta["visibility"] = visibility
            updated_meta = True
        if meta.get("profile_visibility") != visibility:
            meta["profile_visibility"] = visibility
            updated_meta = True
        if updated_meta:
            profile.profile_meta = meta
            profile.updated_at = utcnow()
        return profile

    # ------------------------------------------------------------------
    # Access evaluation & listings
    # ------------------------------------------------------------------

    def _profile_sections(self, profile: EntityProfile) -> list[dict[str, Any]]:
        if profile.sections and isinstance(profile.sections, list):
            return profile.sections
        return DEFAULT_SECTIONS.copy()

    def _has_default_access(self, profile: EntityProfile, context: ViewerContext) -> bool:
        """Implicit visibility rules when no explicit grants exist."""
        if profile.entity_type == "user":
            meta = profile.profile_meta or {}
            visibility = str(meta.get("visibility") or meta.get("profile_visibility") or "").lower()
            if visibility == "public":
                return True
            if visibility == "authenticated":
                return context.is_authenticated
            if visibility == "private":
                return False
            # No implicit access without explicit visibility settings
            return False
        return False

    def _owned_by_viewer(self, profile: EntityProfile, context: ViewerContext) -> bool:
        if not context.user:
            return False
        if profile.entity_type == "user" and profile.entity_id == context.user.id:
            return True
        if profile.entity_type == "group" and profile.entity_id in context.owned_group_ids:
            return True
        if profile.entity_type == "project" and profile.entity_id in context.project_ids:
            return True
        if profile.entity_type == "area" and profile.entity_id in context.area_ids:
            return True
        if profile.entity_type == "resource" and context.telegram_ids:
            try:
                owner_id = (profile.profile_meta or {}).get("owner_id")
                if owner_id and owner_id in context.telegram_ids:
                    return True
            except AttributeError:
                pass
        return False

    def _grants_for_viewer(
        self,
        profile: EntityProfile,
        context: ViewerContext,
    ) -> list[EntityProfileGrant]:
        grants: list[EntityProfileGrant] = []
        now = utcnow()
        for grant in profile.grants:
            if grant.expires_at and grant.expires_at < now:
                continue
            if grant.audience_type == "public":
                grants.append(grant)
            elif grant.audience_type == "authenticated" and context.is_authenticated:
                grants.append(grant)
            elif grant.audience_type == "user" and context.user and grant.subject_id == context.user.id:
                grants.append(grant)
            elif grant.audience_type == "group" and grant.subject_id in context.group_ids:
                grants.append(grant)
            elif grant.audience_type == "project" and grant.subject_id in context.project_ids:
                grants.append(grant)
            elif grant.audience_type == "area" and grant.subject_id in context.area_ids:
                grants.append(grant)
        return grants

    def _resolve_sections(
        self,
        profile: EntityProfile,
        grants: Sequence[EntityProfileGrant],
        *,
        owner_access: bool,
        admin_access: bool,
    ) -> list[dict[str, Any]]:
        sections = self._profile_sections(profile)
        if admin_access or owner_access:
            return sections
        if not grants:
            return []
        collected: Optional[set[str]] = None
        for grant in grants:
            if not grant.sections:
                return sections
            if collected is None:
                collected = set()
            collected.update(str(section_id) for section_id in grant.sections)
        if collected is None:
            return sections
        return [section for section in sections if str(section.get("id")) in collected]

    async def _base_query(self, entity_type: str) -> Select:
        return (
            select(EntityProfile)
            .where(EntityProfile.entity_type == entity_type)
            .options(selectinload(EntityProfile.grants))
            .order_by(EntityProfile.display_name.asc())
        )

    async def list_catalog(
        self,
        *,
        entity_type: str,
        viewer: Optional[WebUser],
        limit: int = 50,
        offset: int = 0,
        search: Optional[str] = None,
    ) -> list[ProfileAccess]:
        context = await self._load_viewer_context(viewer)
        stmt = (await self._base_query(entity_type)).execution_options(populate_existing=True)
        if search:
            pattern = f"%{search.lower()}%"
            stmt = stmt.where(
                or_(
                    func.lower(EntityProfile.display_name).like(pattern),
                    func.lower(EntityProfile.slug).like(pattern),
                    func.lower(func.coalesce(EntityProfile.summary, "")).like(pattern),
                )
            )
        stmt = stmt.offset(offset).limit(limit)
        result = await self.session.execute(stmt)
        profiles = result.scalars().all()
        response: list[ProfileAccess] = []
        for profile in profiles:
            await self.session.refresh(profile, attribute_names=["grants"])
            owner_access = self._owned_by_viewer(profile, context)
            admin_access = context.is_admin
            grants = [] if (owner_access or admin_access) else self._grants_for_viewer(profile, context)
            fallback_access = self._has_default_access(profile, context)
            if not grants and not (owner_access or admin_access or fallback_access):
                continue
            if fallback_access and not (owner_access or admin_access):
                sections = self._profile_sections(profile)
            else:
                sections = self._resolve_sections(
                    profile,
                    grants,
                    owner_access=owner_access,
                    admin_access=admin_access,
                )
            if not sections and not (owner_access or admin_access):
                continue
            response.append(
                ProfileAccess(
                    profile=profile,
                    sections=sections,
                    matched_grants=grants,
                    is_owner=owner_access,
                    is_admin=admin_access,
                )
            )
        return response

    async def get_profile(
        self,
        *,
        entity_type: str,
        slug: str,
        viewer: Optional[WebUser],
        with_sections: bool = True,
    ) -> ProfileAccess:
        stmt = (await self._base_query(entity_type)).execution_options(populate_existing=True)
        stmt = stmt.where(func.lower(EntityProfile.slug) == slug.lower())
        result = await self.session.execute(stmt)
        profile = result.scalars().first()
        if not profile and entity_type == "user":
            profile = await self._auto_create_user_profile_from_slug(slug)
        if not profile:
            raise ValueError("profile not found")
        await self.session.refresh(profile, attribute_names=["grants"])
        context = await self._load_viewer_context(viewer)
        owner_access = self._owned_by_viewer(profile, context)
        admin_access = context.is_admin
        grants = [] if (owner_access or admin_access) else self._grants_for_viewer(profile, context)
        fallback_access = self._has_default_access(profile, context)
        if not grants and not (owner_access or admin_access or fallback_access):
            raise PermissionError("access denied")
        if with_sections:
            if fallback_access and not (owner_access or admin_access):
                sections = self._profile_sections(profile)
            else:
                sections = self._resolve_sections(
                    profile,
                    grants,
                    owner_access=owner_access,
                    admin_access=admin_access,
                )
        else:
            sections = []
        if with_sections and not sections and not (owner_access or admin_access):
            raise PermissionError("access denied")
        return ProfileAccess(
            profile=profile,
            sections=sections,
            matched_grants=grants,
            is_owner=owner_access,
            is_admin=admin_access,
        )

    async def _auto_create_user_profile_from_slug(self, slug: str) -> EntityProfile | None:
        """Auto-create user profile when accessed by slug for the first time."""

        normalized = slug.strip().lower()
        if not normalized:
            return None

        user_stmt = select(WebUser).where(func.lower(WebUser.username) == normalized).limit(1)
        user_result = await self.session.execute(user_stmt)
        user = user_result.scalar_one_or_none()
        if not user:
            return None

        existing_stmt = await self._base_query("user")
        existing_stmt = existing_stmt.where(EntityProfile.entity_id == user.id)
        existing_result = await self.session.execute(existing_stmt)
        profile = existing_result.scalars().first()
        if profile:
            await self.ensure_default_sections(profile)
            return profile

        defaults: dict[str, Any] = {
            "display_name": user.full_name or user.username,
            "avatar_url": user.avatar_url,
            "profile_meta": {
                "visibility": "private",
                "profile_visibility": "private",
            },
        }
        profile = await self.ensure_profile(
            entity_type="user",
            entity_id=user.id,
            slug=user.username,
            display_name=defaults["display_name"],
            defaults=defaults,
        )
        await self.ensure_default_sections(profile)
        return profile

    async def ensure_default_sections(self, profile: EntityProfile) -> None:
        if not profile.sections:
            profile.sections = DEFAULT_SECTIONS.copy()
            await self.session.flush()

    async def upsert_profile_meta(
        self,
        *,
        entity_type: str,
        entity_id: int,
        updates: dict[str, Any],
    ) -> EntityProfile:
        payload = dict(updates)
        force_slug = bool(payload.pop("force_slug", False))
        slug = payload.get("slug") or payload.get("username") or str(entity_id)
        profile = await self.ensure_profile(
            entity_type=entity_type,
            entity_id=entity_id,
            slug=slug,
            display_name=payload.get("display_name") or slug,
            defaults=payload,
            force_slug=force_slug,
        )
        return profile
