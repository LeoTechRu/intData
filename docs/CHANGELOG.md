# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Admin API endpoint `/api/v1/admin/audit/logs` для просмотра журнала выдачи прав (миграция из NexusCore Balance).
- Модуль совместимости `core.db.legacy` c `DBConfig`, `validate_config` и `get_raw_connection` для сценариев старого Flask-приложения.
- Документ `docs/archive/nexuscore_balance.md` со сводкой переноса функционала NexusCore.
- Бэкенд задач: таблицы `task_reminders`, `task_watchers`, новые поля контроля (`control_enabled`, `control_frequency`, `control_status`, `control_next_at`, `remind_policy`, `is_watched`) и методы `TaskService` для напоминаний, наблюдателей и статистики бота.
- Telegram-команды `/task_add`, `/task_rename`, `/task_due`, `/task_remind`, `/task_control`, `/task_forget`, `/task_watch`, `/task_unwatch`, `/task_stats*` с обновлённой справкой `/start`.
- TaskReminderWorker (`core/services/task_reminder_worker.py`) и TaskNotificationService для доставки напоминаний и оповещений наблюдателям.
- Tasks (Next.js): статистика по статусам, колонки контроля/наблюдения, обновлённые таблицы и интеграция с новым API `/tasks/stats`.
- Поддержка профилей продуктов (`/products/{slug}`) с каталогом и контролем доступа.
- Режим настройки ЦУПа с drag-n-drop, скрытием и панелью скрытых виджетов.
- Личные и глобальные пресеты темы: выбор режима, палитры и градиента через расширенный color picker на странице `/settings`.
- Обзор модерации Telegram-групп в ЦУП и админском секторе: активные участники, тихие пользователи и задолженности по оплатам.
- pre-commit configuration with ruff, black, isort and basic hooks.
- developer Makefile and type checking via mypy.
- structured JSON logging with request correlation.
- `/metrics`, `/healthz` and `/readyz` endpoints.
- security headers, rate limiting and request body size guard.
- UI kit skeleton with reusable components.
- Time summary endpoint `/api/v1/time/summary` for aggregating durations by day, project, area or user.
- comprehensive test suite covering DB idempotency, PARA repair, OpenAPI snapshot parity and core habits/today/tasks/time flows.
- Epic E17 "Frontend Modernization" в `docs/BACKLOG.md` (Next.js/Vite выбор, TS+Tailwind, перенос страниц, очистка legacy).
- Машиночитаемая схема БД (`core/db/SCHEMA.*`) и утилита `tools.schema_export` с проверкой в CI.
- user_settings table for extensible per-user preferences.
- API `/api/v1/user/settings` to read and write settings.
- Repair step to migrate legacy favorites into user_settings.
- Возможность управлять избранными пунктами меню на странице `/settings`.
- Панель «Области жизни» на странице `/settings` с деревом PARA, быстрым созданием, переименованием и перемещением областей.
- Простые SQL-миграции и раннер `core/db/migrate.py` с таблицами календаря и уведомлений.
- Асинхронный бэкенд на aiogram + SQLAlchemy с подключением к PostgreSQL.
- Модели пользователей, групп, каналов и настроек логирования.
- `UserService` для работы с пользователями, группами и логированием.
- Команды бота: `/start`, `/cancel`, `/birthday`, `/contact`.
- Команды бота: `/setfullname`, `/setemail`, `/setphone`, `/setbirthday`; редактирование описаний групп.
- Команда бота `/help` со списком доступных команд.
- Команда `/group` и проверка членства (декоратор).
- Команды `/group audit`, `/group mark`, `/group note` с регистрацией активности и покупок прямо из чата.
- CRM для групп: продукты, дневная статистика, журнал удаления и middleware сбора активности.
- Веб-интерфейс `/groups` с API массового удаления «непокупателей» и карточками участников (продукты, теги, заметки).
- Web: ESLint, Prettier и Vitest конфигурации.
- Пример компонента React и тест на Testing Library демонстрируют рабочий стек.
- Логирование: middleware, пересылка неизвестных сообщений в группу логов, ответы админа, команды `/setloglevel` и `/getloglevel`.
- Декоратор `role_required` для проверки ролей.
- Заготовки FSM для обновления контактов и описания групп.
- Каркас веб‑приложения на FastAPI (webhook).
- Каркас таск‑системы: модель `Task`, `TaskService` и статусы задач.
- Тайм‑трекер: модель `TimeEntry`, `TimeService`, веб‑API `/time`, страница UI, команды бота `/time_start`, `/time_stop`, `/time_list`.
- Каркас календаря: модель `CalendarEvent`, `CalendarService`.
- Базовые эндпоинты календаря `/api/v1/calendar/items` и генерация `feed.ics` (заглушки).
- Административные утилиты перенесены на главную страницу «ЦУП» (доступны только роли admin) с якорем `#cup-admin-tools`.
- Таблицы `calendar_items`, `alarms`, `notification_channels`, `project_notifications`,
  `notification_triggers` и `notifications`.
