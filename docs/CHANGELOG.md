# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Epic E17 "Frontend Modernization" в `docs/BACKLOG.md` (Next.js/Vite выбор, TS+Tailwind, перенос страниц, очистка legacy).
- Машиночитаемая схема БД (`core/db/SCHEMA.*`) и утилита `tools.schema_export` с проверкой в CI.
- user_settings table for extensible per-user preferences.
- API `/api/v1/user/settings` to read and write settings.
- Repair step to migrate legacy favorites into user_settings.
- Возможность управлять избранными пунктами меню на странице `/settings`.
- Простые SQL-миграции и раннер `core/db/migrate.py` с таблицами календаря и уведомлений.
- Асинхронный бэкенд на aiogram + SQLAlchemy с подключением к PostgreSQL.
- Модели пользователей, групп, каналов и настроек логирования.
- `UserService` для работы с пользователями, группами и логированием.
- Команды бота: `/start`, `/cancel`, `/birthday`, `/contact`.
- Команды бота: `/setfullname`, `/setemail`, `/setphone`, `/setbirthday`; редактирование описаний групп.
- Команда `/group` и проверка членства (декоратор).
- Web: ESLint, Prettier и Vitest конфигурации.
- Логирование: middleware, пересылка неизвестных сообщений в группу логов, ответы админа, команды `/setloglevel` и `/getloglevel`.
- Декоратор `role_required` для проверки ролей.
- Заготовки FSM для обновления контактов и описания групп.
- Каркас веб‑приложения на FastAPI (webhook).
- Каркас таск‑системы: модель `Task`, `TaskService` и статусы задач.
- Тайм‑трекер: модель `TimeEntry`, `TimeService`, веб‑API `/time`, страница UI, команды бота `/time_start`, `/time_stop`, `/time_list`.
- Каркас календаря: модель `CalendarEvent`, `CalendarService`.
- Базовые эндпоинты календаря `/api/v1/calendar/items` и генерация `feed.ics` (заглушки).
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
- Feature flags HABITS_V1_ENABLED, HABITS_RPG_ENABLED in .env.example.
- Anti-farm mechanics: cooldown per habit, soft daily limit, exponential reward decay; daily_xp/daily_gold counters.
- Notes API supports `include_sub=1` for listing notes in subareas.

### Changed
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
- Страница `/notes` доработана: карточки фиксированного размера с цветом области, всплывающее окно для просмотра и новая форма быстрого ввода.
- Цвет заметок наследуется от области; поле `notes.color` устарело и не используется.
- В UI заметок удалён выбор цвета, карточки и чипы окрашиваются через CSS-переменные и авто-контраст.
- /calendar/agenda теперь поддерживает `include_habits=1` (виртуальные ежедневки).
- ICS feed экспортирует VTODO с RRULE для ежедневок (только чтение).
- `/api/v1/habits/stats` now includes `{daily_xp, daily_gold}`.
- API авторизации унифицировано через `get_current_owner`; OpenAPI описывает новые ошибки.
- Unified OpenAPI SSoT at `/api/openapi.json`; exporter produces `api/openapi.json`.

### Fixed

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

### Security
- Access control on owner_id for habits/dailies/rewards and logs.
- Нулевые права на write-действия без TG-привязки; одинаковое owner-scoping для всех эндпоинтов.
- Unified owner scoping via `get_current_owner`.

### Removed
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

## [0.1.0] - YYYY-MM-DD
### Added
- Инициализация проекта.

