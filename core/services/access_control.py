"""Role & permission management helpers."""
from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Iterable, Optional, Sequence, Dict, Set

from sqlalchemy import select, and_, or_
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import (
    AuthPermission,
    Role,
    UserRoleLink,
    WebUser,
    Project,
)
from core.utils import utcnow

from .audit_log import AuditLogService


@dataclass(frozen=True)
class AccessScope:
    """Scope descriptor to support global/area/project permissions."""

    scope_type: str = "global"
    scope_id: Optional[int] = None

    @classmethod
    def global_scope(cls) -> "AccessScope":
        return cls("global", None)


@dataclass
class PermissionDefinition:
    code: str
    bit_position: int

    @property
    def mask(self) -> int:
        return 1 << self.bit_position


class PermissionRegistry:
    """Cache of permissions indexed by code and bit position."""

    def __init__(
        self,
        permissions: Iterable[AuthPermission],
        *,
        fallback: Optional[Dict[str, int]] = None,
    ) -> None:
        self._by_code: Dict[str, PermissionDefinition] = {}
        self._by_bit: Dict[int, PermissionDefinition] = {}
        self._fallback = fallback or {}
        for perm in permissions:
            definition = PermissionDefinition(
                code=perm.code,
                bit_position=perm.bit_position,
            )
            self._by_code[definition.code] = definition
            self._by_bit[definition.bit_position] = definition

    def mask_for(self, codes: Iterable[str]) -> int:
        mask = 0
        for code in codes:
            definition = self._by_code.get(code)
            if definition is None:
                fallback_bit = self._fallback.get(code)
                if fallback_bit is None:
                    raise KeyError(f"Unknown permission code: {code}")
                mask |= 1 << fallback_bit
                continue
            mask |= definition.mask
        return mask

    def has(self, mask: int, code: str) -> bool:
        definition = self._by_code.get(code)
        if definition is None:
            fallback_bit = self._fallback.get(code)
            if fallback_bit is None:
                return False
            return bool(mask & (1 << fallback_bit))
        return bool(mask & definition.mask)

    def codes_from_mask(self, mask: int) -> Set[str]:
        return {
            definition.code
            for bit, definition in self._by_bit.items()
            if mask & (1 << bit)
        }

    def all_codes(self) -> Set[str]:
        return set(self._by_code.keys())


@dataclass
class EffectivePermissions:
    registry: PermissionRegistry
    mask: int
    roles: Set[str]
    is_superuser: bool

    def has(self, code: str) -> bool:
        if self.is_superuser:
            return True
        return self.registry.has(self.mask, code)

    def has_any(self, codes: Sequence[str]) -> bool:
        return any(self.has(code) for code in codes)

    def has_all(self, codes: Sequence[str]) -> bool:
        return all(self.has(code) for code in codes)

    def has_role(self, role_slug: str) -> bool:
        return self.is_superuser or role_slug in self.roles

    @property
    def codes(self) -> Set[str]:
        return self.registry.all_codes() if self.is_superuser else self.registry.codes_from_mask(self.mask)


DEFAULT_PERMISSIONS = [
    {"code": "app.dashboard.view", "name": "Dashboard: view", "description": "Просмотр главного дашборда", "category": "core", "bit_position": 0},
    {"code": "app.calendar.manage", "name": "Calendar: manage", "description": "Управление календарём и напоминаниями", "category": "calendar", "bit_position": 1},
    {"code": "app.tasks.manage", "name": "Tasks: manage", "description": "Создание и редактирование задач", "category": "tasks", "bit_position": 2},
    {"code": "app.areas.manage", "name": "Areas: manage", "description": "Управление областями PARA", "category": "para", "bit_position": 3},
    {"code": "app.projects.manage", "name": "Projects: manage", "description": "Управление проектами", "category": "para", "bit_position": 4},
    {"code": "app.habits.manage", "name": "Habits: manage", "description": "Управление привычками и ежедневками", "category": "habits", "bit_position": 5},
    {"code": "app.groups.moderate", "name": "Groups: moderate", "description": "Модерация групп и CRM", "category": "community", "bit_position": 6},
    {"code": "app.integrations.manage", "name": "Integrations: manage", "description": "Настройка интеграций и вебхуков", "category": "platform", "bit_position": 7},
    {"code": "app.settings.manage", "name": "Settings: manage", "description": "Изменение глобальных настроек", "category": "platform", "bit_position": 8},
    {"code": "app.roles.manage", "name": "Roles: manage", "description": "Управление ролями и правами доступа", "category": "platform", "bit_position": 9},
    {"code": "app.users.invite", "name": "Users: invite", "description": "Приглашение и управление участниками", "category": "platform", "bit_position": 10},
    {"code": "app.reports.view", "name": "Reports: view", "description": "Просмотр аналитики и отчётов", "category": "analytics", "bit_position": 11},
    {"code": "app.billing.manage", "name": "Billing: manage", "description": "Управление платежами и подписками", "category": "platform", "bit_position": 12},
    {"code": "app.data.export", "name": "Data: export", "description": "Экспорт и бэкапы данных", "category": "platform", "bit_position": 13},
]

