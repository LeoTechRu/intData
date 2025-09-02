Директория для внутренней документации проекта.

# Areas: иерархия сфер ответственности

Areas — управляемое дерево без ограничения глубины. Примеры: «Здоровье → Фитнес → Силовые», «Работа → Клиенты → Проект X».

- Проекты и задачи привязываются к листьям дерева (конечным узлам). Это упрощает отчёты: время и прогресс агрегируются снизу вверх.
- Фильтры поддерживают режим «Включая подкатегории»: можно смотреть задачи/время как по отдельной подветке, так и по всему направлению.
- Перемещение узла меняет путь `mp_path` у всех потомков; ссылки и данные сохраняются (архитектура без жёсткой FK на путь).

Совет: держите дерево компактным. Создавайте подкатегории только когда появляется повторяющийся объём задач и заметок, требующий отдельного фокуса.


# Как получить `chat_id` Telegram-группы

1. Создайте или выберите существующую группу в Telegram.
2. Добавьте в неё своего бота — по username из переменной `TG_BOT_USERNAME`.
3. Сделайте бота администратором, чтобы он мог отправлять сообщения.
4. Получите `chat_id` одним из способов:
   - Напишите любое сообщение в группу и выполните запрос:
     `https://api.telegram.org/bot<TG_BOT_TOKEN>/getUpdates`.
   - В ответе найдите поле `chat` → `id` (будет отрицательным числом).
5. Используйте полученный `chat_id` в настройках канала, например при вызове
   `POST /api/v1/projects/{id}/notifications`.

## Deployment Notes / Troubleshooting

### Habit.area AttributeError

На некоторых окружениях страница [/habits] приводила к `AttributeError: type object 'Habit' has no attribute 'area'`.
Причина — в ORM‑модели `Habit` отсутствовали связи `area` и `project`, несмотря на наличие столбцов в БД.
Сервис `list_habits` загружал связи через `selectinload`, что и вызывало падение.

**Воспроизведение:** открыть `/habits` при включённом фича‑флаге `HABITS_V1_ENABLED`.

**Исправление:** добавлены отношения в модели, DDL гарантирует FK на `areas`/`projects`,
`core.db.repair` наследует `area_id` от проекта и логирует случаи, когда оба идентификатора отсутствуют.
См. эпики [E16](./BACKLOG.md#e16-habits), [E12](./BACKLOG.md#e12-calendaralarms-fusion-сегодня--общий-список)
и [E13](./BACKLOG.md#e13-tasks--time-para-first).

### DB bootstrap / repair

```bash
python -m core.db.migrate && python -m core.db.repair
```

### Weekly digests

Включите недельные дайджесты привычек через переменные окружения
`HABITS_WEEKLY_DIGEST_ENABLED=true` и `ENABLE_SCHEDULER=1`. Расписание
задаётся строкой `DIGEST_WEEKLY_CRON`, например `"MON 08:00 Europe/Bucharest"`.
Для отправки сообщений необходимо настроить `project_notifications` с
привязанным Telegram‑чатом.

### Post-deploy checklist

- [ ] Run DB bootstrap/repair: `python -m core.db.migrate && python -m core.db.repair`
- [ ] Verify new columns: user_stats.daily_xp/daily_gold; habits.daily_limit/cooldown_sec/last_action_at; habit_logs.val_after.
- [ ] Set env: `HABITS_ANTIFARM_ENABLED=true`, `HABITS_WEEKLY_DIGEST_ENABLED=true`, `DIGEST_WEEKLY_CRON="MON 08:00 Europe/Bucharest"`.
- [ ] Open `/habits` → verify counters/cooldown appear; try rapid clicks → see cooldown; after daily_limit → reward 0.
- [ ] Call `/api/v1/habits/leaderboard?scope=project&project_id=...&period=week` → returns leaders.
- [ ] Trigger `/api/v1/habits/digest/run?scope=project&project_id=...&deliver=1` → message posted in Telegram.
- [ ] Export CSV `/api/v1/habits/export?from=YYYY-MM-DD&to=YYYY-MM-DD` → correct headers and rows.
- [ ] Review CHANGELOG under [Unreleased].
