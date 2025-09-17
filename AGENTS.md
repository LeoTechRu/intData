# Repository Guidelines

## Sources of Truth (SSoT)
1. **AGENTS.md** — правила и приоритеты.
2. **docs/BACKLOG.md** — дорожная карта и критерии приёмки.
3. **core/db/SCHEMA.* + core/db/ddl/*.sql** — источник истины по БД.
4. **api/openapi.json** — снимок API (экспорт рантайма).
5. **docs/CHANGELOG.md** — публичная история изменений.

## Alignment with BACKLOG.md (SSoT)
Этот документ следует [docs/BACKLOG.md](./docs/BACKLOG.md) как единой «точке истины».
При расхождении правил приоритет у BACKLOG. Существующие рекомендации AGENTS.md сохраняются, если не противоречат SSoT.

## Strategic Plan (E1–E16) — как агенты выбирают и оформляют работу
- Любой MR должен ссылаться на эпик из BACKLOG (E1…E16) и соответствующие Acceptance Criteria.
- Для новых подзадач: добавь их в BACKLOG под нужный эпик перед реализацией.
- Особое внимание: E1 (PARA), E12 (единый «Сегодня»), E13 (Tasks & Time), E16 (Habits).

## Project Structure & Module Organization
- `core/`: shared models, services, utils, logging. All logic reused by bot and web lives here.
- /core - директория для общего переиспользуемого кода приложения (основного бэкенда) к которому может обращаться как фронтенд (/web), так и Telegram-бот (/bot).
- `bot/`: Telegram bot (aiogram) handlers, FSM states, routers. Import business logic from `core`, do not duplicate it.
- /bot - директория (модуль) Telegram-бота независимый от логики фронтенда приложения, который можно запустить отдельно от фронтенда.
- `web/`: FastAPI app routes, templates, dependencies. Reuse `core` services.
- /web - директория (модуль) фронтенда приложений независимый от логики Telegram-бота, который можно запустить отдельно от Telegram-бота.
- `tests/`: end-to-end and unit tests across subsystems.
- /tests - Директория для тестов приложения без прямого влияния на функциональность приложения.
- `utils/` — единственная директория для вспомогательных утилит, которые не влияют на запуск рантайма (линтеры, проверки окружения, скрипты деплоя, дампы и т. п.). Удаление `utils/` не должно ломать приложение.
- Runtime boundaries (жёстко):
  - Всё, что обязательно для работы на рантайме, живёт в **/core** (модели, сервисы, валидаторы, резолверы, инициализация БД).
  - `utils/` — только опциональные скрипты (линтеры, проверки, дампы). Удаление `utils/` не должно ломать приложение. Директории `tools/` в проекте не используется.
  - `web/` и `bot/` импортируют бизнес-логику только из `core/services`.

