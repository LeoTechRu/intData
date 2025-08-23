# LeonidBot
- Пет-проект для изучения возможностей Telegram-ботов. [LeonidBot.t.me](https://LeonidBot.t.me)
- Бот должен включать в себя различные полезные утилиты (таск-система, тайм-менеджер, интеграции с календарями, напоминалки, управление TG-группами)
- Для усложнения задачи поставил себе цель прикрутить веб-морду с авторизацией через Telegram.
- В качестве веб морды буду использовать Flask/FastApi/Django.

## Структура проекта

- `bot/` – Telegram-бот и его обработчики
- `web/` – веб-приложение и связанные утилиты
- `core/` – общие модули (`db.py`, `models.py`, `services/`)

## Backlog внедрения нового функционала:
- [x] Асинхронный бэкенд на aiogram и SQLAlchemy с подключением к PostgreSQL.
- [x] Определены модели пользователей, групп, каналов и настроек логирования.
- [x] Сервис `UserService` для работы с пользователями, группами и логированием.
- [x] Команды `/start`, `/cancel`, `/birthday`, `/contact` для взаимодействия с пользователем.
- [x] Команда `/group` для управления группами и декоратор проверки членства.
- [x] Логирование событий: middleware, пересылка неизвестных сообщений в группу логов, ответы админа, команды `/setloglevel` и `/getloglevel`.
- [x] Декоратор `role_required` для проверки ролей пользователей.
- [x] Заготовка FSM для обновления контактных данных и описания групп.
- [x] Каркас веб-приложения на FastAPI для работы через webhook.
- [ ] Каркас таск-системы.
- [ ] Каркас тайм-менеджера.
- [ ] Каркас системы напоминаний.
- [ ] Напоминания по таскам.
- [ ] Каркас работы с календарём.
- [ ] Интеграция с Google-календарём.
- [ ] Напоминания по Google-календарю.
- [ ] Реализовать команды `/setfullname`, `/setemail`, `/setphone`, `/setbirthday` и редактирование описаний групп.
- [ ] Веб-интерфейс с авторизацией через Telegram и админ-панелью.
- [ ] Рефакторинг сервисов и логирования, устранение дублирования кода, покрытие тестами.
- [ ] Разделение кода на модули и добавление миграций БД.
- [ ] Тесты и CI/CD для бота и веб-сервера
- [ ] Дополнительные модули: заметки, трекер привычек, учёт финансов, интеграция с внешними задачниками и календарями.

## Telegram Login Widget

The web interface uses the Telegram Login Widget for authentication.
Configure the widget using the following environment variables:

| Variable | Description |
|----------|-------------|
| `BOT_USERNAME` | Telegram bot username referenced by the widget (`data-telegram-login`). |
| `BOT_TOKEN` | Bot token used to verify authorization data. |
| `WEB_APP_URL` | Base URL where the FastAPI server is running. |
| `LOGIN_REDIRECT_URL` | Callback URL passed to `data-auth-url`. |

Example widget snippet:

```html
<script async src="https://telegram.org/js/telegram-widget.js"
        data-telegram-login="${BOT_USERNAME}"
        data-size="large"
        data-auth-url="${LOGIN_REDIRECT_URL}"
        data-request-access="write"></script>
```

## Running the FastAPI server

Install dependencies and start the server:

```bash
pip install -r requirements.txt
uvicorn web.main:app --reload
```

## Role-based admin panel

Roles defined in `models.py` determine access to admin panel features:

- `ban` – no access to the bot.
- `single` – manage only personal data.
- `multiplayer` – view group participants.
- `moderator` – edit participant information.
- `admin` – full access to all functions.
