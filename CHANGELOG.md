# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
### Added
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
- REST-эндпоинты `/api/v1/app-settings` и загрузка динамических персон UI через `app_settings`.

### Changed
- Унифицирована работа с паролями через обёртку `core.db.bcrypt` и `WebUserService`.
- `LogLevel` переведён на числовой `IntEnum` для корректных сравнений.
- Обновлены шаблоны и хэндлеры под текущее API FastAPI/Starlette; переход на lifespan‑события.

### Fixed
- Исправлены сравнения уровней логирования после перехода на `IntEnum`.
- Исправлена авторизация через Telegram (создание `TgUser`, проверка `WebUser`, куки) и тесты.
- В тестах исправлены параметры редиректов (`follow_redirects`).
- Починена конфигурация Alembic и автоматическое применение миграций при запуске приложения.
- Alembic получает полный URL без маскировки пароля, чтобы миграции успешно подключались к базе.
- Исправлена ошибка отсутствующего столбца `projects.status` в базе данных.
- Починено падение Alembic при наличии символов `%` в пароле DSN.
- Переведены валидаторы конфигурации на синтаксис `field_validator` Pydantic v2, устранены предупреждения устаревания.

### Removed
 - Убраны фиксированные ссылки (Дашборд, Задачи и др.) из меню профиля; оставлены только «Профиль», «Настройки», избранное и «Выход».

## [0.1.0] - YYYY-MM-DD
### Added
- Инициализация проекта.

