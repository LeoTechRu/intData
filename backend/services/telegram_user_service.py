"""Service layer for telegram-related database operations."""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Sequence, Set, Tuple
import secrets
import hashlib

from aiogram import Bot
from aiogram.enums import ChatMemberStatus
from aiogram.exceptions import TelegramBadRequest
from aiogram.types import ChatMember, User
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from backend import db
from backend.logger import logger
from backend.models import (
    TgUser,
    Group,
    UserGroup,
    UserRole,
    LogSettings,
    LogLevel,
    GroupType,
)
from backend.utils import utcnow
from backend.services.profile_service import ProfileService, normalize_slug


class TelegramUserService:
    """CRUD helpers for ``TgUser`` and related models."""

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session
        self.admin_chat_id = None
        self._external = session is not None

    async def __aenter__(self) -> "TelegramUserService":
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

    # ------------------------------------------------------------------
    # User helpers
    # ------------------------------------------------------------------
    def determine_role(
        self, telegram_id: int, role: UserRole | str | None = None
    ) -> UserRole:
        if role is not None:
            return role if isinstance(role, UserRole) else UserRole[role]
        from web.config import S

        admin_ids = [
            int(x)
            for x in (S.ADMIN_IDS or "").split(",")
            if x.strip().isdigit()
        ]
        return UserRole.admin if telegram_id in admin_ids else UserRole.single

    async def get_user_by_telegram_id(
        self, telegram_id: int
    ) -> Optional[TgUser]:
        result = await self.session.execute(
            select(TgUser).where(TgUser.telegram_id == telegram_id)
        )
        return result.scalar_one_or_none()

    async def get_user_by_username(self, username: str) -> Optional[TgUser]:
        result = await self.session.execute(
            select(TgUser).where(func.lower(TgUser.username) == username.lower())
        )
        return result.scalar_one_or_none()

    async def get_user_by_ics_token_hash(
        self, token_hash: str
    ) -> Optional[TgUser]:
        result = await self.session.execute(
            select(TgUser).where(TgUser.ics_token_hash == token_hash)
        )
        return result.scalar_one_or_none()

    async def create_user(self, **kwargs) -> Optional[TgUser]:
        try:
            if "role" not in kwargs or kwargs["role"] is None:
                kwargs["role"] = UserRole.single.name
            user = TgUser(**kwargs)
            self.session.add(user)
            await self.session.flush()
            return user
        except IntegrityError as e:
            logger.error(f"IntegrityError при создании пользователя: {e}")
            await self.session.rollback()
            return await self.get_user_by_telegram_id(kwargs["telegram_id"])
        except Exception as e:  # pragma: no cover - defensive
            logger.error(f"Неожиданная ошибка при создании пользователя: {e}")
            return None

    async def get_or_create_user(
        self,
        telegram_id: int,
        *,
        role: UserRole | str | None = None,
        **kwargs,
    ) -> Tuple[TgUser, bool]:
        user = await self.get_user_by_telegram_id(telegram_id)
        if user:
            return user, False

        resolved_role = self.determine_role(telegram_id, role)
        required_fields = {
            "telegram_id": telegram_id,
            "first_name": kwargs.get("first_name", f"User_{telegram_id}"),
            "role": resolved_role.name,
        }

        optional_fields = {
            "username": kwargs.get("username"),
            "last_name": kwargs.get("last_name"),
            "language_code": kwargs.get("language_code"),
        }

        user = await self.create_user(**{**required_fields, **optional_fields})
        return user, True

    async def generate_ics_token(self, user: TgUser) -> str:
        token = secrets.token_urlsafe(32)
        user.ics_token_hash = hashlib.sha256(token.encode()).hexdigest()
        await self.session.flush()
        return token

    async def update_from_telegram(
        self, telegram_id: int, **data: Any
    ) -> TgUser:
        """Create or update a telegram user from Telegram login data."""

        user = await self.get_user_by_telegram_id(telegram_id)
        if not user:
            user = TgUser(telegram_id=telegram_id, role=UserRole.single.name)
            self.session.add(user)
        for field in ["username", "first_name", "last_name", "language_code"]:
            if field in data and data[field] is not None:
                setattr(user, field, data[field])
        user.updated_at = utcnow()
        await self.session.flush()
        return user

    async def update_user_role(
        self, telegram_id: int, new_role: UserRole | str
    ) -> bool:
        user = await self.get_user_by_telegram_id(telegram_id)
        if not user:
            return False
        try:
            role_name = (
                new_role.name if isinstance(new_role, UserRole) else str(new_role)
            ).lower()
            if role_name == "ban":
                role_name = "suspended"
            user.role = role_name
            await self.session.flush()
            return True
        except Exception as e:
            logger.error(f"Ошибка обновления роли пользователя: {e}")
            return False

    async def list_users(self) -> List[TgUser]:
        result = await self.session.execute(select(TgUser))
        return result.scalars().all()

    # ------------------------------------------------------------------
    # Group helpers
    # ------------------------------------------------------------------
    async def get_group_by_telegram_id(
        self, telegram_id: int
    ) -> Optional[Group]:
        result = await self.session.execute(
            select(Group).where(Group.telegram_id == telegram_id)
        )
        return result.scalar_one_or_none()

    async def create_group(self, **kwargs) -> Optional[Group]:
        bind = getattr(self.session, "bind", None)
        if bind is not None and bind.dialect.name == "sqlite":
            kwargs.setdefault("id", abs(int(kwargs.get("telegram_id", 0))))
        try:
            group = Group(**kwargs)
            self.session.add(group)
            await self.session.flush()
            slug_source = kwargs.get("slug") or kwargs.get("username") or kwargs.get("title")
            slug = normalize_slug(slug_source, f"group-{group.telegram_id}")
            async with ProfileService(self.session) as profiles:
                await profiles.upsert_profile_meta(
                    entity_type="group",
                    entity_id=group.telegram_id,
                    updates={
                        "slug": slug,
                        "display_name": group.title,
                        "summary": group.description,
                        "profile_meta": {
                            "type": group.type.value if group.type else None,
                            "participants_count": group.participants_count,
                        },
                        "force_slug": True,
                    },
                )
            return group
        except IntegrityError as e:
            if "groups.id" in str(e):
                await self.session.rollback()
                kwargs.setdefault("id", abs(int(kwargs.get("telegram_id", 0))))
                group = Group(**kwargs)
                self.session.add(group)
                await self.session.flush()
                slug_source = kwargs.get("slug") or kwargs.get("username") or kwargs.get("title")
                slug = normalize_slug(slug_source, f"group-{group.telegram_id}")
                async with ProfileService(self.session) as profiles:
                    await profiles.upsert_profile_meta(
                        entity_type="group",
                        entity_id=group.telegram_id,
                        updates={
                            "slug": slug,
                            "display_name": group.title,
                            "summary": group.description,
                            "profile_meta": {
                                "type": group.type.value if group.type else None,
                                "participants_count": group.participants_count,
                            },
                            "force_slug": True,
                        },
                    )
                return group
            logger.error(f"IntegrityError при создании группы: {e}")
            await self.session.rollback()
            return None
        except Exception as e:
            logger.error(f"Ошибка создания группы: {e}")
            return None

    async def get_or_create_group(
        self, telegram_id: int, **kwargs
    ) -> Tuple[Group, bool]:
        group = await self.get_group_by_telegram_id(telegram_id)
        if group:
            return group, False
        required_fields = {
            "telegram_id": telegram_id,
            "title": kwargs.get("title", f"Group_{telegram_id}"),
            "type": kwargs.get("type", GroupType.private),
            "owner_id": kwargs.get("owner_id"),
        }
        group = await self.create_group(**required_fields)
        return group, True

    async def is_user_in_group(self, user_id: int, group_id: int) -> bool:
        result = await self.session.execute(
            select(UserGroup).where(
                UserGroup.user_id == user_id, UserGroup.group_id == group_id
            )
        )
        return result.scalar_one_or_none() is not None

    async def upsert_user_group_link(
        self,
        user_id: int,
        group_id: int,
        *,
        is_owner: bool = False,
        is_moderator: bool = False,
    ) -> Tuple[UserGroup, bool]:
        """Ensure ``UserGroup`` link exists and reflect moderator/owner flags."""

        link = await self.session.get(UserGroup, (user_id, group_id))
        target_is_moderator = is_owner or is_moderator
        if link:
            changed = False
            if is_owner and not link.is_owner:
                link.is_owner = True
                changed = True
            if link.is_moderator != target_is_moderator:
                link.is_moderator = target_is_moderator
                changed = True
            return link, False

        link = UserGroup(
            user_id=user_id,
            group_id=group_id,
            is_owner=is_owner,
            is_moderator=target_is_moderator,
        )
        self.session.add(link)

        group = await self.get_group_by_telegram_id(group_id)
        if group:
            current = group.participants_count or 0
            group.participants_count = current + 1
        await self.session.flush()
        return link, True

    async def add_user_to_group(
        self,
        user_id: int,
        group_id: int,
        is_moderator: bool = False,
        *,
        is_owner: bool = False,
    ) -> Tuple[bool, str]:
        try:
            _, created = await self.upsert_user_group_link(
                user_id,
                group_id,
                is_owner=is_owner,
                is_moderator=is_moderator,
            )
            if not created:
                return False, "Вы уже состоите в этой группе"
            return True, "Вы успешно добавлены в группу"
        except Exception as e:
            logger.error(f"Ошибка добавления в группу: {e}")
            await self.session.rollback()
            return False, f"Ошибка при добавлении в группу: {str(e)}"

    async def get_group_members(self, group_id: int) -> List[TgUser]:
        result = await self.session.execute(
            select(TgUser)
            .join(UserGroup)
            .where(UserGroup.group_id == group_id)
        )
        return result.scalars().all()

    async def remove_user_from_group(self, user_id: int, group_id: int) -> bool:
        result = await self.session.execute(
            select(UserGroup).where(
                UserGroup.user_id == user_id,
                UserGroup.group_id == group_id,
            )
        )
        link = result.scalar_one_or_none()
        if not link:
            return False
        await self.session.delete(link)
        group = await self.get_group_by_telegram_id(group_id)
        if group and group.participants_count and group.participants_count > 0:
            group.participants_count -= 1
        await self.session.flush()
        return True

    async def sync_group_members_from_bot(
        self,
        *,
        bot: Bot,
        chat_id: int,
        chat_title: Optional[str] = None,
        chat_type: Optional[str] = None,
        extra_users: Sequence[User] | None = None,
    ) -> int:
        """Fetch available roster information from Bot API and persist it."""

        extra_users = extra_users or []

        group_kwargs: Dict[str, Any] = {}
        if chat_title:
            group_kwargs["title"] = chat_title
        if chat_type:
            try:
                group_kwargs["type"] = GroupType(chat_type)
            except ValueError:
                logger.debug("Unknown group type %s when syncing", chat_type)
        if extra_users:
            for user_obj in extra_users:
                await self.update_from_telegram(
                    telegram_id=user_obj.id,
                    username=getattr(user_obj, "username", None),
                    first_name=getattr(user_obj, "first_name", None),
                    last_name=getattr(user_obj, "last_name", None),
                    language_code=getattr(user_obj, "language_code", None),
                )
            group_kwargs.setdefault("owner_id", extra_users[0].id)

        group, created = await self.get_or_create_group(chat_id, **group_kwargs)
        if not created:
            updated = False
            if chat_title and group.title != chat_title:
                group.title = chat_title
                updated = True
            if chat_type:
                try:
                    group_type = GroupType(chat_type)
                    if group.type != group_type:
                        group.type = group_type
                        updated = True
                except ValueError:
                    pass
            if updated:
                await self.session.flush()

        members: Sequence[ChatMember] = []
        try:
            members = await bot.get_chat_administrators(chat_id)
        except TelegramBadRequest as exc:
            logger.debug("Failed to fetch administrators for %s: %s", chat_id, exc)
        except Exception as exc:  # pragma: no cover - defensive
            logger.warning("Unexpected error fetching admins for %s: %s", chat_id, exc)

        processed = 0
        seen_ids: Set[int] = set()
        admin_statuses = {
            ChatMemberStatus.ADMINISTRATOR,
            ChatMemberStatus.CREATOR,
        }

        for member in members:
            user_obj = member.user
            if user_obj.is_bot:
                continue
            tg_user = await self.update_from_telegram(
                telegram_id=user_obj.id,
                username=user_obj.username,
                first_name=user_obj.first_name,
                last_name=user_obj.last_name,
                language_code=user_obj.language_code,
            )
            is_owner = member.status == ChatMemberStatus.CREATOR
            is_moderator = member.status in admin_statuses
            await self.upsert_user_group_link(
                tg_user.telegram_id,
                chat_id,
                is_owner=is_owner,
                is_moderator=is_moderator,
            )
            seen_ids.add(tg_user.telegram_id)
            processed += 1

        for user_obj in extra_users:
            if user_obj.is_bot or user_obj.id in seen_ids:
                continue
            tg_user = await self.update_from_telegram(
                telegram_id=user_obj.id,
                username=user_obj.username,
                first_name=user_obj.first_name,
                last_name=user_obj.last_name,
                language_code=user_obj.language_code,
            )
            await self.upsert_user_group_link(tg_user.telegram_id, chat_id)
            seen_ids.add(tg_user.telegram_id)
            processed += 1

        try:
            count = await bot.get_chat_member_count(chat_id)
        except TelegramBadRequest:
            count = None
        except Exception as exc:  # pragma: no cover - defensive logging
            logger.warning("Failed to fetch member count for %s: %s", chat_id, exc)
            count = None

        if count is not None:
            group = await self.get_group_by_telegram_id(chat_id)
            if group:
                group.participants_count = count

        return processed

    async def update_group_description(self, group_id: int, description: str) -> bool:
        """Update group's description."""
        group = await self.get_group_by_telegram_id(group_id)
        if not group:
            return False
        try:
            group.description = description
            group.updated_at = utcnow()
            await self.session.flush()
            async with ProfileService(self.session) as profiles:
                await profiles.upsert_profile_meta(
                    entity_type="group",
                    entity_id=group.telegram_id,
                    updates={
                        "display_name": group.title,
                        "summary": group.description,
                    },
                )
            return True
        except Exception as e:  # pragma: no cover - defensive
            logger.error(f"Ошибка обновления описания группы: {e}")
            return False

    async def list_user_groups(self, user_id: int) -> List[Group]:
        result = await self.session.execute(
            select(Group).join(UserGroup).where(UserGroup.user_id == user_id)
        )
        return result.scalars().all()

    async def get_user_and_groups(
        self, telegram_id: int
    ) -> Tuple[Optional[TgUser], List[Group]]:
        user = await self.get_user_by_telegram_id(telegram_id)
        if not user:
            return None, []
        groups = await self.list_user_groups(telegram_id)
        return user, groups

    async def get_contact_info(self, telegram_id: int) -> Dict[str, Any]:
        user, groups = await self.get_user_and_groups(telegram_id)
        if not user:
            return {}
        display_name = (
            user.bot_settings.get("full_display_name")
            if isinstance(user.bot_settings, dict)
            else None
        ) or f"{user.first_name} {user.last_name or ''}".strip()
        return {
            "user": user,
            "groups": groups,
            "telegram_id": user.telegram_id,
            "username": f"@{user.username}" if user.username else None,
            "full_display_name": display_name,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "display_name": display_name,
            "email": (
                user.bot_settings.get("email")
                if isinstance(user.bot_settings, dict)
                else None
            ),
            "phone": (
                user.bot_settings.get("phone")
                if isinstance(user.bot_settings, dict)
                else None
            ),
            "birthday": (
                user.bot_settings.get("birthday")
                if isinstance(user.bot_settings, dict)
                else None
            ),
            "language_code": user.language_code,
            "role_name": user.role,
        }

    async def update_user_profile(
        self, telegram_id: int, data: Dict[str, Any]
    ) -> Optional[TgUser]:
        user = await self.get_user_by_telegram_id(telegram_id)
        if not user:
            return None
        allowed = {
            "first_name",
            "last_name",
            "username",
            "language_code",
            "bot_settings",
        }
        for field, value in data.items():
            if field in allowed and value is not None:
                setattr(user, field, value)
        user.updated_at = utcnow()
        await self.session.flush()
        return user

    async def update_bot_setting(self, telegram_id: int, key: str, value: Any) -> bool:
        """Update a single field inside ``bot_settings``."""
        user = await self.get_user_by_telegram_id(telegram_id)
        if not user:
            return False
        try:
            settings = user.bot_settings or {}
            settings[key] = value
            user.bot_settings = settings
            user.updated_at = utcnow()
            await self.session.flush()
            return True
        except Exception as e:  # pragma: no cover - defensive
            logger.error(f"Ошибка обновления поля {key}: {e}")
            return False

    async def list_groups_with_members(self) -> List[Dict[str, Any]]:
        result = await self.session.execute(select(Group))
        groups = result.scalars().all()
        data: List[Dict[str, Any]] = []
        for group in groups:
            members = await self.get_group_members(group.telegram_id)
            data.append({"group": group, "members": members})
        return data

    # ------------------------------------------------------------------
    # Logging settings
    # ------------------------------------------------------------------
    async def get_log_settings(self) -> Optional[LogSettings]:
        result = await self.session.execute(
            select(LogSettings).where(LogSettings.id == 1)
        )
        return result.scalar_one_or_none()

    async def update_log_level(
        self, level: LogLevel, chat_id: int | None = None
    ) -> bool:
        try:
            settings = await self.get_log_settings()
            if settings:
                settings.level = level
                settings.updated_at = utcnow()
                await self.session.flush()
                return True
            settings = LogSettings(
                id=1,
                level=level,
                chat_id=chat_id or self.admin_chat_id,
                updated_at=utcnow(),
            )
            self.session.add(settings)
            await self.session.flush()
            logger.setLevel(level.name)
            return True
        except Exception as e:  # pragma: no cover - defensive
            logger.error(f"Ошибка обновления уровня логирования: {e}")
            return False

    async def send_log_to_telegram(
        self, level: LogLevel, message: str
    ) -> bool:
        try:
            settings = await self.get_log_settings()
            if not settings or level.value < settings.level.value:
                return False
            bot = Bot(token=db.TG_BOT_TOKEN)
            await bot.send_message(
                chat_id=settings.chat_id,
                text=f"[{level.name}] {message}",
                parse_mode="MarkdownV2",
            )
            return True
        except Exception as e:  # pragma: no cover - defensive
            logger.error(f"Ошибка отправки лога в Telegram: {e}")
            return False