DEFAULT_ROLES = [
    {
        "slug": "suspended",
        "name": "Suspended",
        "description": "Доступ запрещён",
        "level": 0,
        "permissions": [],
        "is_system": True,
        "grants_all": False,
    },
    {
        "slug": "single",
        "name": "Single",
        "description": "Личный доступ к данным пользователя",
        "level": 10,
        "permissions": [
            "app.dashboard.view",
            "app.calendar.manage",
            "app.tasks.manage",
            "app.habits.manage",
        ],
        "is_system": True,
        "grants_all": False,
    },
    {
        "slug": "multiplayer",
        "name": "Multiplayer",
        "description": "Участник рабочей области",
        "level": 20,
        "permissions": [
            "app.dashboard.view",
            "app.calendar.manage",
            "app.tasks.manage",
            "app.areas.manage",
            "app.projects.manage",
            "app.habits.manage",
            "app.groups.moderate",
            "app.users.invite",
            "app.reports.view",
        ],
        "is_system": True,
        "grants_all": False,
    },
    {
        "slug": "moderator",
        "name": "Moderator",
        "description": "Куратор/модератор и владелец интеграций",
        "level": 30,
        "permissions": [
            "app.dashboard.view",
            "app.calendar.manage",
            "app.tasks.manage",
            "app.areas.manage",
            "app.projects.manage",
            "app.habits.manage",
            "app.groups.moderate",
            "app.integrations.manage",
            "app.settings.manage",
            "app.users.invite",
            "app.reports.view",
            "app.data.export",
        ],
        "is_system": True,
        "grants_all": False,
    },
    {
        "slug": "admin",
        "name": "Admin",
        "description": "Полный административный доступ",
        "level": 40,
        "permissions": [],
        "is_system": True,
        "grants_all": True,
    },
]


