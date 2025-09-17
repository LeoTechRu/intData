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
1. Как разработчик, я поддерживаю идемпотентные DDL-модули для таблиц: `areas`, `projects`, `calendar_items`, `alarms`, `notes`, `time_entries`, `habits/*`.
2. Как разработчик, я обеспечиваю CHECK‑инвариант PARA и необходимые индексы.

**Tasks**
- [x] P0•S — Машиночитаемая схема БД и автопроверка (`python -m core.db.schema_export`, CI‑check).
- [x] P0•M — Перевод миграций на простой раннер `core/db/migrate.py` + DDL `core/db/ddl/*.sql` (без Alembic).
- [x] P0•S — `projects.area_id` сделать `NOT NULL` и проиндексировать.
- [ ] P0•M — CHECK‑инвариант: у сущностей (`calendar_items`, `tasks`, `time_entries`, `habits/dailies/rewards`) должен быть ровно один из `project_id`/`area_id`.
- [ ] P0•S — Индексы `(owner_id, project_id)` и `(owner_id, area_id)` на основные таблицы для фильтрации и include_sub.
- [ ] P0•M — Подготовить baseline (pg_dump) и инициализировать Alembic, зафиксировать стартовую ревизию.
- [ ] P0•L — Вынести диагностические таблицы/колонки в Alembic и описать сценарий отката.
- [ ] P0•L — Решить стратегию идентификаторов (INTEGER ↔ UUID) и подготовить детальный план миграции.
- [ ] P1•M — Триггеры наследования `area_id` от `project_id` для `tasks` и `resources`.
- [ ] P2•S — Таблица `para_overrides` для субъективных привязок (owner, entity_type, entity_id, override_project_id?, override_area_id?).
- [ ] P2•S — Линтер `utils/para_lint.py` и запуск в CI.

**Acceptance Criteria**
- `python -m core.db.migrate` создаёт таблицы с внешними ключами и индексами по `(project_id, area_id, start_ts)`.
- Вставка `calendar_item` с обоими NULL (`project_id` и `area_id`) завершается ошибкой CHECK.
- В таблицах `notes/projects/areas/resources/tasks/time_entries` присутствуют требуемые поля и индексы, инварианты PARA соблюдаются.

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

**Tasks**
- [x] P0•S — Восстановить кнопку входа через Telegram на странице авторизации.
- [x] P0•S — Скрывать кнопку входа через Telegram при `TG_LOGIN_ENABLED=0`.

**Acceptance Criteria**
- `POST /projects/42/notifications` с `chat_id=-1001` привязывает канал.
- Создание элемента отправляет в Telegram `sendMessage` в канал.
- Элемент со стартом `2025-05-01T09:00Z` и `pre_due=30m` шлёт сообщение в `08:30Z`.

#### E5b: Управление Telegram-группами как CRM
**User Stories**
1. Как администратор обучения, я подключаю учебную группу к CRM, чтобы видеть статистику активности участников и быстро находить «тихих» слушателей.
2. Как менеджер продаж, я отмечаю в карточке участника, какие продукты он приобрёл, чтобы отслеживать статус оплаты.
3. Как куратор чата, я фильтрую и массово удаляю из группы пользователей, которые не купили нужный продукт к концу пробного периода.

**Tasks**
- [ ] P0•M — Сохранять статистику активности (сообщения, реакции) для участников групп и выводить лидборд за настраиваемый период.
- [ ] P0•M — Добавить сущности «Product» и «UserProduct» с указанием источника покупки и даты, редактируемые через бот и веб.
- [ ] P0•S — Реализовать `/group audit` в боте: список участников с оплатами, фильтры «нет покупки» и кнопка выгрузки в `/web`.
- [ ] P0•S — На веб-странице «Группы» показать статистику, карточку участника (статусы продуктов) и действие «Удалить из Telegram» с подтверждением.
- [ ] P0•S — Обеспечить массовое удаление по фильтру «не купили продукт X» и журнал действий (кто/когда удалил).
- [x] P0•S — Разделить сервисы CRM (продукты) и модерации групп, чтобы CRM работала независимо от интеграции с группами.
- [x] P0•S — Добавить сводку модерации групп (активность, тихие, оплаты) в ЦУП и админский сектор.

