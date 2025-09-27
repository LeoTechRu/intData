"""Polling worker to deliver task reminders."""

from __future__ import annotations

import asyncio
from datetime import timedelta

from sqlalchemy import select

from backend import db
from backend.models import TaskReminder, Task
from backend.services.task_notification_service import TaskNotificationService
from backend.services.telegram_bot import TelegramBotClient
from backend.utils import utcnow


class TaskReminderWorker:
    """Background loop delivering TaskReminder notifications."""

    def __init__(self, poll_interval: float = 60.0, bot: TelegramBotClient | None = None) -> None:
        self.poll_interval = poll_interval
        self.bot = bot or TelegramBotClient()

    async def run_once(self) -> None:
        async with db.async_session() as session:
            now = utcnow()
            res = await session.execute(
                select(TaskReminder).where(
                    TaskReminder.is_active.is_(True),
                    TaskReminder.trigger_at <= now,
                )
            )
            reminders = res.scalars().all()
            if not reminders:
                return
            notifier = TaskNotificationService(session, self.bot)
            for reminder in reminders:
                task = await session.get(Task, reminder.task_id)
                if task is None:
                    reminder.is_active = False
                    continue
                await notifier.notify_reminder(task, reminder)
                reminder.last_triggered_at = now
                if reminder.frequency_minutes:
                    # make sure trigger_at moves forward even after multiple overdue periods
                    while reminder.trigger_at <= now:
                        reminder.trigger_at += timedelta(minutes=reminder.frequency_minutes)
                else:
                    reminder.is_active = False
                await session.flush()
            await session.commit()

    async def start(self, stop_event: asyncio.Event | None = None) -> None:
        while True:
            await self.run_once()
            if stop_event is None:
                await asyncio.sleep(self.poll_interval)
            else:
                try:
                    await asyncio.wait_for(stop_event.wait(), timeout=self.poll_interval)
                    break
                except asyncio.TimeoutError:
                    continue