- API `/api/v1/calendar/agenda` и `/api/v1/calendar/items/{item_id}/alarms`.
- Уведомления в Telegram по расписанию через проектный канал.
- REST-эндпоинты `/api/v1/app-settings` и загрузка динамических персон UI через `app_settings`.
- Персонализированная шапка с названием системы и подсказкой в зависимости от роли.
- Форма добавления напоминаний в веб-интерфейсе календаря.
- Кнопка «Добавить напоминание» для событий календаря и проверка времени напоминаний.
- Простейший DDL-раннер `core/scripts/db_bootstrap.py` и файлы `core/db/ddl/*`.
- Утилита резервного копирования БД `core/scripts/db_dump.py` (pg_dump), путь и префикс настраиваются через `.env`.
- Notes now require `area_id` and optional `project_id`; API `/api/v1/notes` returns area/project data.
- Страница `/notes` отображает адаптивные карточки с быстрым созданием и редактированием.
- Визуал заметок в стиле Google Keep с цветными карточками и закреплением.
- Цвет заметок, закрепление, архив и сортировка drag-and-drop.
- Эндпоинты `/api/v1/notes/{id}/archive`, `/api/v1/notes/{id}/unarchive`, `/api/v1/notes/reorder`.
- Привычки требуют `area_id` (проект опционален); `/api/v1/habits` возвращает данные области и проекта, по умолчанию используется «Входящие».
- Страница `/habits` с простым интерфейсом для управления привычками.
- Колонка `areas.color` с HEX-значением и дефолтом `#F1F5F9`; миграция с бэкфиллом.
- Утилита `getAreaColor` в фронтенде для кеширования цветов областей.
- AGENTS.md aligned with BACKLOG (E1–E16, Habits module, PARA invariants, agent protocol, checklist).
- Habitica-like module foundations: DDL for habits/habit_logs/dailies/daily_logs/rewards/user_stats.
- Core services: HabitsService, DailiesService, HabitsCronService, UserStatsService.
- Public API for habits, dailies, rewards, stats and cron under `/api/v1/*`.
- /habits page (4 columns), HUD, keyboard shortcuts; Telegram commands (/habit, /daily).
- Next.js frontend scaffold with React Query and Tailwind; migrated `/inbox` page.
- Feature flags HABITS_V1_ENABLED, HABITS_RPG_ENABLED in .env.example.
- Anti-farm mechanics: cooldown per habit, soft daily limit, exponential reward decay; daily_xp/daily_gold counters.
- Notes API supports `include_sub=1` for listing notes in subareas.
- Тест покрытия для `/api/v1/habits` проверки доступа без привязки Telegram и заголовка `Retry-After` при кулдауне.
- Bare timers auto-create tasks in Inbox.