**Acceptance Criteria**
- `/group audit` в административной группе выводит топ-5 активных участников и количество сообщений за выбранный период.
- API `/api/v1/groups/{id}` возвращает участников, покупки и агрегированную активность.
- На странице `/groups/{id}` можно выбрать продукт и запустить удаление всех, кто не числится в покупателях; бот подтверждает удаление в чате.
- Для каждого удаления фиксируется запись журнала с телеграм-ID, продуктом и временем операции.

### E6: ICS-фиды
**User Stories**
1. Как пользователь, я экспортирую элементы и задачи в стандартный ICS.
2. Как пользователь, я вижу `VALARM` для элементов с напоминанием.

**Tasks**
- [ ] P0•S — Генерировать `VALARM` в `feed.ics` на основе связанных `alarms`.

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

#### E7a: Гибкая авторизация и роли
**User Stories**
1. Как владелец рабочей области, я настраиваю роли с заранее заданными правами, чтобы быстро подключать новых участников.
2. Как администратор, я назначаю права по областям и проектам, чтобы ограничить доступ к чувствительным данным (минимально необходимыми привилегиями).
3. Как архитектор платформы, я расширяю справочник прав без миграций по коду, чтобы поддерживать новые модули.

**Acceptance Criteria**
- В системе есть неизменяемая роль `admin` с полным доступом ко всем функциональностям.
- Роли описываются битовой маской прав (`BIGINT`), справочник прав задаёт уникальные коды и позиции (64 бита, расширяемо).
- При назначении роли можно указать `scope` (`global` | `area` | `project`), фактические права вычисляются с учётом наследования областей/проектов.
- Проверки доступа на веб/API используют `core.authz` сервис с методом `require(permission, scope)`; прямые обращения к `UserRole` в HTTP-слое устранены.
- Справочник и пресеты ролей (single, multiplayer, moderator, admin) инициализируются через `core/db/ddl` и могут обновляться через `core/services/access_control.seed_presets()`.
- Все операции назначения/снятия прав логируются в `core/services/audit_log` (минимум: кто, кого, какие права, когда).

**Tasks**
- [ ] P0•M — Спроектировать словарь прав (`auth_permissions`), назначить битовые позиции и описания (CRUD, настройка интеграций, управление участниками, просмотр аналитики, управление финансами, системный доступ).
- [ ] P0•L — Реализовать `core/services/access_control.py` с API: `grant_role`, `revoke_role`, `list_effective_permissions(user, scope)` и кешированием.
- [ ] P0•M — Добавить поддержку `scope_type`+`scope_id` в таблице назначений ролей, обеспечить наследование `project -> area -> global` (учесть PARA-инварианты).
- [ ] P0•S — Заменить `web/dependencies.role_required` на проверки через новый сервис и разрешить проверку как по ролям, так и по отдельному праву.
- [ ] P0•S — Покрыть unit-тестами расчёт масок и наследование прав (`tests/core/auth/test_access_control.py`).
- [ ] P0•S — Обновить `/docs/CHANGELOG.md` и `/api/openapi.json` после внедрения новых эндпоинтов/ответов.
- [ ] P1•M — Добавить UI-редактор ролей (CRUD пресетов, назначение участникам) с отдельным разрешением `permissions.manage_roles`.