### Frontend Guidelines
- Базовый стек: **Next.js + TypeScript + Tailwind**; допустимо **React + Vite**, если стандарт соблюдён.
- Код фронтенда размещается либо в `web/frontend/`, либо в отдельном `frontend/` (статика отдаётся через FastAPI).
- Используем компонентный подход, запросы к API через **React Query** или **RTK Query**; все пути согласованы с `/api/v1/*`.
- Интерфейсы обязательны к адаптивности; не допускаются дубликаты `<h1>`, заголовок задаётся через `MODULE_TITLE`.
- Стандарты: **ESLint**, **Prettier**, **Vitest/Jest**; перед PR выполняются `npm run build`, `npm run dev`, `npm run lint`, `npm run test`.
- Агент codex-cli автоматически запускает `npm run build` после любых изменений, требующих пересборки Node.js (фронтенд в `web/app`, `web/components`, `web/lib`, стили, конфиги, npm-зависимости), и отражает запуск в отчёте.
- Задачи по фронтенду согласуются с [docs/BACKLOG.md#e17-frontend-modernization](./docs/BACKLOG.md#e17-frontend-modernization) как единой SSoT.
- ЦУП (`web/templates/start.html`) собирается на адаптивной сетке `repeat(auto-fit, minmax(320px, 1fr))`. Каждый виджет — `<section class="card" data-widget="…">` с обязательной `.card-title`, уникальным `data-widget` и классами `span-*` для расширения на 2/3 колонок. Минимальная высота карты задаётся `--dashboard-card-min-height`, порядок и видимость сохраняются в `user_settings.dashboard_layout`.
- Админский сектор подключается через `<iframe data-admin-iframe>` с маршрута `/cup/admin-embed` и шаблона `web/templates/admin/embed.html`; любые изменения админки вносим там либо в `partials/admin_tools.html`, без прямых блоков в `start.html`.

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

## PARA-first Invariants (Must Not Break)
- Любая сущность: `project_id` ИЛИ `area_id` (оба NULL — ошибка). При указании `project_id` — `area_id` наследуется.
- Alarm — часть `CalendarItem` (VALARM эквивалент).
- Время — UTC + `tzid`, повторы через `RRULE`, без материализации бесконечных рядов.
- Один активный таймер на пользователя (UNIQUE WHERE `stopped_at IS NULL`).
- Для `Habits/Dailies/Rewards` обязателен `area_id`; при `project_id` наследуем `area_id` проекта.
- Project обязан иметь **Area**.
- Task/Resource обязаны иметь **Project ИЛИ Area**; при наличии Project → **area наследуется** от проекта.
- Любая сущность базы данных обязана иметь **Area**; во всех таблицах поле `area_id` обязательно (`NOT NULL`, по умолчанию системная область «Входящие»).
- Tasks = `CalendarItem(kind='task')`; **напоминания** живут внутри календаря (аналог `VALARM`); дублирующих напоминаний в задачах нет.
- Быстрый ввод: всё без контейнера падает в системную **Area «Входящие»**, потом можно перекинуть.
- **Area «Входящие»** создаётся при запуске приложения (если отсутствует) и не может быть удалена или отредактирована через UI/админку.
- **Subjective overrides**: персонифицированные привязки Project/Task/Resource к другой Area/Project для конкретного пользователя без дублирования сущностей.
- В тестах: запрет на runtime-импорты из `utils/*`; проверка, что entrypoints зовут только `init_app_once()`.

## Habits Module (Habitica-like) — правила реализации
- Модель: `habits`, `habit_logs`, `dailies`, `daily_logs`, `rewards`, `user_stats` (см. BACKLOG E16).
- Экономика: XP/Gold/HP/Level/KP; экспоненциальное затухание награды для частых «плюсов»; штрафы HP за «минусы»; idempotent cron по локальному дню.
- API: `/api/v1/habits*`, `/api/v1/dailies*`, `/api/v1/rewards*`. Dailies интегрируются в календарь **виртуально** (agenda/ICS), без дублей в `calendar_items`.
- UI `/habits`: 4 колонки (Привычки / Ежедневные / Задачи / Награды), фильтры Area/Project, HUD (HP/XP/Level/Gold/KP).
- Бот: команды `/habit` и `/daily`, недельный дайджест.

## User-Settings (кастомизация дашборда)
- Одна расширяемая таблица **`user_settings`** (K/V JSONB): ключи `dashboard_layout`, `favorites` и др. в будущем.
- Перенос `users_favorites` → `user_settings` (`key='favorites'`) выполняется в **`core/db/repair.py`** (идемпотентно).
- API: `GET /api/v1/user/settings`, `GET/PUT /api/v1/user/settings/{key}`.
- UI: кнопка «Настроить дашборд» в ЦУП включает drag-n-drop и скрытие/возврат виджетов. `layout.widgets` — список видимых карточек по порядку, `layout.hidden` — скрытые. Дефолт – все виджеты до первой сохранённой раскладки.
- `theme_preferences` хранит персональный пресет темы (`mode`, `primary`, `accent`, `surface`, `gradient{from,to}`) и применяется через `theme-utils.js` (CSS-переменные). Пустой объект = используем глобальный пресет.
- Глобальный брендовый пресет (`theme.global.*`) живёт в `app_settings`; UI `/settings` синхронно обновляет его и показывает только администраторам.

## Build, Test, and Development Commands
- Create venv: `python -m venv venv && source ./venv/bin/activate`
- Install deps: `pip install --quiet -r requirements.txt`
- Run tests: `pytest -q` (requires local PostgreSQL on `127.0.0.1:5432`)
- Lint: `flake8` (if configured)
- Frontend changes (`web/`) require `npm run lint` and `npm test`
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
- Frontend updates must maintain a unified responsive layout so the application remains comfortable on widescreen monitors, square displays, narrow phones, and any other screen sizes.
- Page titles are rendered in the header via `MODULE_TITLE`; do not duplicate the module name with an extra `<h1>` inside pages.

## Testing Guidelines
- Framework: `pytest` with a running PostgreSQL.
- Test naming: `tests/test_*.py`; mirror module layout.
- Run locally: `pytest -q`. Fix failing tests before merging.

## UI Cards
- Используем `.c-card` и `.cards-grid`; иконки — через спрайт `partials/icons.svg`.
- Кнопки-иконки оформляем классом `.ui-iconbtn` и атрибутом `data-tooltip`.
- Удаление подтверждаем через `confirmDialog` из `/static/js/ui/confirm.js`.
- Заметки обязаны иметь `area_id`; `project_id` опционален, по умолчанию используется Inbox.
- Цвет карточек заметок наследуется от `areas.color`; поле `notes.color` не используется при записи.

## Обязательное правило: схема БД (source of truth)

- Любые изменения `core/models.py` или Alembic-миграций **требуют** обновления схемы БД.
- Генерация:
```bash
  python -m core.db.schema_export generate
  git add core/db/SCHEMA.json core/db/SCHEMA.sql
  git commit -m "chore(db): update SCHEMA after model changes"
```
- CI проверяет актуальность командой `python -m core.db.schema_export check`. PR не пройдёт, если забыли обновить.

SCHEMA.json является единой «точкой истины» структуры БД (таблицы, поля, индексы, констрейнты, enum).

## Commit & Pull Request Guidelines
- Commits: clear, imperative summary (why + what). Update `requirements.txt` when adding deps; adjust `.env.example` and `README.md` when env/behavior changes.
- Типы коммитов: `feat(core/db|services)`, `feat(web|bot)`, `chore(core/db/ddl|env)`, `docs(backlog|changelog)`.
- PRs: concise description, linked issues, setup notes, screenshots for UI changes. Ensure CI/tests pass. В описании PR добавляйте ссылки на `docs/BACKLOG.md` и `docs/CHANGELOG.md`.
- PR чек-лист: скриншоты UI при изменениях; ссылки на docs/BACKLOG.md (SSoT) и docs/CHANGELOG.md.

## Work Protocol for Agents
- К каждому изменению — ссылка на эпик/критерии в BACKLOG; поддержи/обнови BACKLOG при необходимости.
- Бизнес-логика — только в `/core/services/*`. `/web` и `/bot` — тонкие слои.
- При любых изменениях в `/bot` обязательно актуализируй динамическую справку `/start`, чтобы она отражала доступные команды и уровни доступа.
- Миграции БД: idempotent DDL в `/core/db/ddl/*.sql` + `repair`; если в проекте уже используется другая технология, следуем действующей и фиксируем это здесь, НЕ меняя платформу миграций в рамках правки AGENTS.
- Экспорт схемы (`core.db.schema_export`) обновлять при изменении моделей.
- Все API — под `/api/v1/*`; обновить `/api/openapi.json`.
- Фичефлаги: `CALENDAR_V2_ENABLED`, `HABITS_V1_ENABLED`, `HABITS_RPG_ENABLED` (и `.env.example` при необходимости).
- Тесты (pytest): наследование PARA; один активный таймер; cron ежедневок (идемпотентность); `habits up/down`, `dailies done/undo`, виртуальные записи в agenda; срезы `/time/summary`.
- Коммиты/PR: императивный заголовок, почему+что; обновление `.env.example`, `docs/BACKLOG.md`, `docs/CHANGELOG.md`; скриншоты UI.
- Work from repo root, activate venv, install deps, then implement.
- Keep changes minimal and aligned with existing style. Always finish with: `source ./venv/bin/activate && pip install --quiet -r requirements.txt && pytest -q`.
- Changes to note models or endpoints require updating `core/db/SCHEMA.*` via `python -m core.db.schema_export generate`; OpenAPI is served at `/api/openapi.json` and used in tests.

## Жёсткие архитектурные правила (не нарушать)
- Вся логика и зависимости, без которых бэкенд не стартует, живут в `core/`.
- Всё, что нужно только веб‑интерфейсу — в `web/` (тонкий слой UI и HTTP‑маршрутов, бизнес‑логика импортируется из `core/services`).
- Всё, что нужно только Telegram‑боту — в `bot/` (обработчики, FSM, роутеры, бизнес‑логика из `core/services`).
- Вспомогательные утилиты хранятся только в `utils/` и не используются рантаймом напрямую (никаких импортов из `utils/` внутри `core/`, `web/`, `bot/`).
- В `tests/` находятся только тесты; тесты не импортируют код из `utils/` на рантайме.
- В `docs/` — исключительно документация (backlog/changelog/архитектура, без исходников).
- В `logs/` — только логи. Содержимое каталога не коммитим, каталог игнорируется в VCS.

## When updating API
- [ ] Измени код и тесты.
- [ ] Выполни `python -m web.openapi_export` для обновления `api/openapi.json`.
- [ ] Обнови `docs/CHANGELOG.md`.

## Agent Self-Checklist (перед merge)
- [ ] Есть ссылка на эпик и AC из BACKLOG?
- [ ] Инварианты PARA соблюдены и покрыты тестами?
- [ ] Миграции/DDL идемпотентны; схема/SCHEMA.* обновлена?
- [ ] OpenAPI и фичефлаги в актуальном состоянии?
- [ ] UI соответствует стилю и отзывчивости; тексты на русском?
- [ ] BACKLOG/CHANGELOG обновлены с якорями?
- [ ] Локальные тесты зелёные (`pytest -q`)?

## Do Not Do
- Не создавать дубли напоминаний вне календаря.
- Не материализовать ежедневки в `calendar_items` — только виртуальная интеграция (agenda/ICS).
- Не класть бизнес-логику в `/web` или `/bot`.
- Не ломать префикс `/api/v1/*` и совместимость.

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
- Политика документации:
  - Техническая документация (архитектура, модули, API, экономические формулы и пр.) ведётся в `docs/README.md` — единственный источник истины.
  - Пользовательское описание приложения (что это, как начать, ссылки) — только в корневом `README.md`.
