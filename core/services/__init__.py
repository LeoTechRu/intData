"""Service exports for easy access."""

from .note_service import NoteService
from .task_service import TaskService
from .telegram_user_service import TelegramUserService
from .crm_service import CRMService
from .group_moderation_service import GroupModerationService
from .time_service import TimeService
from .web_user_service import WebUserService
from .favorite_service import FavoriteService
from .habits import HabitsService, DailiesService, HabitsCronService, UserStatsService
from .sync_gcal import (
    generate_auth_url,
    exchange_code,
    save_link as save_gcal_link,
    initial as gcal_initial,
    incremental as gcal_incremental,
)

__all__ = [
    "NoteService",
    "TaskService",
    "TelegramUserService",
    "CRMService",
    "GroupModerationService",
    "TimeService",
    "WebUserService",
    "FavoriteService",
    "HabitsService",
    "DailiesService",
    "HabitsCronService",
    "UserStatsService",
    "generate_auth_url",
    "exchange_code",
    "save_gcal_link",
    "gcal_initial",
    "gcal_incremental",
]