### Changed
- Next.js frontend теперь обслуживает страницы `/areas`, `/projects`, `/resources` и `/tasks`: новые формы CRUD работают через React Query, дерево PARA редактируется через современный UI, каталог ресурсов получил поиск и современную форму, а legacy-шаблоны FastAPI удалены.
- Профильные страницы областей/проектов/ресурсов перенесены на Next.js: карточки отображают обложку, метаданные, теги и секции через `/api/v1/profiles/*` без Jinja-шаблонов.
- Каталог пользователей и профили `/users` теперь построены на Next.js (поиск, карточки, просмотр через профильный API); серверные шаблоны и роуты FastAPI удалены.
- Боковая навигация AppShell включает раздел «Команда» для быстрого перехода к каталогу пользователей.
- Next.js frontend получил AppShell-лейаут с дизайн-токенами, адаптивной навигацией и обновлённым опытом для страниц `/` и `/inbox` (поиск, skeleton, error-state).
- Избранное в меню профиля автоматически очищается от устаревших ссылок (`https://intdata.pro/admin`) и использует относительные пути, включая якорь `/settings#areas`.
- Сброс глобальной темы через `/settings` очищает значения `theme.global.*` и возвращает дефолтную палитру без ручного редактирования БД.
- Админский сектор теперь рендерится маршрутом `/cup/admin-embed` и подключается в ЦУП через iframe.
- Административные настройки объединены на `/settings`: бренд, Telegram-интеграции и глобальная тема доступны только администраторам.
- Команда `/group` теперь выполняет инвентаризацию Telegram-группы и сразу выводит отчёт `/group audit`; бот индексирует участников при добавлении в чат (E5b).
- Переработан модуль авторизации: битовые права, гибкие пресеты ролей, назначение прав по scope (global/area/project) и аудит операций доступа; обновлены веб-зависимости `role_required`/`permission_required` и настройки избранного.
- CRM по продуктам выделена в отдельный сервис, управление модерацией групп использует самостоятельный модуль и сводки.
- developer docs with observability and security guidelines.
- unified test fixtures and factories; OpenAPI snapshot test now enforces SSoT.
- Унифицирована работа с паролями через обёртку `core.db.bcrypt` и `WebUserService`.
- API обслуживается под `/api/v1` с заголовком `X-API-Version`; старые пути `/api/*` редиректятся (308) на новую схему, Swagger доступен по `/api`.
- `LogLevel` переведён на числовой `IntEnum` для корректных сравнений.
- Обновлены шаблоны и хэндлеры под текущее API FastAPI/Starlette; переход на lifespan‑события.
- API жёстко переведён на `/api/v1` без редиректов и хвостовых слэшей; старые `/api/*` возвращают `404`.
- Карточки задач, событий и заметок на дашборде стали кликабельными вместо кнопок перехода.
- В шапке приложения вместо имени пользователя отображается метка его роли.
- Объединён бэклог из `docs/backlog/second_brain_backlog.md` в `BACKLOG.md`; добавлен эпик E13 Tasks & Time.
- Улучшен веб-интерфейс календаря: добавление событий и напоминаний внутри таблицы, отображение существующих напоминаний.
- Логика миграций и модуль базы данных перенесены в `core/db` для общего использования.
- Настройки дашборда перенесены на страницу `/settings`.
- Страница `/admin` приведена к единому стилю карточек и таблиц.
- Переименована дефолтная область «Нераспределённое» в системную «Входящие»; все сущности обязаны иметь область, при отсутствии используется «Входящие».
- Страница `/settings` стала адаптивной: убрано повтор заголовка и добавлена сетка блоков настроек.
- Страница `/notes` обновлена: заголовок выводится только в шапке, форма быстрой заметки центрирована и чип области позволяет менять область.
- Task creation requires `project_id` or `area_id`; area inherits from project.
- Страница `/notes` доработана: карточки фиксированного размера с цветом области, всплывающее окно для просмотра и новая форма быстрого ввода.
- Цвет заметок наследуется от области; поле `notes.color` устарело и не используется.
- В UI заметок удалён выбор цвета, карточки и чипы окрашиваются через CSS-переменные и авто-контраст.
- /calendar/agenda теперь поддерживает `include_habits=1` (виртуальные ежедневки).
- ICS feed экспортирует VTODO с RRULE для ежедневок (только чтение).
- `/api/v1/habits/stats` now includes `{daily_xp, daily_gold}`.
- API авторизации унифицировано через `get_current_owner`; OpenAPI описывает новые ошибки.
- Unified OpenAPI SSoT at `/api/openapi.json`; exporter produces `api/openapi.json`.
- OpenAPI snapshot documents `tg_link_required` and `cooldown` errors.
- Tailwind config updated for Next.js sources.
- Загрузка переменных окружения теперь производится из файла, указанного в `ENV_FILE` (по умолчанию `${PROJECT_DIR}/.env`).
- Логируется путь загруженного `.env` и выводится предупреждение, если файл находится вне корня проекта.
- Главный экран переименован в «ЦУП» с подсказкой «Центр Управления Полётами», поправлены пункты меню и тултипы.

### Fixed
- Страница `/users` больше не падает из-за CSP: inline-скрипты Next.js автоматически разрешены через SHA256-хеши в `script-src`.
- Backend автоматически запускает `npm ci` (если нет `node_modules`) и `npm run build`, поэтому `/users` и `/_next/static` восстанавливаются даже на "чистых" развёртываниях.
- Подключён API `/api/v1/profiles/*` в FastAPI, поэтому каталог и профили пользователей снова загружаются без ошибок 404.
- Content Security Policy по умолчанию разрешает загрузку Telegram Login (скрипт `telegram.org` и iframe `oauth.telegram.org`), поэтому кнопка входа снова видна на `/auth`.
- Кнопка входа через Telegram снова отображается над формой входа на странице авторизации.
- Страница авторизации скрывает виджет Telegram при `TG_LOGIN_ENABLED=0`, предотвращая ошибки.
- Эндпоинты входа через Telegram возвращают 503 при `TG_LOGIN_ENABLED=0`.
- reduced test flakiness via deterministic time handling and confirmed cooldown paths mapping to 429.
- Страница `/inbox` запрашивает заметки у API через `NEXT_PUBLIC_API_BASE`.
- Фронтенд использует `/api/v1` по умолчанию при отсутствии `window.API_BASE`.