class AccessControlService:
    """Manage role assignments and permission evaluation."""

    _perm_cache: Optional[tuple[float, PermissionRegistry]] = None
    _role_cache: Optional[tuple[float, Dict[str, Role]]] = None
    _CACHE_TTL = 30.0

    def __init__(self, session: Optional[AsyncSession] = None) -> None:
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "AccessControlService":
        if self.session is None:
            self.session = db.async_session()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if not self._external:
            if exc_type is None:
                await self.session.commit()
            else:  # pragma: no cover - defensive
                await self.session.rollback()
            await self.session.close()

    @classmethod
    def invalidate_cache(cls) -> None:
        cls._perm_cache = None
        cls._role_cache = None

    async def _get_permission_registry(self) -> PermissionRegistry:
        now = time.time()
        cache = AccessControlService._perm_cache
        if cache and now - cache[0] < self._CACHE_TTL:
            return cache[1]
        result = await self.session.execute(select(AuthPermission))
        fallback = {
            definition["code"]: definition["bit_position"]
            for definition in DEFAULT_PERMISSIONS
        }
        registry = PermissionRegistry(result.scalars().all(), fallback=fallback)
        AccessControlService._perm_cache = (now, registry)
        return registry

    async def _get_roles_map(self) -> Dict[str, Role]:
        now = time.time()
        cache = AccessControlService._role_cache
        if cache and now - cache[0] < self._CACHE_TTL:
            return cache[1]
        result = await self.session.execute(select(Role))
        roles = {role.slug: role for role in result.scalars()}
        AccessControlService._role_cache = (now, roles)
        return roles

    async def seed_presets(self) -> None:
        registry = await self._get_permission_registry()
        existing_codes = registry.all_codes()
        for definition in DEFAULT_PERMISSIONS:
            if definition["code"] not in existing_codes:
                perm = AuthPermission(
                    code=definition["code"],
                    name=definition["name"],
                    description=definition["description"],
                    category=definition["category"],
                    bit_position=definition["bit_position"],
                    mutable=False,
                )
                self.session.add(perm)
        await self.session.flush()
        for definition in DEFAULT_PERMISSIONS:
            stmt = select(AuthPermission).where(
                AuthPermission.code == definition["code"]
            )
            perm = (await self.session.execute(stmt)).scalar_one_or_none()
            if perm:
                perm.name = definition["name"]
                perm.description = definition["description"]
                perm.category = definition["category"]
                perm.bit_position = definition["bit_position"]
                perm.mutable = False

        await self.session.flush()
        AccessControlService.invalidate_cache()

        registry = await self._get_permission_registry()
        roles_map = await self._get_roles_map()
        bit_lookup = {
            definition["code"]: definition["bit_position"]
            for definition in DEFAULT_PERMISSIONS
        }
        for role_def in DEFAULT_ROLES:
            permissions = role_def["permissions"]
            mask = 0
            for code in permissions:
                if code in bit_lookup:
                    mask |= 1 << bit_lookup[code]
                else:
                    try:
                        mask |= registry.mask_for([code])
                    except KeyError:
                        continue
            role = roles_map.get(role_def["slug"])
            if role is None:
                role = Role(
                    slug=role_def["slug"],
                    name=role_def["name"],
                    description=role_def["description"],
                    level=role_def["level"],
                    permissions_mask=mask,
                    is_system=role_def["is_system"],
                    grants_all=role_def["grants_all"],
                )
                self.session.add(role)
            else:
                role.name = role_def["name"]
                role.description = role_def["description"]
                role.level = role_def["level"]
                role.permissions_mask = mask
                role.is_system = role_def["is_system"]
                role.grants_all = role_def["grants_all"]
        await self.session.flush()
        AccessControlService.invalidate_cache()

    async def grant_role(
        self,
        *,
        target_user_id: int,
        role_slug: str,
        actor_user_id: Optional[int] = None,
        scope: AccessScope = AccessScope.global_scope(),
        expires_at=None,
    ) -> UserRoleLink:
        roles = await self._get_roles_map()
        role = roles.get(role_slug)
        if role is None:
            await self.seed_presets()
            roles = await self._get_roles_map()
            role = roles.get(role_slug)
        if role is None:
            raise ValueError(f"Role '{role_slug}' not found")

        stmt = (
            select(UserRoleLink)
            .where(UserRoleLink.user_id == target_user_id)
            .where(UserRoleLink.role_id == role.id)
            .where(UserRoleLink.scope_type == scope.scope_type)
            .where(
                UserRoleLink.scope_id.is_(None)
                if scope.scope_id is None
                else UserRoleLink.scope_id == scope.scope_id
            )
        )
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()
        if existing:
            existing.expires_at = expires_at
            if actor_user_id is not None:
                existing.granted_by = actor_user_id
            link = existing
        else:
            link = UserRoleLink(
                user_id=target_user_id,
                role_id=role.id,
                scope_type=scope.scope_type,
                scope_id=scope.scope_id,
                expires_at=expires_at,
                granted_by=actor_user_id,
            )
            self.session.add(link)
        await self.session.flush()

        async with AuditLogService(self.session) as audit:
            await audit.log_role_assignment(
                actor_user_id=actor_user_id,
                target_user_id=target_user_id,
                action="grant_role",
                role_slug=role.slug,
                scope_type=scope.scope_type,
                scope_id=scope.scope_id,
                details={"expires_at": expires_at.isoformat() if expires_at else None},
            )
        AccessControlService.invalidate_cache()
        return link

    async def revoke_role(
        self,
        *,
        target_user_id: int,
        role_slug: str,
        actor_user_id: Optional[int] = None,
        scope: AccessScope = AccessScope.global_scope(),
    ) -> bool:
        roles = await self._get_roles_map()
        role = roles.get(role_slug)
        if role is None:
            await self.seed_presets()
            roles = await self._get_roles_map()
            role = roles.get(role_slug)
        if role is None:
            raise ValueError(f"Role '{role_slug}' not found")
        stmt = (
            select(UserRoleLink)
            .where(UserRoleLink.user_id == target_user_id)
            .where(UserRoleLink.role_id == role.id)
            .where(UserRoleLink.scope_type == scope.scope_type)
            .where(
                UserRoleLink.scope_id.is_(None)
                if scope.scope_id is None
                else UserRoleLink.scope_id == scope.scope_id
            )
        )
        result = await self.session.execute(stmt)
        existing = result.scalar_one_or_none()
        if not existing:
            return False
        await self.session.delete(existing)
        await self.session.flush()

        async with AuditLogService(self.session) as audit:
            await audit.log_role_assignment(
                actor_user_id=actor_user_id,
                target_user_id=target_user_id,
                action="revoke_role",
                role_slug=role.slug,
                scope_type=scope.scope_type,
                scope_id=scope.scope_id,
                details=None,
            )
        AccessControlService.invalidate_cache()
        return True

    async def set_primary_role(
        self,
        *,
        user: WebUser,
        role_slug: str,
        actor_user_id: Optional[int] = None,
    ) -> None:
        user.role = role_slug
        await self.session.flush()
        await self.grant_role(
            target_user_id=user.id,
            role_slug=role_slug,
            actor_user_id=actor_user_id,
            scope=AccessScope.global_scope(),
        )

    async def user_has_role(
        self,
        user: WebUser,
        role_slug: str,
        scope: AccessScope = AccessScope.global_scope(),
    ) -> bool:
        effective = await self.list_effective_permissions(user, scope=scope)
        return effective.has_role(role_slug)

    async def list_effective_permissions(
        self,
        user: WebUser | int,
        scope: AccessScope = AccessScope.global_scope(),
    ) -> EffectivePermissions:
        if isinstance(user, WebUser):
            user_obj = user
            if not getattr(user_obj, "role", None):
                refreshed = await self.session.get(WebUser, user_obj.id)
                if refreshed is not None:
                    user_obj = refreshed
        else:
            user_obj = await self.session.get(WebUser, user)
            if user_obj is None:
                raise ValueError("User not found")

        registry = await self._get_permission_registry()
        roles_map = await self._get_roles_map()

        scope_chain = await self._resolve_scope_chain(scope, user_obj)
        conditions = []
        for scope_case in scope_chain:
            if scope_case.scope_id is None:
                conditions.append(
                    and_(
                        UserRoleLink.scope_type == scope_case.scope_type,
                        UserRoleLink.scope_id.is_(None),
                    )
                )
            else:
                conditions.append(
                    and_(
                        UserRoleLink.scope_type == scope_case.scope_type,
                        UserRoleLink.scope_id == scope_case.scope_id,
                    )
                )
        stmt = (
            select(UserRoleLink, Role)
            .join(Role, Role.id == UserRoleLink.role_id)
            .where(UserRoleLink.user_id == user_obj.id)
            .where(
                or_(*conditions)
                if conditions
                else UserRoleLink.scope_type == "global"
            )
        )
        now = utcnow()
        stmt = stmt.where(
            or_(
                UserRoleLink.expires_at.is_(None),
                UserRoleLink.expires_at > now,
            )
        )
        try:
            result = await self.session.execute(stmt)
        except OperationalError:
            result = None

        accumulator_mask = 0
        role_slugs: Set[str] = set()
        is_superuser = False
        if result is not None:
            for link, role in result.all():
                slug = role.slug or role.name.lower()
                role_slugs.add(slug)
                if role.grants_all:
                    is_superuser = True
                accumulator_mask |= role.permissions_mask

        primary_slug = (user_obj.role or "single").lower()
        base_role = roles_map.get(primary_slug)
        if base_role is not None:
            role_slugs.add(base_role.slug)
            if base_role.grants_all:
                is_superuser = True
            accumulator_mask |= base_role.permissions_mask
        else:
            default_role = next(
                (item for item in DEFAULT_ROLES if item["slug"] == primary_slug),
                None,
            )
            if default_role is not None:
                role_slugs.add(primary_slug)
                bit_lookup = {
                    definition["code"]: definition["bit_position"]
                    for definition in DEFAULT_PERMISSIONS
                }
                for code in default_role["permissions"]:
                    bit = bit_lookup.get(code)
                    if bit is not None:
                        accumulator_mask |= 1 << bit
                if default_role["grants_all"]:
                    is_superuser = True

        return EffectivePermissions(
            registry=registry,
            mask=accumulator_mask,
            roles=role_slugs,
            is_superuser=is_superuser,
        )

    async def _resolve_scope_chain(
        self, scope: AccessScope, user: WebUser
    ) -> Sequence[AccessScope]:
        chain = [AccessScope.global_scope()]
        if scope.scope_type == "global" or scope.scope_id is None:
            return chain
        if scope.scope_type == "area":
            chain.append(scope)
        elif scope.scope_type == "project":
            project = await self.session.get(Project, scope.scope_id)
            if project and project.area_id:
                chain.append(AccessScope("area", project.area_id))
            chain.append(scope)
        else:
            raise ValueError(f"Unknown scope type: {scope.scope_type}")
        return chain

    async def list_roles(self) -> Sequence[Role]:
        roles = await self._get_roles_map()
        return list(roles.values())


__all__ = [
    "AccessControlService",
    "AccessScope",
    "EffectivePermissions",
]
