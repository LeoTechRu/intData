# LeonidPro: Бэклог «Второй мозг / PARA»

Источник: [Исходная статья](../research/habr_nspk_second_brain.md)

Приоритеты: P0 критично / P1 важно / P2 желательно. Оценка: S/M/L.

## Релизы / Вехи
- M1 Foundations — базовая схема PARA, миграции, модели.
- M2 Capture — быстрые заметки (бот/веб/API), Inbox.
- M3 Organize & Search — присвоение контейнеров, бэклинки, поиск.
- M4 Automations — правила, клиппер, интеграции.
- M5 Insights — ревью Areas, отчёты по времени.

---

## Эпики

### 0) Foundations (PARA-схема, миграции/модели)
Описание: базовая схема PARA (Inbox/Areas/Projects/Resources/Archive) и наследование Area/Project в задачах и тайм‑логах.

- [ ] P0•M — Alembic: `20250829_02_notes_para_columns` (title, TEXT, container_type/id, archived_at, индексы)
- [ ] P0•M — Alembic: `20250829_03_projects_area_status_archive` (area_id NOT NULL, status, slug uniq, archived_at, индексы)
- [ ] P0•S — Alembic: `20250829_04_areas_resource_archive` (review_interval_days, is_active, archived_at)
- [ ] P0•M — Alembic: `20250829_05_tasks_links_area` (project_id, area_id, estimate_minutes, индексы)
- [ ] P0•M — Alembic: `20250829_06_time_entries_inheritance` (project_id, area_id, activity_type, billable, source, индексы)
- [ ] P0•S — Модели: enums `ContainerType/ProjectStatus/ActivityType/TimeSource`; поля archived_at
- [ ] P0•S — Сервисы: `ParaService` (CRUD Areas/Projects/Resources, assign_note, archive)
- [ ] P0•S — Обновить `TaskService/TimeService` (наследование Area/Project)

Критерии приёмки:
- Миграции применяются; тесты проходят; приложение поднимается.
- В таблицах `notes/projects/areas/resources/tasks/time_entries` присутствуют новые поля/индексы.

### 1) Capture (Сбор информации)
Описание: быстрый сбор из Telegram, веб‑форм; сохранение текста/ссылок.

- [ ] P0•M — Быстрая заметка из чата бота `/note` (Deps: Foundations)
- [ ] P0•S — Кнопка «Быстрая заметка» на UI (Deps: Foundations)
- [ ] P2•S — Веб‑клиппер через bookmarklet (Deps: M3)

### 2) Organize (PARA/Areas/Projects)
Описание: структура PARA; области (Areas), проекты (Projects), ресурсы (Resources), архив (Archive).

- [ ] P0•M — Коллекции API/UI: `/api/areas|/api/projects|/api/resources` и `/areas|/projects|/resources`
- [ ] P0•S — Inbox: `GET /api/inbox/notes` и `/inbox` (Container=NULL, неархивные)
- [ ] P0•S — `POST /api/notes/{id}/assign {container_type, container_id}`
- [ ] P1•M — Авто‑предложение проекта по контексту (минимум: «последний использованный»)
- [ ] P1•S — Правила архивации (stale → Archive)

### 3) Search & Retrieval (Поиск и извлечение)
Описание: поиск, бэклинки, граф связей.

- [ ] P0•M — Поиск по title/content (минимум)
- [ ] P0•S — `GET /api/notes/{id}/backlinks` (минимальный контракт)
- [ ] P1•M — Бэклинки из wikilinks `[[...]]` (парсер + записи Link(reference))
- [ ] P1•L — Граф связей; ранжирование по свежести/ссылочности

### 4) Calendar/Reminders Fusion (Календарь и напоминания)
- [ ] P0•M — «Сегодня»: задачи + напоминания + события (общий список)

### 5) Tasks Bridge (Мост задач)
- [ ] P0•S — Фильтры задач: `GET /api/tasks?area_id=&project_id=`
- [ ] P0•M — Старт/стоп таймера по задаче; наследование Area/Project в time_entries

### 6) Insights & Reports (Отчёты)
- [ ] P1•M — Виджет «Areas due for review» (review_interval_days)
- [ ] P2•M — Фокус‑часы по Areas/Projects
- [ ] P2•M — Связность графа

---

## MR‑план

1) MR‑1 Foundations (миграции/модели)
- Файлы: `migrations/versions/20250829_02..06`, `core/models.py`
- DoD: миграции применяются; приложение поднимается; тесты не падают.

2) MR‑2 Services (ядро PARA)
- Файлы: `core/services/para_service.py`, обновления `note_service.py`, `task_service.py`, `time_service.py`
- DoD: assign/move/archive работают; корректная наследственность Area/Project в задачах и тайм‑логах.

