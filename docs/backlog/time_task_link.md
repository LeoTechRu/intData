# Привязка таймера к задачам

Статус: done (реализовано в коде), требуется внести записи в `CHANGELOG.md` и `BACKLOG.md`.

## Кратко
- Добавлено поле `time_entries.task_id` (FK → `tasks.id`), двунаправленная связь `Task.time_entries` ↔ `TimeEntry.task`.
- API `/api/time/start` принимает `task_id` (опционально), UI `/time` показывает колонку «Задача» и поле ввода ID.
- Сервисы: `TimeService.start_timer(..., task_id=...)` проверяет один активный таймер на пользователя, валидирует владельца, переводит задачу в `in_progress`.
- `TaskService`: `start_timer(task_id, ...)`, `total_tracked_minutes(task_id)`.
- Alembic‑миграция: `20250829_01_link_time_to_task.py`.

## Нотации для релиза
Добавить в `CHANGELOG.md` (Unreleased / Added, Changed):
- Added: связь учёта времени с задачами; API/UI доработки; сервисные хелперы; защита от параллельных таймеров.
- Changed: автоперевод задачи в `in_progress` при старте таймера.

