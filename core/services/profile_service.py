"""ProfileService: unified profile management and access control."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Iterable, Optional, Sequence

from sqlalchemy import Select, and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core import db
from core.models import (
    Area,
    EntityProfile,
    EntityProfileGrant,
    Group,
    Project,
    UserGroup,
    UserRoleLink,
    WebTgLink,
    WebUser,
)
from core.services.access_control import AccessControlService

DEFAULT_SECTIONS: list[dict[str, str]] = [
    {"id": "overview", "title": "Обзор"},
    {"id": "activity", "title": "Активность"},
    {"id": "relations", "title": "Связи"},
]


@dataclass(slots=True)
class ViewerContext:
    user: Optional[WebUser]
    is_authenticated: bool
    is_admin: bool
    telegram_ids: set[int]
    group_ids: set[int]
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
        project_ids: set[int] = set()
        area_ids: set[int] = set()
        is_admin = False
        if viewer:
            # ensure telegram accounts loaded
            result = await self.session.execute(
                select(WebTgLink.tg_user_id).where(WebTgLink.web_user_id == viewer.id)
            )
            tg_ids = result.scalars().all()
            if tg_ids:
                telegram_ids.update(tg_ids)
                group_rows = await self.session.execute(
                    select(UserGroup.group_id).where(UserGroup.user_id.in_(tg_ids))
                )
                group_ids.update(group for (group,) in group_rows.all())
            role_rows = await self.session.execute(
                select(UserRoleLink.scope_type, UserRoleLink.scope_id).where(
                    UserRoleLink.user_id == viewer.id,
                    UserRoleLink.scope_type.in_(["project", "area"]),
                )
            )
            for scope_type, scope_id in role_rows.all():
                if scope_type == "project" and scope_id:
                    project_ids.add(scope_id)
                if scope_type == "area" and scope_id:
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
    ) -> EntityProfile:
        defaults = defaults or {}
        normalized_slug = slug.lower()
        stmt = select(EntityProfile).where(
            EntityProfile.entity_type == entity_type,
            EntityProfile.entity_id == entity_id,
        )
        result = await self.session.execute(stmt.options(selectinload(EntityProfile.grants)))
        profile = result.scalars().first()
        if profile:
            changed = False
            if profile.slug != normalized_slug:
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
            if defaults.get("tags") and profile.tags != defaults["tags"]:
                profile.tags = defaults["tags"]
                changed = True
            if defaults.get("profile_meta") and profile.profile_meta != defaults["profile_meta"]:
                profile.profile_meta = defaults["profile_meta"]
                changed = True
            if defaults.get("sections") and profile.sections != defaults["sections"]:
                profile.sections = defaults["sections"]
                changed = True
            if changed:
                profile.updated_at = datetime.utcnow()
            return profile
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
            profile_meta=defaults.get("profile_meta", {}),
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
        stmt = select(EntityProfile).where(
            EntityProfile.entity_type == entity_type,
            func.lower(EntityProfile.slug) == normalized_slug,
        )
        result = await self.session.execute(stmt.options(selectinload(EntityProfile.grants)))
        profile = result.scalars().first()
        if not profile:
            raise ValueError("profile not found")
        if "slug" in data and data["slug"]:
            profile.slug = data["slug"].lower()
        for key in [
            "display_name",
            "headline",
            "summary",
            "avatar_url",
            "cover_url",
            "tags",
            "sections",
            "profile_meta",
        ]:
            if key in data and data[key] is not None:
                setattr(profile, key, data[key])
        profile.updated_at = datetime.utcnow()
        await self.session.flush()
        return profile

    async def replace_grants(
        self,
        profile: EntityProfile,
        payload: Sequence[dict[str, Any]],
        *,
        actor: Optional[WebUser] = None,
    ) -> list[EntityProfileGrant]:
        current = list(profile.grants)
        keep_ids: set[int] = set()
        updated_grants: list[EntityProfileGrant] = []
        now = datetime.utcnow()
        for item in payload:
            audience = item.get("audience_type")
            subject_id = item.get("subject_id")
            sections = item.get("sections")
            expires_at = item.get("expires_at")
            if audience in ("public", "authenticated"):
                subject_id = None
            matched = next(
                (
                    g
                    for g in current
                    if g.audience_type == audience
                    and (
                        (subject_id is None and g.subject_id is None)
                        or (subject_id is not None and g.subject_id == subject_id)
                    )
                ),
                None,
            )
            if matched:
                keep_ids.add(matched.id)
                matched.sections = sections
                matched.expires_at = expires_at
                matched.created_by = actor.id if actor else matched.created_by
                matched.created_at = now
                updated_grants.append(matched)
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
                updated_grants.append(grant)
        to_remove = [
            grant for grant in current if grant.id not in keep_ids and grant not in updated_grants
        ]
        for grant in to_remove:
            await self.session.delete(grant)
        await self.session.flush()
        await self.session.refresh(profile)
        return list(profile.grants)

    # ------------------------------------------------------------------
    # Access evaluation & listings
    # ------------------------------------------------------------------

    def _profile_sections(self, profile: EntityProfile) -> list[dict[str, Any]]:
        if profile.sections and isinstance(profile.sections, list):
            return profile.sections
        return DEFAULT_SECTIONS.copy()

    def _owned_by_viewer(self, profile: EntityProfile, context: ViewerContext) -> bool:
        if not context.user:
            return False
        if profile.entity_type == "user" and profile.entity_id == context.user.id:
            return True
        if profile.entity_type == "group" and context.telegram_ids:
            if profile.entity_id in context.group_ids:
                return True
        # Projects/areas: treat assigned scopes as ownership
        if profile.entity_type == "project" and profile.entity_id in context.project_ids:
            return True
        if profile.entity_type == "area" and profile.entity_id in context.area_ids:
            return True
        return False

    def _grants_for_viewer(
        self, profile: EntityProfile, context: ViewerContext
    ) -> list[EntityProfileGrant]:
        grants: list[EntityProfileGrant] = []
        for grant in profile.grants:
            if grant.expires_at and grant.expires_at < datetime.utcnow():
                continue
            audience = grant.audience_type
            if audience == "public":
                grants.append(grant)
            elif audience == "authenticated" and context.is_authenticated:
                grants.append(grant)
            elif audience == "user" and context.user and grant.subject_id == context.user.id:
                grants.append(grant)
            elif audience == "group" and context.group_ids and grant.subject_id in context.group_ids:
                grants.append(grant)
            elif audience == "project" and context.project_ids and grant.subject_id in context.project_ids:
                grants.append(grant)
            elif audience == "area" and context.area_ids and grant.subject_id in context.area_ids:
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
        # collect allowed section ids; None -> full access
        allowed_ids: Optional[set[str]] = None
        for grant in grants:
            if not grant.sections:
                return sections
            if allowed_ids is None:
                allowed_ids = set()
            for section_id in grant.sections:
                allowed_ids.add(str(section_id))
        if allowed_ids is None:
            return sections
        filtered = [s for s in sections if str(s.get("id")) in allowed_ids]
        return filtered

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
        stmt = await self._base_query(entity_type)
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
        accesses: list[ProfileAccess] = []
        for profile in profiles:
            owner_access = self._owned_by_viewer(profile, context)
            admin_access = context.is_admin
            if not admin_access and not owner_access:
                grants = self._grants_for_viewer(profile, context)
                if not grants:
                    continue
            else:
                grants = []
            sections = self._resolve_sections(
                profile,
                grants,
                owner_access=owner_access,
                admin_access=admin_access,
            )
            if not sections and not (owner_access or admin_access):
                # no visible sections
                continue
            accesses.append(
                ProfileAccess(
                    profile=profile,
                    sections=sections,
                    matched_grants=grants,
                    is_owner=owner_access,
                    is_admin=admin_access,
                )
            )
        return accesses

    async def get_profile(  # noqa: PLR0913
        self,
        *,
        entity_type: str,
        slug: str,
        viewer: Optional[WebUser],
        with_sections: bool = True,
    ) -> ProfileAccess:
        normalized_slug = slug.lower()
        stmt = await self._base_query(entity_type)
        stmt = stmt.where(func.lower(EntityProfile.slug) == normalized_slug)
        result = await self.session.execute(stmt)
        profile = result.scalars().first()
        if not profile:
            raise ValueError("profile not found")
        context = await self._load_viewer_context(viewer)
        owner_access = self._owned_by_viewer(profile, context)
        admin_access = context.is_admin
        if not admin_access and not owner_access:
            grants = self._grants_for_viewer(profile, context)
            if not grants:
                raise PermissionError("access denied")
        else:
            grants = []
        sections = (
            self._resolve_sections(profile, grants, owner_access=owner_access, admin_access=admin_access)
            if with_sections
            else []
        )
        if with_sections and not sections and not (owner_access or admin_access):
            raise PermissionError("access denied")
        return ProfileAccess(
            profile=profile,
            sections=sections,
            matched_grants=grants,
            is_owner=owner_access,
            is_admin=admin_access,
        )

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
        slug = updates.get("slug") or updates.get("username") or str(entity_id)
        profile = await self.ensure_profile(
            entity_type=entity_type,
            entity_id=entity_id,
            slug=slug,
            display_name=updates.get("display_name") or slug,
            defaults=updates,
        )
        return profile