3) MR‑3 API (контракты)
- Файлы: `web/routes/{areas,projects,resources,inbox}.py`, дополнения `notes.py`, `time_entries.py`, `tasks.py`
- DoD:
  - `GET/POST /api/areas|/api/projects|/api/resources`
  - `GET /api/inbox/notes`
  - `POST /api/notes/{id}/assign`
  - `GET /api/notes/{id}/backlinks`
  - `GET /api/tasks?area_id=&project_id=`
  - `GET /api/time/running`, `POST /api/time/{id}/assign_task`

4) MR‑4 UI (каркас)
- Файлы: `web/templates/{inbox,areas,projects,resources}.html`, роуты UI
- DoD: страницы открываются, базовый список/форма создаёт сущности и показывает данные.

5) MR‑5 Бот (захват/присвоение)
- Файлы: `bot/handlers/note.py`, подключение в `bot/main.py`
- DoD: `/note` создаёт заметку; `/assign` присваивает контейнер.

6) MR‑6 Поиск/бэклинки
- Реализовать парсер wikilinks и создание `Link(reference)`; UI‑блок «Связано с…»
- DoD: при сохранении заметки с `[[...]]` появляются `backlinks`.

7) MR‑7 Отчёты/ревью
- Сервис `ReviewService` + виджет «Areas due for review»
- DoD: `GET /api/areas/{id}/review_due` и счётчик на дашборде.

---

## Definition of Done (минимальный PoC)
- Inbox работает: нераспределённые заметки видны в `/inbox` и через `GET /api/inbox/notes`.
- `POST /api/notes/{id}/assign` переносит заметку в Project/Area/Resource (исчезает из Inbox).
- Project требует `area_id`; Task с `project_id` автоматически синхронизирует `area_id`.
- Тайм‑лог из задачи автоматически содержит `project_id/area_id`.
- UI: `/areas`, `/projects`, `/resources`, `/inbox` доступны (навигация добавится отдельно).
- Бот: `/note` и `/assign` работают.


---

## Эпик: Иерархические Areas (дерево без ограничения глубины)

- [ ] P0•M — Миграция `20250830_01_areas_tree`: `areas.parent_id`, `mp_path TEXT NOT NULL DEFAULT ''`, `depth INT NOT NULL DEFAULT 0`, `slug TEXT NOT NULL`, индексы: `UNIQUE(owner_id, slug)`, `areas_mp_path_like ON areas (mp_path text_pattern_ops)`; бэкфилл: `slugify(name)`, `mp_path=slug||'.'`, `depth=0`, `parent_id=NULL`.
- [ ] P0•S — Миграция `20250830_02_projects_require_leaf_area`: у проектов гарантировать `area_id` (создать `Default Area` на владельца при NULL), оставить проверку «листовости» на уровне сервиса.
- [ ] P0•S — Миграция `20250830_03_tasks_time_inherit_area`: убедиться в наличии индексов на `tasks`/`time_entries` (owner+area/project, started_at).
- [ ] P0•M — Сервис `AreaService`: `create_area(owner_id, name, parent_id?)`, `move_area(area_id, new_parent_id)`, `is_leaf(area_id)`, `list_subtree(area_id)`, `mp_path(area_id)`.
- [ ] P0•M — Валидации: при создании/редактировании `Project`/`Task` — `area_id` должен быть листом (если нет `project_id`).
- [ ] P0•S — API: `GET /api/tasks|/api/projects|/api/time|/api/notes` принимают `include_sub=0|1` (+ `area_id`, `container_type=area`), фильтрация по поддереву через `mp_path LIKE prefix%`.
- [ ] P0•S — API: `/api/areas/{id}/move`, `/api/areas/{id}/rename`, `/api/areas/{id}/archive` (soft delete).
- [ ] P1•S — UI: в формах выбора Area — иерархический `<select>` с отступом по глубине; родительские (не листья) — `disabled`; чекбокс «Включая подкатегории» в фильтрах.
- [ ] P1•S — Админка Areas: создать/переименовать/переместить/архивировать; предупреждение о пересчёте путей у поддерева.
- [ ] P0•S — Тесты: `AreaService` (create/move/list_subtree), валидации Project/Task, наследование TimeService, API `include_sub` на `/api/tasks`.

Критерии приёмки:
- Можно создать дерево «Здоровье → Фитнес → Силовые», «Здоровье → Сон».
- Проект нельзя привязать к «Здоровье» (родитель), но можно к «Силовые» (лист).
- Фильтр задач/времени по «Здоровью» с `include_sub=1` показывает элементы из обеих веток.
- Перемещение «Фитнес» под другой корень корректно обновляет `mp_path/depth` у всех детей.
- UI объясняет, что такое Area, и позволяет выбирать листья.
