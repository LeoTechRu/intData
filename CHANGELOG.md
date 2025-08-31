# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
- Простые SQL-миграции и раннер `db/migrate.py` с таблицами календаря и уведомлений.
- Асинхронный бэкенд на aiogram + SQLAlchemy с подключением к PostgreSQL.
- Модели пользователей, групп, каналов и настроек логирования.
- `UserService` для работы с пользователями, группами и логированием.
- Команды бота: `/start`, `/cancel`, `/birthday`, `/contact`.
- Команды бота: `/setfullname`, `/setemail`, `/setphone`, `/setbirthday`; редактирование описаний групп.
- Команда `/group` и проверка членства (декоратор).
- Логирование: middleware, пересылка неизвестных сообщений в группу логов, ответы админа, команды `/setloglevel` и `/getloglevel`.
- Декоратор `role_required` для проверки ролей.
- Заготовки FSM для обновления контактов и описания групп.
- Каркас веб‑приложения на FastAPI (webhook).
- Каркас таск‑системы: модель `Task`, `TaskService` и статусы задач.
- Тайм‑трекер: модель `TimeEntry`, `TimeService`, веб‑API `/time`, страница UI, команды бота `/time_start`, `/time_stop`, `/time_list`.
- Каркас системы напоминаний: модель `Reminder`, `ReminderService`, привязка к задачам.
- Каркас календаря: модель `CalendarEvent`, `CalendarService`.
- Базовые эндпоинты календаря `/api/v1/calendar/items` и генерация `feed.ics` (заглушки).
- Таблицы `calendar_items`, `alarms`, `notification_channels`, `project_notifications`,
  `notification_triggers` и `notifications`.
- API `/api/v1/calendar/agenda` и `/api/v1/calendar/items/{item_id}/alarms`.
- Уведомления в Telegram по расписанию через проектный канал.
- REST-эндпоинты `/api/v1/app-settings` и загрузка динамических персон UI через `app_settings`.
- Персонализированная шапка с названием системы и подсказкой в зависимости от роли.

### Changed
- Унифицирована работа с паролями через обёртку `core.db.bcrypt` и `WebUserService`.
- `LogLevel` переведён на числовой `IntEnum` для корректных сравнений.
- Обновлены шаблоны и хэндлеры под текущее API FastAPI/Starlette; переход на lifespan‑события.
- API жёстко переведён на `/api/v1` без редиректов и хвостовых слэшей; старые `/api/*` возвращают `404`.
- Карточки задач, напоминаний, событий и заметок на дашборде стали кликабельными вместо кнопок перехода.

### Fixed
- Исправлены сравнения уровней логирования после перехода на `IntEnum`.
- Исправлена авторизация через Telegram (создание `TgUser`, проверка `WebUser`, куки) и тесты.
- В тестах исправлены параметры редиректов (`follow_redirects`).
- Исправлена ошибка отсутствующего столбца `projects.status` в базе данных.
- Переведены валидаторы конфигурации на синтаксис `field_validator` Pydantic v2, устранены предупреждения устаревания.
- Swagger UI снова доступен на `/api`, статические файлы не редиректятся на `/api/v1`.
- `GET /auth/logout` корректно завершает сессию; браузеры получают favicon по `/favicon.ico`.
- Убраны редиректы при обращении к `POST /api/v1/user/favorites`.

### Removed
 - Упоминания роли из пользовательского интерфейса.
 - Убраны фиксированные ссылки (Дашборд, Задачи и др.) из меню профиля; оставлены только «Профиль», «Настройки», избранное и «Выход».
 - Alembic-миграции заменены на простой SQL-раннер `db/migrate.py`.
 - Удалены legacy‑маршруты и UI модуля напоминаний; функционал перенесён в календарь.

## [0.1.0] - YYYY-MM-DD
### Added
- Инициализация проекта.

