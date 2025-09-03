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

### Troubleshooting /habits

**Симптом:** страница `/habits` показывает «Требуется вход и связанный Telegram» при активной сессии.

**Причина:** маршруты использовали `get_current_tg_user`, игнорируя веб‑сессию пользователя.

**Решение:** новый резолвер `get_current_owner` обрабатывает куки веб‑пользователя и привязку Telegram. Страница `/habits` всегда возвращает `200 OK`, но действия записи требуют привязку и отвечают `403 tg_link_required`.

**UI:** при ответе `429` клиент показывает уведомление «Кулдаун: повторите через N сек.» и временно блокирует кнопки.

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

## OpenAPI SSoT & export

Снимок API хранится в `api/openapi.json`. Для обновления файла после
изменений эндпоинтов выполните:

```bash
python -m web.openapi_export
```

### Weekly digests

Включите недельные дайджесты привычек через переменные окружения
`HABITS_WEEKLY_DIGEST_ENABLED=true` и `ENABLE_SCHEDULER=1`. Расписание
задаётся строкой `DIGEST_WEEKLY_CRON`, например `"MON 08:00 Europe/Bucharest"`.
Для отправки сообщений необходимо настроить `project_notifications` с
привязанным Telegram‑чатом.

### Post-deploy checklist

- [ ] `python -m core.db.migrate && python -m core.db.repair`
- [ ] Войти под web-пользователем без TG → `/habits` 200 OK, баннер CTA без блокирующего текста.
- [ ] Привязать TG → `/habits` показывает HUD; up/down работают.
- [ ] Два быстрых клика по привычке → второй запрос 429 с `Retry-After`, UI показывает обратный отсчёт.
- [ ] `GET /api/openapi.json` загружается; файл `api/openapi.json` идентичен.
- [ ] В `docs/CHANGELOG.md` под `[Unreleased]` присутствуют новые пункты Fixed/Changed/Security.

## Testing

Для запуска тестов требуется доступ к PostgreSQL, настройки берутся из `.env.test`.

```bash
pytest -q
pytest -q -k habits
RUN_SLOW=1 pytest -q
```

## Observability quickstart

Enable metrics locally:

```bash
export METRICS_ENABLED=1 METRICS_BASIC_AUTH_USER=user METRICS_BASIC_AUTH_PASS=pass
python -m web.main
curl -u user:pass http://localhost:8000/metrics
```

## Security toggles

Headers middleware and rate limiter can be disabled:

```bash
SECURITY_HEADERS_ENABLED=0 RATE_LIMIT_ENABLED=0 python -m web.main
```

## Logging fields

Logs are emitted as JSON and include `ts`, `level`, `logger`, `request_id`, `path`, `method`, `status` and `duration_ms`.
Use `X-Request-ID` header to correlate.

## Local commands

```bash
make setup-dev
make lint
make fmt
make typecheck
make audit
make smoke
```
