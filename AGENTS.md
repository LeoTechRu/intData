# Repository Guidelines

## Project Structure & Module Organization
- `core/`: shared models, services, utils, logging. All logic reused by bot and web lives here.
- /core - директория для общего переиспользуемого кода приложения (основного бэкенда) к которому может обращаться как фронтенд (/web), так и Telegram-бот (/bot).
- `bot/`: Telegram bot (aiogram) handlers, FSM states, routers. Import business logic from `core`, do not duplicate it.
- /bot - директория (модуль) Telegram-бота независимый от логики фронтенда приложения, который можно запустить отдельно от фронтенда.
- `web/`: FastAPI app routes, templates, dependencies. Reuse `core` services.
- /web - директория (модуль) фронтенда приложений независимый от логики Telegram-бота, который можно запустить отдельно от Telegram-бота.
- `tests/`: end-to-end and unit tests across subsystems.
- /tests - Директория для тестов приложения без прямого влияния на функциональность приложения.
- /utils - Директория для вспомогательных утилит напрямую не влияющих на функциональность приложения.
- Runtime boundaries (жёстко):
  - Всё, что обязательно для работы на рантайме, живёт в **/core** (модели, сервисы, валидаторы, резолверы, инициализация БД).
  - **/utils** — только опциональные скрипты (линтеры, дампы). Удаление **/utils** не должно ломать приложение.
  - `web/` и `bot/` импортируют бизнес-логику только из `core/services`.

## Инициализация БД (без Alembic)
- Источник правды по схеме: идемпотентные DDL в **`core/db/ddl/*.sql`** (только `CREATE/ALTER/INDEX IF NOT EXISTS`).
- Единый фасад: **`core/db/init_app.py:init_app_once(env)`** — вызывается и в `web`, и в `bot` до регистрации роутов/старта бота.
- Порядок внутри `init_app_once`: `run_bootstrap_sql()` → `run_repair()` → *(опционально)* `create_models_for_dev()` (только при `DEV_INIT_MODELS=1` и если не шёл bootstrap).
- Защита от гонок: PostgreSQL advisory-lock.
- ENV-флаги:
  ```
  DB_BOOTSTRAP=1        # прогон core/db/ddl/*.sql
  DB_REPAIR=1           # backfill/наследование/миграции данных
  DEV_INIT_MODELS=0     # только для локалки/тестов; не заменяет DDL
  ```

## PARA-first инварианты и интеграции
- Project обязан иметь **Area**.
- Task/Resource обязаны иметь **Project ИЛИ Area**; при наличии Project → **area наследуется** от проекта.
- Tasks = `CalendarItem(kind='task')`; **напоминания** живут внутри календаря (аналог `VALARM`); дублирующих напоминаний в задачах нет.
- Быстрый ввод: всё без контейнера падает в дефолтную **Area «Нераспределённое»**, потом можно перекинуть.
- **Subjective overrides**: персонифицированные привязки Project/Task/Resource к другой Area/Project для конкретного пользователя без дублирования сущностей.
- В тестах: запрет на runtime-импорты из `utils/*`; проверка, что entrypoints зовут только `init_app_once()`.

## User-Settings (кастомизация дашборда)
- Одна расширяемая таблица **`user_settings`** (K/V JSONB): ключи `dashboard_layout`, `favorites` и др. в будущем.
- Перенос `users_favorites` → `user_settings` (`key='favorites'`) выполняется в **`core/db/repair.py`** (идемпотентно).
- API: `GET /api/v1/user/settings`, `GET/PUT /api/v1/user/settings/{key}`.
- UI: режим «Настроить дашборд» (drag-n-drop, resize); дефолтные раскладки — фолбэк, если записи нет.

## Build, Test, and Development Commands
- Create venv: `python -m venv venv && source ./venv/bin/activate`
- Install deps: `pip install --quiet -r requirements.txt`
- Run tests: `pytest -q` (requires local PostgreSQL on `127.0.0.1:5432`)
- Lint: `flake8` (if configured)
- Перед запуском сервисов вызывается `init_app_once(env)` в entrypoints `web` и `bot`.
- После изменения схемы обновляйте DDL-файлы (`core/db/ddl/*`) и прогоняйте тесты: `pytest -q`.

## Security & Configuration
- Use `.env` (see `.env.example`) and never commit secrets.
- Required vars: `TG_BOT_TOKEN`, `TG_BOT_USERNAME`, `PUBLIC_URL`, `SESSION_MAX_AGE`, `ADMIN_TELEGRAM_IDS`, DB settings, `DB_BOOTSTRAP`, `DB_REPAIR`, `DEV_INIT_MODELS`.
- Tests: create `.env.test` (ignored) and export vars, e.g.:
  ```bash
  cat > .env.test <<'EOF'
  DB_HOST=127.0.0.1
  DB_USER=postgres
  DB_PASSWORD=postgres
  DB_NAME=postgres
  EOF
  set -a; source .env.test; set +a
  ```
- Не использовать Alembic в текущей конфигурации; миграции выполняются через DDL + repair.

## Coding Style & Naming Conventions
- Python, async/await where used; prefer f-strings; add type hints.
- Keep shared logic in `core/services` and import in `bot`/`web`.
- Table names: prefix by module; user-related tables use `users_` (e.g., `users_tg`).
- Branding: use “Intelligent Data Pro” for product/headers; bot is “@intDataBot”. Default links to `https://intdata.pro/` and bot to `https://intdata.pro/bot`.
- Language: prioritize Russian-speaking users. All user-facing texts (bot/web) default to Russian; keep code identifiers/comments in English. Add i18n only when needed, with Russian as the primary locale.

## Testing Guidelines
- Framework: `pytest` with a running PostgreSQL.
- Test naming: `tests/test_*.py`; mirror module layout.
- Run locally: `pytest -q`. Fix failing tests before merging.

## Commit & Pull Request Guidelines
- Commits: clear, imperative summary (why + what). Update `requirements.txt` when adding deps; adjust `.env.example` and `README.md` when env/behavior changes.
- Типы коммитов: `feat(core/db|services)`, `feat(web|bot)`, `chore(core/db/ddl|env)`, `docs(backlog|changelog)`.
- PRs: concise description, linked issues, setup notes, screenshots for UI changes. Ensure CI/tests pass. В описании PR добавляйте ссылки на `docs/BACKLOG.md` и `docs/CHANGELOG.md`.
- PR чек-лист: скриншоты UI при изменениях; ссылки на docs/BACKLOG.md (SSoT) и docs/CHANGELOG.md.

## Agent-Specific Instructions
- Work from repo root, activate venv, install deps, then implement.
- Keep changes minimal and aligned with existing style. Always finish with: `source ./venv/bin/activate && pip install --quiet -r requirements.txt && pytest -q`.

# AGENTS: правила работы с бэклогом и ченджлогом

## Где хранится бэклог
- Единственный источник правды: **`docs/BACKLOG.md`**.

## Где хранится история изменений
- Все изменения: **`docs/CHANGELOG.md`** (формат *Keep a Changelog*).
- После мержа PR: добавляйте записи под `## [Unreleased]` с тегами `Added/Changed/Fixed/Removed`.
- Релиз (версионирование SemVer): переносим блок `Unreleased` под новую версию `X.Y.Z` с датой.

## README.md
- Никаких списков «Сделано/Планы» в README. Только описание проекта и ссылки:
  - `[Changelog](./docs/CHANGELOG.md)`, `[Backlog](./docs/BACKLOG.md)`.