#### E7b: Каталоги профилей (Users/Groups/Projects/Areas/Resources/Products)
**User Stories**
1. Как участник рабочей области, я просматриваю каталог людей и могу быстро перейти в профиль коллеги, если имею разрешение.
2. Как пользователь, я управляю видимостью своего профиля (для конкретных людей, групп, проектов или публично) и контролирую, какие секции видят разные аудитории.
3. Как владелец группы или проекта, я публикую страницу профиля с описанием, метриками и ссылками, чтобы делиться контекстом с разрешёнными участниками.
4. Как куратор Areas, я предоставляю карточку области с ключевыми инициативами и контактами для заинтересованных участников.

**Tasks**
- [ ] P0•L — Создать унифицированную модель `entity_profiles` + `entity_profile_grants` с поддержкой типов (`user`, `group`, `project`, `area`, `resource`, `product`) и аудитории (`public`, `authenticated`, `user`, `group`, `project`).
- [ ] P0•M — Реализовать сервис профилей (`core/services/profile_service.py`) с CRUD, вычислением доступности, кешированием и аудитом изменений.
- [ ] P0•S — Обновить веб-роуты: перенести `/profile` → `/users`, добавить каталог пользователей с фильтрами и карточками, страницы `/users/{slug}` с табами «Обзор», «Активность», «Связи».
- [ ] P0•S — Добавить UI профиля для групп `/groups/{slug}`, проектов `/projects/{slug}`, ресурсов `/resources/{slug}` и продуктов `/products/{slug}`, отразить статусы приватности и CTA «Запросить доступ».
- [ ] P0•S — Реализовать каталоги Areas `/areas` и профиль `/areas/{slug}` с кратким описанием, метриками и привязками к проектам/группам.
- [ ] P0•S — Обновить API `/api/v1/*` для выдачи профиля и каталога с учётом прав доступа; включить флаги видимости и аудитории.
- [ ] P0•S — Обеспечить управление разрешениями на профили через веб-форму (выбор аудиторий, выдача грантов конкретным пользователям/группам/проектам) и соответствующие API.
- [ ] P0•S — Добавить тесты `tests/web/test_profiles_catalog.py`, `tests/core/test_profile_service.py`, покрывающие приватность, каталоги и выдачу доступа.

