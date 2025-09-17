"""Telegram notifications for task reminders and watchers."""

from __future__ import annotations

from typing import Iterable

from sqlalchemy import select

from core.models import (
    Task,
    TaskReminder,
    TaskWatcher,
    TaskControlStatus,
    TaskRefuseReason,
    TaskWatcherState,
)
from core.services.telegram_bot import TelegramBotClient


class TaskNotificationService:
    """Send Telegram notifications about tasks and watchers."""

    def __init__(self, session, bot: TelegramBotClient | None = None) -> None:
        self.session = session
        self.bot = bot or TelegramBotClient()

    async def notify_watcher_added(
        self,
        task: Task,
        watcher_id: int,
        *,
        added_by: int | None = None,
    ) -> None:
        title = task.title or "(без названия)"
        text = (
            f"Вы добавлены наблюдателем задачи #{task.id}: {title}.\n"
            f"Чтобы отключить уведомления, отправь /task_unwatch {task.id}."
        )
        await self.bot.send_message(watcher_id, text, silent=True)
        actor_suffix = "" if added_by in (None, task.owner_id) else f" (добавил {added_by})"
        owner_text = f"Наблюдатель {watcher_id} подключён к задаче #{task.id}.{actor_suffix}"
        await self.bot.send_message(task.owner_id, owner_text, silent=True)

    async def notify_watcher_left(self, task: Task, watcher_id: int) -> None:
        text = (
            f"Наблюдатель {watcher_id} отключился от задачи #{task.id} ({task.title})."
        )
        await self.bot.send_message(task.owner_id, text, silent=True)

    async def notify_task_status(
        self,
        task: Task,
        status: TaskControlStatus,
        *,
        reason: TaskRefuseReason | None = None,
    ) -> None:
        watchers = await self._active_watchers(task.id)
        if not watchers:
            return
        reason_text = "выполнена" if reason == TaskRefuseReason.done else "отменена"
        text = f"Задача #{task.id} ({task.title}) {reason_text}."
        for watcher in watchers:
            await self.bot.send_message(watcher.watcher_id, text, silent=False)

    async def notify_reminder(self, task: Task, reminder: TaskReminder) -> None:
        title = task.title or "(без названия)"
        text = f"Напоминание: задача #{task.id} — {title}."
        await self.bot.send_message(task.owner_id, text, silent=False)
        for watcher in await self._active_watchers(task.id):
            await self.bot.send_message(
                watcher.watcher_id,
                f"Напоминание наблюдаемой задачи #{task.id}: {title}.",
                silent=True,
            )

    async def _active_watchers(self, task_id: int) -> Iterable[TaskWatcher]:
        res = await self.session.execute(
            select(TaskWatcher).where(
                TaskWatcher.task_id == task_id,
                TaskWatcher.state == TaskWatcherState.active,
            )
        )
        return res.scalars().all()
