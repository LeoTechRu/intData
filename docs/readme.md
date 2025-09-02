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

### Post-deploy checklist

- [ ] Run DB bootstrap/repair: `python -m core.db.migrate && python -m core.db.repair`
- [ ] Verify `habits.area_id`/`project_id` columns & FKs exist.
- [ ] Open `/habits` as a new user → HTTP 200, empty state renders.
- [ ] Trigger `/api/v1/habits/cron/run` for a user; run again (idempotent).
- [ ] Check `/calendar/agenda?include_habits=1&from=YYYY-MM-DD&to=YYYY-MM-DD` returns virtual dailies.
- [ ] Export `feed.ics` and confirm VTODO with RRULE for dailies.
- [ ] Review `docs/CHANGELOG.md` entries merged under [Unreleased].