**Acceptance Criteria**
- `/users` отображает каталог доступных профилей (листинг карточек) с пагинацией и фильтрами по Areas/проектам.
- `/users/{username}` возвращает 200 только если текущий пользователь (или группа/проект, к которому он принадлежит) фигурирует в `entity_profile_grants`, иначе 403.
- `/groups/{slug}` , `/projects/{slug}` и `/resources/{slug}` отдают профиль, соответствующий настройкам видимости, включая секцию «Контакты» и метрики (участники/прогресс).
- `/areas/{slug}` отображает карточку области с ключевыми проектами и владельцем; при отсутствии разрешения — CTA «Запросить доступ»; `/products/{slug}` отображает карточку продукта с атрибутами CRM.`
- API `/api/v1/profiles/{entity_type}/{slug}` возвращает JSON с секциями профиля, а список `/api/v1/profiles/{entity_type}` фильтрует по доступности и принимает query `audience=me|group|project`.

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

**Tasks**
- P0•S — Загружать переменные окружения из `ENV_FILE` (по умолчанию `${PROJECT_DIR}/.env`).

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
- [x] старт «голого» таймера создаёт задачу в «Входящие».
- [x] задача требует `project_id` или `area_id`; при указании проекта наследует `area_id`.
- [ ] напоминания к задаче через `/calendar/items/{id}/alarms`.
- [ ] флажок календаря `include_tasks/only_scheduled` работает.
- [x] `/time/summary` даёт срезы по `project/area/day/user`.
- [ ] не более одного активного таймера на пользователя.

#### E13a: Telegram Task Manager (бот)
**User Stories**
1. Как пользователь, я создаю и переименовываю задачи через бота, чтобы управлять списком дел без веб-интерфейса.
2. Как пользователь, я устанавливаю дедлайн и расписание напоминаний через бота и получаю уведомления в нужное время.
3. Как пользователь, я отмечаю задачу как контролируемую, чтобы получать регулярные напоминания до и после срока и явно фиксировать исход («выполнена» или «не будет выполнена»).
4. Как пользователь, я просматриваю статистику завершённых, актуальных и отклонённых задач по запросу, чтобы понимать прогресс.
5. Как пользователь, я добавляю наблюдателей к задаче, чтобы они получали уведомления и могли отказаться от наблюдения.

**Tasks**
- [x] P0•M — Расширить модель задач и DDL (`tasks`, `task_checkpoints` и др.) полями контроля: `control_enabled`, `control_frequency`, `control_status{'active','done','dropped'}`, `control_next_at`, `is_watched`, `refused_reason{'done','wont_do'}`, `remind_policy` и вынести расписание напоминаний в отдельную таблицу `task_reminders`.
- [x] P0•M — Добавить таблицу `task_watchers(task_id, watcher_id, added_by, state{'active','left'}, left_reason{'done','wont_do','manual'})` и API в `core/services/task_service` для управления наблюдателями.
- [x] P0•M — Реализовать в боте FSM-команды `/task_add`, `/task_rename`, `/task_due`, `/task_remind`, `/task_control`, `/task_forget` c подтверждением выбора причины «выполнена» или «не будет выполнена» при отказе от контроля.
- [x] P0•M — Настроить планировщик (cron/worker) на базе `project_notification_worker` для отправки напоминаний и уведомлений наблюдателям (добавление, выполнение, отмена), используя `core/services/telegram_bot`.
- [x] P0•S — Добавить команды `/task_stats`, `/task_stats_active`, `/task_stats_dropped` в боте и REST `GET /api/v1/tasks/stats` для подсчёта завершённых, актуальных, отказанных задач.
- [x] P0•S — Обновить `/start` справку и документацию бота, описав новые команды и сценарии контроля.

**Acceptance Criteria**
- Команды `/task_add` и `/task_rename` создают задачу и меняют название с подтверждением результата, изменения видны в `/tasks` и API.
- При настройке дедлайна и расписания командами бота создаются записи `task_reminders`, а бот отправляет уведомления в заданные времена.
- При включении контроля бот спрашивает периодичность напоминаний, фиксирует её в `control_frequency`, присылает повторные напоминания до/после срока и требует выбор исхода («выполнена» или «не будет выполнена») при отказе.
- Команда `/task_stats` возвращает количество `done`, `active` и `dropped` задач по пользователю; отдельные команды выдают соответствующие значения.
- При добавлении наблюдателя бот уведомляет его, при `done`/`won't_do` отправляет событие, а наблюдатель может отказаться командой `/task_unwatch`.
- `/start` отражает все новые команды и права доступа.

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
**Tasks**
- [x] P0•M — Ребрендинг главного экрана в «ЦУП» с расшифровкой «Центр Управления Полётами» и единым копирайтингом.
- [x] P0•M — Встроить админские утилиты в ЦУП (видны только роли admin) с отдельным подзаголовком и якорем для навигации из меню.
- [x] P0•M — Перенести управление Areas из `/areas` в `/settings` с иерархической панелью и доступом по ролям.
- [x] P0•S — Санитизировать избранные ссылки (удалить устаревший `/admin`, поддержать якорь `/settings#areas`).
**Acceptance Criteria**
- Настройки пользователя хранятся в таблице `user_settings` (ключ/значение JSONB).
- Избранное перенесено в `user_settings(key='favorites')` и доступно через меню.
- Раскладка дашборда сохраняется в `user_settings(key='dashboard_layout')`.
- ЦУП предоставляет режим настройки: виджеты можно перетаскивать и скрывать/возвращать, состояние синхронизировано с `dashboard_layout`.
- API `/api/v1/user/settings` позволяет читать и обновлять отдельные ключи.
- UI страница `/settings` позволяет включать и скрывать виджеты дашборда.
- На странице `/settings` можно включать или отключать пункты избранного меню с учётом роли пользователя.
- Админский сектор доступен внутри ЦУПа (iframe `/cup/admin-embed`), прямой маршрут `/admin` отсутствует.
- Страница `/settings` содержит персональные пресеты темы (режим, основной/акцентный цвет, градиент) с предпросмотром и админский блок глобальной темы, сохраняемый в `app_settings`.

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
-
**Tasks**
- [x] P0•S — /habits: страница доступна по веб-сессии, write-действия требуют TG (403 `tg_link_required`).
- [x] P0•S — Кулдаун привычки отображается как 429 с заголовком `Retry-After`.
- [x] P0•S — Снимок OpenAPI синхронизирован и описывает ошибки `tg_link_required` и `cooldown`.
- [x] P0•S — Тесты на доступ, TG-требование и кулдаун.

