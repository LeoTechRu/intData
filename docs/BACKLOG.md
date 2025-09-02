# Backlog (Single Source of Truth)

## Оглавление
- [Roadmap & Milestones](#roadmap--milestones)
- [Решения по архитектуре (ПРОЧНО)](#решения-по-архитектуре-прочно)
- [Эпики](#эпики)
  - [E1: PARA-first доменная модель (Areas/Projects/CalendarItem/Alarm)](#e1-para-first-доменная-модель-areasprojectscalendaritemalarm)
    - [E1a: Иерархические Areas](#e1a-иерархические-areas)
  - [E2: Миграции БД и индексы](#e2-миграции-бд-и-индексы)
  - [E3: API (Calendar: /calendar/items, /calendar/agenda, /calendar/feed.ics, /projects/{id}/notifications)](#e3-api-calendar-calendaritems-calendaragenda-calendarfeedics-projectsidnotifications)
  - [E4: Синхронизация с Google Calendar](#e4-синхронизация-с-google-calendar)
  - [E5: Telegram-уведомления](#e5-telegram-уведомления)
  - [E6: ICS-фиды](#e6-ics-фиды)
  - [E7: Роли и режимы (single/multiplayer)](#e7-роли-и-режимы-singlemultiplayer)
  - [E8: Совместимость с /Alarms](#e8-совместимость-с-alarms)
  - [E9: Тесты и документация, фичефлаг](#e9-тесты-и-документация-фичефлаг)
  - [E10: Capture (бот/веб, Inbox)](#e10-capture-ботвеб-inbox)
  - [E11: Search & Retrieval (поиск, бэклинки, wikilinks, граф)](#e11-search--retrieval-поиск-бэклинки-wikilinks-граф)
  - [E12: Calendar/Alarms Fusion («Сегодня» — общий список)](#e12-calendaralarms-fusion-сегодня--общий-список)
  - [E13: Tasks & Time (PARA-first)](#e13-tasks--time-para-first)
  - [E14: Insights & Reports (ревью Areas, фокус-часы)](#e14-insights--reports-ревью-areas-фокус-часы)
  - [E15: User-configurable dashboard (user_settings)](#e15-user-configurable-dashboard-user_settings)
  - [E16: Habits](#e16-habits)
  - [E17: Frontend modernization](#e17-frontend-modernization)
  - [E17: Frontend Modernization](#e17-frontend-modernization)
- [MR-план](#mr-план)
- [Definition of Done](#definition-of-done)
- [Appendix: Notes from merge](#appendix-notes-from-merge)

## Roadmap & Milestones
- M1 Foundations — P0•L — базовая схема PARA, миграции, модели.
- M2 Capture — P0•M — быстрые заметки (бот/веб/API), Inbox.
- M3 Organize & Search — P0•M — присвоение контейнеров, бэклинки, поиск.
- M4 Automations — P1•L — правила, клиппер, интеграции.
- M5 Insights — P2•M — ревью Areas, отчёты по времени.
- M6 Habits — P0•M — модуль привычек (клон логики Habitica) с PARA-инвариантами.

## Решения по архитектуре (ПРОЧНО)
- **PARA-инвариант**: `project_id` OR `area_id` обязателен для каждого `CalendarItem`, `Task`, `TimeEntry`, `Habit`, `Daily`, `Reward`; всё без контейнера — в системную Area «Входящие».
- **Alarm** — часть `CalendarItem` (эквивалент `VALARM`).
- **Время**: UTC + `tzid`, поддержка `RRULE` без материализации бесконечных рядов.
- **Google Sync**: `syncToken`, `channels.watch` (`resource_id`, `channel_id`, `expiration`), `extendedProperties.private`.
- **Telegram**: уведомления по проектным каналам (`chat_id < 0`), правила `on_create`, `on_change_time`, `pre_due`, `digest_weekly`.
- **Tasks** наследует `area_id` проекта; дефолтная Area «Входящие» (per user/workspace, создаётся автоматически и не удаляется).
- **Habits**: у `Habit/Daily/Reward` обязателен `area_id`; при наличии `project_id` — `area_id` наследуется от проекта. Dailies интегрируются в календарь **виртуально** (agenda/ICS), без дублирования данных.
- **RPG-экономика**: `XP/Gold/HP/Level/KP` — отдельное состояние пользователя (простые формулы; идемпотентный cron по локальной дате пользователя).
- **Subjective overrides**: `para_overrides(owner, entity_type, entity_id, override_project_id?, override_area_id?)`.
- **Таймер**: один активный на пользователя (`UNIQUE` индекс `WHERE stopped_at IS NULL`).

## Эпики

### E1: PARA-first доменная модель (Areas/Projects/CalendarItem/Alarm)
**User Stories**
1. Как пользователь, я создаю **Area** «Маркетинг» и привязываю к ней **Projects**, чтобы группировать работу по PARA.
2. Как пользователь, я добавляю `CalendarItem` «Release v2` со временем начала/окончания и `Alarm`.
3. Как пользователь, я связываю каждый `CalendarItem` с Project или Area, чтобы не терять контекст.

**Tasks**
- P0•S — Модели: enums `ContainerType/ProjectStatus/ActivityType/TimeSource`; поля `archived_at`.
- P0•S — Сервисы: `ParaService` (CRUD Areas/Projects/Resources, assign_note, archive).
- P0•S — Обновить `TaskService/TimeService` (наследование Area/Project).

**Acceptance Criteria**
- Создание Project с `area_id=1` и именем «Landing» успешно и отображается в Area «Маркетинг».
- Создание элемента «Release v2» со стартом `2025-05-01T09:00Z` и `alarm=15m` планирует уведомление за 15 минут.
- Попытка сохранить элемент без `project_id` и `area_id` отклоняется ошибкой инварианта PARA.

#### E1a: Иерархические Areas
- P0•M — Миграция `20250830_01_areas_tree`: `areas.parent_id`, `mp_path TEXT NOT NULL DEFAULT ''`, `depth INT NOT NULL DEFAULT 0`, `slug TEXT NOT NULL`, индексы: `UNIQUE(owner_id, slug)`, `areas_mp_path_like ON areas(mp_path text_pattern_ops)`; бэкфилл: `slugify(name)`, `mp_path=slug||'.'`, `depth=0`, `parent_id=NULL`.
- P0•S — Миграция `20250830_02_projects_require_leaf_area`: у проектов гарантировать `area_id` (создать `Default Area` на владельца при NULL), листовость проверять на уровне сервиса.
- P0•S — Миграция `20250830_03_tasks_time_inherit_area`: индексы на `tasks`/`time_entries` (owner+area/project, started_at).
- P0•M — Сервис `AreaService`: `create_area(owner_id, name, parent_id?)`, `move_area(area_id, new_parent_id)`, `is_leaf(area_id)`, `list_subtree(area_id)`, `mp_path(area_id)`.
- P0•M — Валидации: при создании/редактировании `Project`/`Task` — `area_id` должен быть листом (если нет `project_id`).
- P0•S — API: `GET /api/v1/tasks|/api/v1/projects|/api/v1/time|/api/v1/notes` принимают `include_sub=0|1` (+ `area_id`, `container_type=area`), фильтрация по поддереву через `mp_path LIKE prefix%`.
- P0•S — API: `/api/v1/areas/{id}/move`, `/api/v1/areas/{id}/rename`, `/api/v1/areas/{id}/archive` (soft delete).
- P1•S — UI: иерархический `<select>` с отступом; чекбокс «Включая подкатегории» в фильтрах.
- P1•S — Админка Areas: создание/переименование/перемещение/архивирование.
- P0•S — Тесты: `AreaService` (create/move/list_subtree), валидации Project/Task, наследование TimeService, API `include_sub` на `/api/v1/tasks`.

**Acceptance Criteria**
- Можно создать дерево «Здоровье → Фитнес → Силовые», «Здоровье → Сон».
- Проект нельзя привязать к «Здоровье» (родитель), но можно к «Силовые» (лист).
- Фильтр задач/времени по «Здоровью» с `include_sub=1` показывает элементы из обеих веток.
- Перемещение «Фитнес» под другой корень обновляет `mp_path/depth` у всех детей.
- UI объясняет, что такое Area, и позволяет выбирать листья.

### E2: Миграции БД и индексы
**User Stories**
1. Как разработчик, я запускаю Alembic-модели для таблиц: `areas`, `projects`, `calendar_items`, `alarms`.
2. Как разработчик, я реализую CHECK-инвариант PARA и необходимые индексы.

**Tasks**
- P0•M — Alembic: `20250829_02_notes_para_columns` (title, TEXT, container_type/id, archived_at, индексы).
- P0•M — Alembic: `20250829_03_projects_area_status_archive` (area_id NOT NULL, status, slug uniq, archived_at, индексы).
- P0•S — Alembic: `20250829_04_areas_resource_archive` (review_interval_days, is_active, archived_at).
- P0•M — Alembic: `20250829_05_tasks_links_area` (project_id, area_id, estimate_minutes, индексы).
- P0•M — Alembic: `20250829_06_time_entries_inheritance` (project_id, area_id, activity_type, billable, source, индексы).
- P0•S — Машиночитаемая схема БД и автопроверка (`tools/schema_export`, CI).

**Acceptance Criteria**
- `python -m core.db.migrate` создаёт таблицы с внешними ключами и индексами по `(project_id, area_id, start_ts)`.
- Вставка `calendar_item` с обоими NULL (`project_id` и `area_id`) завершается ошибкой CHECK.
- Миграции применяются; в таблицах `notes/projects/areas/resources/tasks/time_entries` присутствуют новые поля и индексы.

### E3: API (Calendar: /calendar/items, /calendar/agenda, /calendar/feed.ics, /projects/{id}/notifications)
**User Stories**
1. Как пользователь, я получаю список и создаю элементы через `/calendar/items`.
2. Как пользователь, я просматриваю повестку по диапазону через `/calendar/agenda`.
3. Как пользователь, я подписываюсь на ICS через `/calendar/feed.ics`.
4. Как участник проекта, я вижу настройки уведомлений на `/projects/{id}/notifications`.
5. Как пользователь, я управляю Areas/Projects/Resources через `/api/v1/areas|projects|resources` и соответствующий UI.
6. Как пользователь, я присваиваю заметку контейнеру через `POST /api/v1/notes/{id}/assign`.

**Acceptance Criteria**
- `POST /calendar/items` с валидным JSON возвращает созданный объект с `id`.
- `GET /calendar/agenda?from=2025-05-01&to=2025-05-07` отдаёт элементы в диапазонe.
- Открытие `/calendar/feed.ics` во внешнем календаре показывает VEVENT с VALARM.
- `GET /projects/42/notifications` отдаёт список каналов.
- `GET/POST /api/v1/areas|projects|resources` создаёт и возвращает сущности.
- `POST /api/v1/notes/{id}/assign` переносит заметку и убирает её из Inbox.
- P1•M — Авто-предложение проекта по контексту (минимум: последний использованный).
- P1•S — Правила архивации (stale → Archive).

### E4: Синхронизация с Google Calendar
**User Stories**
1. Как пользователь, я подключаю Google через OAuth и импортирую события при начальной синхронизации.
2. Как пользователь, я делаю инкрементальную синхронизацию по `syncToken`.
3. Как разработчик, я обрабатываю push-уведомления через `channels.watch`.
4. Как разработчик, я храню `extendedProperties.private`.

**Acceptance Criteria**
- OAuth сохраняет `refresh_token`, первая синхронизация подтягивает события.
- Использование сохранённого `syncToken` возвращает только изменённые события.
- Push `POST` с известным `resource_id` инициирует повторную синхронизацию.
- `extendedProperties.private` содержит `{app_item_id:123, app_kind:'calendar', app_project_id:7, checksum:'abc'}`.

### E5: Telegram-уведомления
**User Stories**
1. Как админ проекта, я регистрирую групповой чат (`chat_id < 0`) для уведомлений.
2. Как участник, я получаю сообщение при создании элемента (`on_create`).
3. Как участник, я получаю напоминание до дедлайна (`pre_due`) и еженедельный дайджест.

**Acceptance Criteria**
- `POST /projects/42/notifications` с `chat_id=-1001` привязывает канал.
- Создание элемента отправляет в Telegram `sendMessage` в канал.
- Элемент со стартом `2025-05-01T09:00Z` и `pre_due=30m` шлёт сообщение в `08:30Z`.

### E6: ICS-фиды
**User Stories**
1. Как пользователь, я экспортирую элементы и задачи в стандартный ICS.
2. Как пользователь, я вижу `VALARM` для элементов с напоминанием.

**Acceptance Criteria**
- Скачанный фид содержит VEVENT для событий и VTODO для задач.
- Каждое событие с напоминанием включает компонент VALARM.

### E7: Роли и режимы (single/multiplayer)
**User Stories**
1. Как индивидуальный пользователь, я работаю в режиме **single**.
2. Как команда, мы переключаемся в режим **multiplayer** для общих Projects.

**Acceptance Criteria**
- Пользователь без команды видит только личные данные в single-режиме.
- В multiplayer-режиме участники проекта могут видеть и редактировать общие элементы.

### E8: Совместимость с /Alarms
**User Stories**
1. Как пользователь, я вижу старые напоминания в новом календаре.
2. Как разработчик, я мигрирую «сиротские» напоминания в `CalendarItem+Alarm`.

**Acceptance Criteria**
- Переход на `/reminders` отображает новый календарный UI.
- Скрипт миграции преобразует напоминание с `due=2024-12-31` в `calendar_item` с `alarm`.

### E9: Тесты и документация, фичефлаг
**User Stories**
1. Как разработчик, я включаю модуль через фичефлаг.
2. Как разработчик, я имею тесты и документацию для поддержки качества.

**Acceptance Criteria**
- `.env.example` содержит `CALENDAR_V2_ENABLED=true`, `HABITS_V1_ENABLED=true`, `HABITS_RPG_ENABLED=true`.
- CI запускает тесты на синхронизацию, API и уведомления.

### E10: Capture (бот/веб, Inbox)
**User Stories**
1. Как пользователь, я создаю быструю заметку из чата бота `/note` и она попадает в Inbox.
2. Как пользователь, я использую кнопку «Быстрая заметка» на веб-UI.
3. Как пользователь, я сохраняю ссылку через веб-клиппер.
4. Как пользователь, я просматриваю Inbox через `/api/v1/inbox/notes` или страницу `/inbox`.

**Acceptance Criteria**
- `/note` в боте создаёт заметку без контейнера.
- Кнопка на UI создаёт заметку и отображает её в Inbox.
- `GET /api/v1/inbox/notes` возвращает все входящие и неархивные заметки.
- `POST /api/v1/notes/{id}/assign {container_type, container_id}` переносит заметку в Project/Area/Resource.
- P2•S — Веб-клиппер через bookmarklet.
- Страница `/notes` отображает цветные карточки одного размера (цвет из области) в стиле Google Keep с чипами Areas/Projects, всплывающим просмотром полной заметки и расширяемой формой добавления с закреплением.
- P2•S — Прокрасить все сущности системы по `areas.color` (использовать `getAreaColor`).
- P2•M — Сделать `area_id` обязательным для `notes` и обеспечить backfill.
- Команда `/help` в боте выводит список доступных команд и их описание.

### E11: Search & Retrieval (поиск, бэклинки, wikilinks, граф)
**User Stories**
1. Как пользователь, я ищу заметки по заголовку и содержимому.
2. Как пользователь, я вижу бэклинки к заметке.
3. Как пользователь, я создаю wikilinks `[[...]]` и получаю граф связей.

**Acceptance Criteria**
- `GET /api/v1/notes/search?q=text` возвращает найденные заметки.
- `GET /api/v1/notes/{id}/backlinks` отдаёт минимальный контракт.
- Бэклинки из `[[...]]` создают записи `Link(reference)`.
- Граф ранжирует узлы по свежести и ссылочности.

### E12: Calendar/Alarms Fusion («Сегодня» — общий список)
**User Stories**
1. Как пользователь, я вижу единый список задач, напоминаний и событий на сегодня.

**Acceptance Criteria**
- Экран «Сегодня» агрегирует `CalendarItem`, `Task`, `Alarm`, а также due-ежедневки (виртуально).

### E13: Tasks & Time (PARA-first)
Единый модуль задач и времени. `Task = CalendarItem(kind='task')`; даты start/end/due и напоминания — через календарь.

**Модель/DDL**
- `tasks(id=calendar_items.id, project_id?, area_id?, status, priority, tags[]; CHECK(project_id OR area_id); триггер наследования area_id из projects)`
- `para_overrides` учитываются при определении `effective_area_id(viewer, entity)`.
- `time_entries(id, task_id, user_id, started_at, stopped_at, duration_sec STORED, note, source, billable; UNIQUE(active timer per user) WHERE stopped_at IS NULL)`

**API**
- `/tasks` CRUD (+ `/tasks/quick`)
- `/tasks/{id}/alarms` → прокси в `/calendar/items/{id}/alarms`
- `/time/start` (если нет `task_id` — создать задачу в «Входящие» и запустить таймер)
- `/time/stop`, `/time/edit`, `/time/entries`, `/time/summary?group_by=(day|project|area|user)`
- `/calendar/agenda?include_tasks=bool&only_scheduled=bool`

**Бизнес-правила**
- Статусная машина: `open → in_progress (на старте таймера) → done`; `blocked/archived`.
- Дедлайны/повторы/напоминания — только через календарный модуль.
- Один активный таймер на пользователя; авто-стоп по правилам.

**Миграции/совместимость**
- Конвертировать старые `/time` в `time_entries`, «висячие» логи — в задачи «Входящие».
- Мягкий редирект старых `/tasks` и `/time` на новые.

**Acceptance Criteria**
- [ ] старт «голого» таймера создаёт задачу в «Входящие».
- [ ] задача требует `project_id` или `area_id`; при указании проекта наследует `area_id`.
- [ ] напоминания к задаче через `/calendar/items/{id}/alarms`.
- [ ] флажок календаря `include_tasks/only_scheduled` работает.
- [x] `/time/summary` даёт срезы по `project/area/day/user`.
- [ ] не более одного активного таймера на пользователя.

### E14: Insights & Reports (ревью Areas, фокус-часы)
**User Stories**
1. Как пользователь, я вижу виджет «Areas due for review».
2. Как пользователь, я анализирую фокус-часы по Areas/Projects.
3. Как пользователь, я просматриваю связность графа.

**Acceptance Criteria**
- Виджет «Areas due for review» учитывает `review_interval_days`.
- Отчёт по фокус-часам агрегирует `TimeEntry` по Project/Area.
- Отчёт по графу показывает коэффициент связности.

### E15: User-configurable dashboard (user_settings)
**Acceptance Criteria**
- Настройки пользователя хранятся в таблице `user_settings` (ключ/значение JSONB).
- Избранное перенесено в `user_settings(key='favorites')` и доступно через меню.
- Раскладка дашборда сохраняется в `user_settings(key='dashboard_layout')`.
- API `/api/v1/user/settings` позволяет читать и обновлять отдельные ключи.
- UI страница `/settings` позволяет включать и скрывать виджеты дашборда.
- На странице `/settings` можно включать или отключать пункты избранного меню с учётом роли пользователя.

### E16: Habits
**User Stories**
1. Как пользователь, я отмечаю «плюс/минус» по привычкам и получаю мгновенную награду (XP/Gold), штраф по HP — за «минус».
2. Как пользователь, я веду **Ежедневные** по `RRULE` (например, Пн–Пт) с сериями и «заморозкой».
3. Как пользователь, я вижу **Награды** и трачу заработанное золото.
4. Как пользователь, я фильтрую всё по **Area/Project**; привычка, добавленная в проект, наследует его область.
5. Как пользователь, я вижу мини-HUD `HP/XP/Level/Gold/KP` и суммарную карму (KP).
6. Как пользователь, я отмечаю привычки/ежедневки из Telegram-бота.

**Модель/DDL (суть)**
- `habits(id, owner_id, area_id NOT NULL, project_id?, title, note, type{'positive'|'negative'|'both'}, difficulty{'trivial'|'easy'|'medium'|'hard'}, up_enabled, down_enabled, val FLOAT, tags[], archived_at, created_at)`
- `habit_logs(id, habit_id, owner_id, at, delta {-1|+1}, reward_xp, reward_gold, penalty_hp)`
- `dailies(id, owner_id, area_id NOT NULL, project_id?, title, note, rrule TEXT, difficulty, streak, frozen, archived_at, created_at)`
- `daily_logs(id, daily_id, owner_id, date, done BOOL, reward_xp, reward_gold, penalty_hp, UNIQUE(daily_id, date))`
- `rewards(id, owner_id, title, cost_gold, area_id NOT NULL, project_id?, archived_at, created_at)`
- `user_stats(owner_id PK, level, xp, gold, hp, kp, last_cron DATE)`

**API**
```
GET  /api/v1/habits/stats
POST /api/v1/habits/cron/run

GET  /api/v1/habits?area_id=&project_id=&include_sub=0|1
POST /api/v1/habits
PUT  /api/v1/habits/{id}
DEL  /api/v1/habits/{id}
POST /api/v1/habits/{id}/up
POST /api/v1/habits/{id}/down

GET  /api/v1/dailies?area_id=&project_id=
POST /api/v1/dailies
PUT  /api/v1/dailies/{id}
POST /api/v1/dailies/{id}/done   {date?}
POST /api/v1/dailies/{id}/undo   {date?}

GET  /api/v1/rewards?area_id=&project_id=
POST /api/v1/rewards
POST /api/v1/rewards/{id}/buy
```

**Экономика (дефолт, конфигурируемо)**
- `XP_BASE: trivial=3, easy=10, medium=15, hard=25`
- `GOLD_BASE: trivial=1, easy=3, medium=5, hard=8`
- `HP_BASE: trivial=1, easy=5, medium=8, hard=12`
- Затухание наград привычки: `reward_factor = exp(-k*max(0,val))` при «плюсе», усиление штрафа — при «минусе»; `val` сдвигается на `±0.1`.
- Level-up: `LEVEL_XP(lvl) = 100 + (lvl-1)*50`; `hp` подхиливается при апе.
- `KP` — накапливаемая сумма положительных XP (не обнуляется).

**Cron (идемпотентный)**
- На первом запросе дня или в фоновом джобе: проставляет `done=false` для due-ежедневок без отметки и применяет штрафы; `user_stats.last_cron = today_local`.

**Интеграция с календарём**
- `/calendar/agenda?include_habits=1` — добавляет **виртуальные** due-ежедневки (без записи в `calendar_items`).
- ICS-фид — `VTODO` с `RRULE` для ежедневок (read-only).

**UI `/habits`**
- Четыре колонки: Привычки / Ежедневные / Задачи (из `/tasks`) / Награды.
- Фильтры: Area (иерархический), Project, «Включая подкатегории».
- Мини-HUD: `HP/XP/Level/Gold/KP`; горячие клавиши `+`, `-`, `Space`.

**Бот**
- `/habit + <название>` — клик «плюс» по ближайшему совпадению; ответ: `+XP/+Gold, HP: x/y`.
- `/daily done <фраза|ID>` — отметка «сегодня выполнено».
- Недельный дайджест в проект: топ-стрики, топ-KP.

**Acceptance Criteria**
- Создание привычки без `area_id` отклоняется; при `project_id` — `area_id` наследуется от проекта.
- Клик «+» увеличивает XP/Gold, меняет `val`; «−» снижает HP согласно сложности.
- Cron единожды штрафует пропуски за текущую локальную дату пользователя.
- `/calendar/agenda?include_habits=1` возвращает due-ежедневки; ICS содержит `VTODO` с `RRULE`.
- `/rewards/{id}/buy` списывает Gold и возвращает баланс.
- В `/habits` действия мгновенно отражаются в HUD.


### E17: Frontend modernization
See [frontend_modernization.md](./frontend_modernization.md).

**Tasks**
- [ ] E17a: базовая настройка ESLint, Prettier, Vitest и Testing Library в `web/`.
### E17: Frontend Modernization
**User Stories**
1. Как разработчик, я хочу единый современный фронтенд‑стек, чтобы страницы собирались одним тулчейном.
2. Как пользователь, я хочу более быстрые и консистентные страницы после миграции.

**Tasks**
- P1•M — Исследовать и выбрать стек (Next.js или Vite), задокументировать решение.
- P1•S — Настроить TypeScript и Tailwind в выбранном фреймворке, подготовить базовый layout.
- P1•L — Поэтапно переносить страницы на новый стек (начать с `/inbox`), добавлять тесты и запись в `docs/CHANGELOG.md`.
- P2•S — Удалять legacy‑шаблоны и скрипты после миграции, чистить `web/static` и пути в конфиге Tailwind.

**Acceptance Criteria**
- В репозитории зафиксировано решение (Next.js или Vite), `npm run dev` стартует без ошибок.
- TypeScript и Tailwind собираются, базовый layout рендерится через новый стек.
- Страница `/inbox` работает на новом стеке, покрыта тестами и отражена в `docs/CHANGELOG.md`.
- Удалены шаблоны и статические файлы для перенесённых страниц, конфиг Tailwind смотрит на актуальные пути, `npm run build` проходит.

## MR-план
1. MR-1 Foundations (миграции/модели) — DoD: миграции применяются; приложение поднимается; тесты не падают.
2. MR-2 Services (ядро PARA) — DoD: assign/move/archive работают; корректная наследственность Area/Project в задачах и тайм-логах.
3. MR-3 API (контракты) — DoD: `GET/POST /api/v1/areas|projects|resources`, `/api/v1/inbox/notes`, `POST /api/v1/notes/{id}/assign`, `GET /api/v1/notes/{id}/backlinks`, `GET /api/v1/tasks?area_id=&project_id=`, `GET /api/v1/time/running`, `POST /api/v1/time/{id}/assign_task`.
4. MR-4 UI (каркас) — DoD: страницы `/inbox`, `/areas`, `/projects`, `/resources` открываются; базовый список/форма создаёт сущности и показывает данные.
5. MR-5 Bot (захват/присвоение) — DoD: `/note` создаёт заметку; `/assign` присваивает контейнер.
6. MR-6 Search (wikilinks/backlinks) — DoD: при сохранении заметки с `[[...]]` появляются `backlinks`.
7. MR-7 Reports — DoD: сервис `ReviewService` + виджет «Areas due for review»; `GET /api/v1/areas/{id}/review_due` и счётчик на дашборде.
8. **MR-8 Habits Foundations** — DDL (`habits/*`, `user_stats`), сервисы, фичефлаги `HABITS_V1_ENABLED`, `HABITS_RPG_ENABLED`, базовые тесты.
9. **MR-9 Habits API+UI** — `/api/v1/habits|dailies|rewards`, страница `/habits` (4 колонки), HUD, интеграция с `/tasks`.
10. **MR-10 Habits Calendar & Bot** — виртуальные daily в `/calendar/agenda` и ICS, команды бота, недельный дайджест, анти-фарм (мягкие лимиты).

## Definition of Done
- Inbox работает: входящие заметки видны в `/inbox` и через `GET /api/v1/inbox/notes`.
- `POST /api/v1/notes/{id}/assign` переносит заметку в Project/Area/Resource (исчезает из Inbox).
- Project требует `area_id`; Task с `project_id` автоматически наследует `area_id`.
- Тайм-лог из задачи автоматически содержит `project_id/area_id`.
- UI: `/areas`, `/projects`, `/resources`, `/inbox` доступны.
- Бот: `/note` и `/assign` работают.
- Habits: CRUD/клики/cron/награды работают; `/habits` отражает изменения в HUD; due-ежедневки видны в agenda/ICS.

## Appendix: Notes from merge
- Починена вёрстка меню избранного и отображение звёздочки на страницах.
- Виджеты дашборда скрываются согласно пользовательским настройкам, список избранного расширен и включён по умолчанию.
- Добавлены фичефлаги `HABITS_V1_ENABLED`, `HABITS_RPG_ENABLED`; дефолтные коэффициенты экономики вынесены в конфиг.
- Dailies интегрированы в календарный стек через «виртуальные» элементы (agenda/ICS), не нарушая принцип «один источник истины».

### notes
- notes: Realtime-совместная правка (OT/CRDT/locking).
- notes: История версий заметки.
- notes: Full-text search по title/content.
- notes: Страница «Архив» с батч-разархивом.
- notes: Массовые операции (bulk pin/unpin, recolor).
- notes: Горячие клавиши.
- notes: DnD-анимации/инерция (необязательно).
- notes: Drag-and-drop сортировка карточек на странице `/notes` с сохранением порядка через `POST /api/v1/notes/reorder`.
- notes: Поповер-селекторы для смены области/проекта и выбор цвета карточки.