- Автоматическое создание таблицы `app_settings`, исключающей ошибки при её отсутствии.
- Создание таблицы `user_settings` в repair-скрипте, что предотвращает падения при чтении настроек.
- Страница `/habits` корректно использует активную веб-сессию и больше не требует повторной авторизации Telegram.
- `/habits` корректно использует активную веб-сессию: страница доступна без TG, write-действия требуют привязку (403 `tg_link_required`).
- Habit endpoints маппят `cooldown` в 429 (с `Retry-After`), исключая 500.
- Приведена к асинхронной `init_app_once`, что устраняет ошибку MissingGreenlet при подключении через `asyncpg`.
- Исправлено отключение виджетов дашборда через пользовательские настройки.
- Скрытие виджетов на дашборде теперь учитывает состояние чекбоксов в настройках.
- Список избранного по умолчанию включает все доступные страницы, если пользователь ещё не сохранял настройки.
- Дашборд показывает только виджеты, выбранные пользователем; при отсутствии настроек отображаются все.
- Добавлены meta viewport и основной регион `<main>` для базовой мобильной адаптивности и доступности.
- Исправлено создание системной области «Входящие» при быстром добавлении заметки.
- Добавлена миграция столбцов `area_id` и `project_id` для таблицы `habits`.
- Кнопки заметок (редактирование, закрепление, удаление) стали кликабельными и работают по назначению.
- PARA inheritance for newly created habits/dailies/rewards enforced in services and repair.
- Habit ORM exposes `.area` and `.project`; `/habits` no longer responds 500 when listing habits.
- Repair backfills `area_id` from project and warns when both `area_id` and `project_id` are NULL.
- Habit creation via `/api/v1/habits` no longer fails when area is missing; defaults to Inbox and accepts `name` payload.
- Создание заметки больше не падает при отсутствии цвета у области.
- Бот снова пересылает все входящие сообщения в логирующую группу и позволяет администраторам отвечать на них.

### Security
- baseline HTTP headers and optional rate limiting.
- Access control on owner_id for habits/dailies/rewards and logs.
- Нулевые права на write-действия без TG-привязки; одинаковое owner-scoping для всех эндпоинтов.
- Unified owner scoping via `get_current_owner`.

### Removed
- Удалён устаревший каталог `NexusCore/`; весь функционал перенесён в `intdata/`.
- Удалён HTML-маршрут `/admin`; админские инструменты доступны только из ЦУПа.
- Удалён устаревший API напоминаний и связанные сервисы.
- Исправлены сравнения уровней логирования после перехода на `IntEnum`.
- Исправлена авторизация через Telegram (создание `TgUser`, проверка `WebUser`, куки) и тесты.
- В тестах исправлены параметры редиректов (`follow_redirects`).
- Исправлена ошибка отсутствующего столбца `projects.status` в базе данных.
- Удалена страница `/settings/dashboard`.
- Переведены валидаторы конфигурации на синтаксис `field_validator` Pydantic v2, устранены предупреждения устаревания.
- Swagger UI снова доступен на `/api`, статические файлы не редиректятся на `/api/v1`.
- `GET /auth/logout` корректно завершает сессию; браузеры получают favicon по `/favicon.ico`.
- Убраны редиректы при обращении к `POST /api/v1/user/favorites`.
- Исправлено добавление и удаление избранного в веб-интерфейсе.
- Починена вёрстка меню избранного и отображение звёздочки на страницах.
- Удалён скриншот страницы `/settings` из документации.
- Duplicate OpenAPI/Swagger files.

### Removed
 - Упоминания роли из пользовательского интерфейса.
 - Убраны фиксированные ссылки (Дашборд, Задачи и др.) из меню профиля; оставлены только «Профиль», «Настройки», избранное и «Выход».
 - Alembic-миграции заменены на простой SQL-раннер `core/db/migrate.py`.
- Удалены legacy‑маршруты и UI модуля напоминаний; функционал перенесён в календарь.
- Удалены устаревшие директория `migrations/` и конфигурация `alembic.ini`.
- Jinja-шаблон и маршрут FastAPI для `/inbox`.

### Changed
- Усилены инварианты PARA на уровне БД: `projects.area_id` теперь `NOT NULL`; добавлены индексы на `project_id/area_id` для основных таблиц.

### Fixed
- Исправлена TZ-логика на дашборде: устранены сравнения «naive vs aware», все вычисления нормализованы в UTC.

## [0.1.0] - YYYY-MM-DD
### Added
- Инициализация проекта.