**Acceptance Criteria**
- Создание привычки без `area_id` отклоняется; при `project_id` — `area_id` наследуется от проекта.
- Клик «+» увеличивает XP/Gold, меняет `val`; «−» снижает HP согласно сложности.
- Cron единожды штрафует пропуски за текущую локальную дату пользователя.
- `/calendar/agenda?include_habits=1` возвращает due-ежедневки; ICS содержит `VTODO` с `RRULE`.
- `/rewards/{id}/buy` списывает Gold и возвращает баланс.
- В `/habits` действия мгновенно отражаются в HUD.
- [x] `/habits` доступен по веб-сессии; write без TG возвращают 403 `tg_link_required`.
- [x] Повторный `up` в кулдауне возвращает 429 с заголовком `Retry-After` и полем `retry_after`.
- [x] `api/openapi.json` совпадает с `/api/openapi.json` и содержит модели ошибок `tg_link_required` и `cooldown`.
- [x] pytest -q подтверждает сценарии доступа без TG и кулдауна.


### E17: Frontend Modernization
Reference: см. архивный отчёт `docs/archive/report_frontend_modernization.md`.

**Tasks**
- [x] P1•M — Выбран стек **Next.js** (TypeScript + Tailwind), решение задокументировано.
- [x] P1•S — Настроен базовый layout и провайдер React Query.
- [x] P1•L — Страница `/inbox` перенесена на новый стек и покрыта тестами.
- [x] P1•M — Внедрить UI-kit (кнопки, формы, карточки) с токенами темы для Next.js страниц.
- P2•S — Удалять legacy‑шаблоны и скрипты после миграции, чистить `web/static` и пути в конфиге Tailwind.
  - [x] `/habits` перенесена на Next.js; шаблон `templates/habits.html` и `static/js/habits_v1.js` удалены.
  - [ ] Очистить оставшиеся legacy-ассеты (calendar, notes) и обновить пути Tailwind.
- [x] P2•M — Внедрить AppShell-лейаут Next.js с дизайн-токенами, адаптивной навигацией и современными UI паттернами для перенесённых страниц.
- [x] P2•S — Страница `/habits` работает на Next.js, использует React Query и HUD с XP/Gold/KP.
- [ ] P2•M — Расширить `/habits` карточками Dailies/Rewards и фильтрами проектов после обновления API (связка с E16).
- [ ] P0•M — Перенести ЦУП (`/`) на Next.js «Обзор» с современными виджетами, drag'n'drop макетом и настройками из `user_settings.dashboard_layout`.
- [ ] P0•S — Вынести админский сектор в страницу «ЛК Админа» нового UI, доступную только роли `admin`, с полным набором действий.
- [ ] P1•S — Завершить аудит оставшихся legacy-шаблонов и зафиксировать план миграции после переноса ЦУП/админки.

**User Stories**
1. Как разработчик, я хочу единый современный фронтенд‑стек, чтобы страницы собирались одним тулчейном.
2. Как пользователь, я хочу более быстрые и консистентные страницы после миграции.

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
