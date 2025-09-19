# AGENTS — операционное руководство IntData

## Источники истины
- **AGENTS.md** — операционные правила codex-cli, таблица Agent Sync, процессы и инварианты, которые обязаны выполнять агенты.
- **README.md** — синхронизация с владельцем продукта: видение, дорожная карта, чек-листы, история изменений и публичная документация.
- Экспортируемые артефакты (`core/db/SCHEMA.*`, `core/db/ddl/*.sql`, `api/openapi.json`) остаются техническими источниками данных; следите за их актуальностью через чек-листы в этом файле.

## Как пользоваться документом
- Перед началом сессии прочитайте разделы «Communication Rules», «Agent Sync» и «Мультисессионный цикл».
- В процессе работы возвращайтесь к тематическим разделам (архитектура, Habits, User Settings, API) и сверяйте свои действия.
- После завершения задачи обновляйте Agent Sync в этом файле и соответствующие секции README.md (Roadmap, Tasklist, Changelog).

## Communication Rules
- Все ответы codex-cli пользователям формулируем на русском языке независимо от контекста задачи.

## Multi-Session Workflow (codex-cli)
- Перед запуском новой сессии обязательно проверьте таблицу Agent Sync в этом файле и закрепите задачу: укажите позывной, ветку `feature/<epic>/<scope>-<agent>`, список файлов и время в UTC. Без брони правки запрещены.
- Используйте lock-файлы или записи в Agent Sync для файлов: пока замок не снят, другие сессии не редактируют перечисленные пути. При завершении работы очистите запись, чтобы исключить конфликтную правку.
- Работайте строго в своей ветке; общие изменения мерджим через стандартный git-flow. Каждая сессия обязана завершаться `git push` в собственную ветку и обновлением Agent Sync.
- После завершения фичи codex-cli обязан сам провести merge своей ветки в `main`, выполнить повторный деплой, перезапустить соответствующие сервисы, проверить логи/мониторинг, оперативно исправить выявленные ошибки и убедиться, что продукт доступен для пользователей.
- В начале работы перечитайте разделы README.md «Workflow Playbook», «Idea Log», «Vision Deck», «Conventions Catalog» и «Tasklist»: синхронизация → анализ → планирование через `update_plan` → исполнение → документация. Все временные договорённости фиксируйте в соответствующих разделах README.
- Перед коммитом убедитесь, что список задач в README.md (секция «Tasklist») обновлён: отметьте выполненные пункты и добавьте ссылки на PR/коммиты. Это поддерживает прозрачность и снижает риск дублирования работы.

## Agent Sync
> Таблица броней обновляется агентами codex-cli. Время фиксируем в UTC. После merge или отмены работы строку удаляем.

| Start (UTC) | Agent | Branch | Epic / Scope | Ключевые файлы | Статус |
|-------------|-------|--------|--------------|----------------|--------|
| 2025-09-19 16:10 | codex | feature/E9/test-postgres-env-codex | E9 / pytest: Postgres окружение + ветка test | tests/conftest.py, tests/web/*, docs/reports/2025-09-19-pytest-postgres-migration.md | на паузе (фикс/seed и web-тесты на Postgres готовы; возобновить после устранения зависания teardown `tests/test_habit_service.py`) |
| 2025-09-19 10:22 | codex | feature/E9/test-postgres-env-codex | E9 / pytest: Postgres окружение | tests/conftest.py, .env*, docs/* | завершено 2025-09-19 10:33 |
| 2025-09-19 08:43 | codex | main | Ops / синхронизация main + рестарт сервисов | git (main), systemctl, logs/* | завершено 2025-09-19 08:47 |
| 2025-09-19 07:55 | codex | feature/E3/notes-assign-detached-codex | E3 / починка POST /api/v1/notes/{id}/assign (DetachedInstanceError) | core/services/notes.py, web/routes/notes.py, tests/test_notes_assign.py | завершено 2025-09-19 08:09 |
| 2025-09-19 07:48 | codex | feature/E17/appshell-nav-tuning-codex | E17 / модульная навигация AppShell — адаптация UX | web/components/AppShell.tsx, web/components/layout/PublicHeader.tsx, web/components/navigation/*, docs/* | завершено 2025-09-19 08:28 |
| 2025-09-19 00:32 | codex | feature/E18/crm-skeleton-codex | E18 / CRM Knowledge Hub — исследование и каркас | docs/reports/*crm*, docs/vision.md, docs/tasklist.md, web/app/crm/*, core/services/crm/* | завершено 2025-09-19 01:00 |
| 2025-09-18 23:05 | codex | feature/E17/menu-grouping-codex | E17 / группировка меню AppShell | web/components/AppShell.tsx, web/lib/publicNav.ts, docs/* | в работе |
| 2025-09-18 22:34 | codex | feature/E17/mobile-responsive-ui-codex | E17 / мобильная адаптация AppShell и обзора | web/components/AppShell.tsx, web/components/layout/PublicHeader.tsx, web/components/dashboard/OverviewDashboard.tsx | завершено 2025-09-18 22:44 |
| 2025-09-18 21:41 | codex | feature/E17/public-header-codex | E17 / унификация публичных лендингов | web/app/(auth|tariffs|bot|docs)/*, web/components/*, docs/BACKLOG.md | завершено 2025-09-18 22:01 |
| 2025-09-18 20:37 | codex | feature/E17/legacy-migration-codex | E17 / миграция легаси-страниц на новый UI | web/app/*, web/templates/*, web/components/*, docs/* | завершено 2025-09-18 21:03 |
| 2025-09-18 19:30 | codex | feature/E17/groups-products-ui-codex | E17 / тарифы, кнопки поддержки | web/components/marketing, web/components/AppShell.tsx, docs/* | завершено 2025-09-18 19:46 |
| 2025-09-18 18:44 | codex | feature/E17/groups-products-ui-codex | E17 / модернизация groups & products, тултипы терминов | web/app/groups, web/app/products, web/components, docs/* | завершено 2025-09-18 19:18 |
| 2025-09-18 17:45 | codex | feature/E17/profile-widget-codex | E17 / виджет профиля, меню тарифов | web/app, web/components, docs/* | завершено 2025-09-18 17:58 |
| 2025-09-18 17:18 | codex | feature/E17/bot-landing-codex | E17 / фронт + веб-сервер | web/app, web/routes, docs/* | завершено 2025-09-18 17:28 |

## Documentation Workflow (idea → vision → conventions → tasklist → workflow)
- Разделы README.md «Idea Log», «Vision Deck», «Conventions Catalog», «Tasklist» и «Workflow Playbook» образуют единый конвейер документации. Обновляйте их по мере работы.
- Исследования и длинные отчёты складывайте в `docs/reports/*` и добавляйте ссылки в соответствующие разделы README.
- Гайд для владельцев/людей по работе с codex-cli остаётся в `docs/guides/codex-cli-multisession.md`; при необходимости давайте на него ссылку в README.

## Strategic Plan (E1–E16) — как агенты выбирают и оформляют работу
- Любой MR должен ссылаться на эпик из README.md (секция «Roadmap & Epics») и соответствующие Acceptance Criteria.
- Для новых подзадач добавляйте элементы в секцию «Roadmap & Epics» README перед реализацией и синхронизируйте «Tasklist».
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
- Заголовок страницы рендерится единственным `<h1>` по центру шапки AppShell; описание выводится только во всплывающем тултипе при наведении на заголовок и не дублируется в теле страницы.
- Стандарты: **ESLint**, **Prettier**, **Vitest/Jest**; перед PR выполняются `npm run build`, `npm run dev`, `npm run lint`, `npm run test`.
- Агент codex-cli автоматически запускает `npm run build` после любых изменений, требующих пересборки Node.js (фронтенд в `web/app`, `web/components`, `web/lib`, стили, конфиги, npm-зависимости), фиксируя запуск в отчёте; если выполнить сборку нельзя, агент обязан явно описать причину.
- Задачи по фронтенду согласуются с README.md (секция «E17: Frontend Modernization») как единой точкой истины.
- Обзор (`web/app/page.tsx`, `web/components/dashboard/OverviewDashboard.tsx`) работает на Next.js с адаптивной сеткой `repeat(auto-fit, minmax(320px, 1fr))`. Каждый виджет имеет `data-widget` для идентификации; порядок и видимость хранятся в `user_settings.dashboard_layout`.
- ЛК админа доступен по `/admin` (Next.js, `web/app/admin/page.tsx`, `web/components/admin`). Встраиваемая версия `/cup/admin-embed` рендерится той же Next.js страницей (`web/app/cup/admin-embed/page.tsx`) без использования Jinja.

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
- Модель: `habits`, `habit_logs`, `dailies`, `daily_logs`, `rewards`, `user_stats` (см. README.md, секция «E16: Habits»).
- Экономика: XP/Gold/HP/Level/KP; экспоненциальное затухание награды для частых «плюсов»; штрафы HP за «минусы»; idempotent cron по локальному дню.
- API: `/api/v1/habits*`, `/api/v1/dailies*`, `/api/v1/rewards*`. Dailies интегрируются в календарь **виртуально** (agenda/ICS), без дублей в `calendar_items`.
- UI `/habits`: 4 колонки (Привычки / Ежедневные / Задачи / Награды), фильтры Area/Project, HUD (HP/XP/Level/Gold/KP).
- Бот: команды `/habit` и `/daily`, недельный дайджест.

## User-Settings (кастомизация дашборда)
- Одна расширяемая таблица **`user_settings`** (K/V JSONB): ключи `dashboard_layout`, `favorites` и др. в будущем.
- Перенос `users_favorites` → `user_settings` (`key='favorites'`) выполняется в **`core/db/repair.py`** (идемпотентно).
- API: `GET /api/v1/user/settings`, `GET/PUT /api/v1/user/settings/{key}`.
- UI: кнопка «Настроить дашборд» в Обзоре включает drag-n-drop (через DnD-kit) и скрытие/возврат виджетов. `layout.widgets` хранит порядок видимых карточек, `layout.hidden` — скрытые. Дефолт — все виджеты в порядке `web/components/dashboard/OverviewDashboard.tsx`.
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
- UI разрабатываем адаптивным: поддерживаем диапазон устройств от узких телефонов с соотношением 18:9 до широкоформатных мониторов 16:9, сохраняя единый отзывчивый layout без дублирования маркап.
- Page titles are rendered in the header via `MODULE_TITLE`; do not duplicate the module name with an extra `<h1>` inside pages.

## Testing Guidelines
- Framework: `pytest` with a running PostgreSQL.
- Test naming: `tests/test_*.py`; mirror module layout.
- Run locally: `pytest -q`. Fix failing tests before merging.

## UI Cards
- Используем React-компоненты из `web/components/ui` (`Card`, `Badge`, `Button`, `Toolbar`) и Tailwind-токены (`var(--surface-*)`, `shadow-soft`) вместо старых классов `.c-card`/`.cards-grid`.
- Для иконок используем SVG-символы и React-компоненты внутри Next.js (emoji, `svg` или `Image`); прямые инклуды `partials/icons.svg` больше не используются.
- Кнопки-иконки строим на `Button`/`IconButton` (варианты `ghost`/`secondary`) с `data-tooltip` для подсказок.
- Удаление подтверждаем через стандартные UI-диалоги (пока допускается `window.confirm`, но планируем вынести в общий компонент `ConfirmDialog`).
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
- Commits: clear, imperative summary (why + what). Update `requirements.txt` when adding deps; adjust `.env.example` и `README.md` when env/behavior changes.
- Типы коммитов: `feat(core/db|services)`, `feat(web|bot)`, `chore(core/db/ddl|env)`, `docs(readme|agents)`.
- PRs: concise description, linked issues, setup notes, screenshots for UI changes. Ensure CI/tests pass. В описании PR добавляйте ссылки на разделы README.md «Roadmap & Epics» и «Changelog».
- PR чек-лист: скриншоты UI при изменениях; ссылки на README.md («Roadmap & Epics», «Changelog»).

## Work Protocol for Agents
- К каждому изменению — ссылка на эпик и Acceptance Criteria в README.md (секция «Roadmap & Epics»); при необходимости актуализируй соответствующие записи и Tasklist.
- Бизнес-логика — только в `/core/services/*`. `/web` и `/bot` — тонкие слои.
- При любых изменениях в `/bot` обязательно актуализируй динамическую справку `/start`, чтобы она отражала доступные команды и уровни доступа.
- Миграции БД: idempotent DDL в `/core/db/ddl/*.sql` + `repair`; если в проекте уже используется другая технология, следуем действующей и фиксируем это здесь, НЕ меняя платформу миграций в рамках правки AGENTS.
- Экспорт схемы (`core.db.schema_export`) обновлять при изменении моделей.
- Все API — под `/api/v1/*`; обновить `/api/openapi.json`.
- Фичефлаги: `CALENDAR_V2_ENABLED`, `HABITS_V1_ENABLED`, `HABITS_RPG_ENABLED` (и `.env.example` при необходимости).
- Тесты (pytest): наследование PARA; один активный таймер; cron ежедневок (идемпотентность); `habits up/down`, `dailies done/undo`, виртуальные записи в agenda; срезы `/time/summary`.
- Коммиты/PR: императивный заголовок, почему+что; обновление `.env.example`, README.md (секции «Roadmap & Epics», «Changelog»); скриншоты UI.
- Work from repo root, activate venv, install deps, then implement.
- Keep changes minimal and aligned with existing style. Always finish with: `source ./venv/bin/activate && pip install --quiet -r requirements.txt && pytest -q`.
- Changes to note models or endpoints require updating `core/db/SCHEMA.*` via `python -m core.db.schema_export generate`; OpenAPI is served at `/api/openapi.json` and used in tests.

### Контуры Prod/Test
- Базовая ветка разработки — `test`; все фиче-ветки создаются от неё и мерджатся обратно через PR с зелёным `pytest -q` и фронтовыми проверками.
- Ветка `test` деплоится в изолированный контур (`test.intdata.pro`, бот `@intDataTestBot`, БД `intdatadb_test`). Автоудаление ветки после merge отключаем в GitHub.
- Ветка `main` принимает только fast-forward из `test` после ручной проверки тестового контура. Прямые PR в `main` запрещены.
- Secrets и `.env` для тестового контура используют префиксы `TEST_` (БД, URL, токены бота). Прод окружение держит значения без префикса.
- Любое изменение инфраструктуры должно обновлять оба контура (terraform/ansible роли, CI/CD jobs) и описываться в `docs/reports/*` + README.md (раздел «Operations & Infrastructure»).

### Multi-agent Coordination (codex-cli)
- Каждый экземпляр codex-cli работает в собственной рабочей копии: отдельный `git clone` или `git worktree add ../<agent-branch>`. Запрещено вести параллельную работу из одного каталога.
- Перед стартом сессии: `git fetch --all`, `git status`, убедись, что нет чужих незакоммиченных правок. При обнаружении — синхронизируйся с владельцем задачи.
- Для каждой задачи обязательно создавай персональную ветку формата `feature/<epic>/<scope>-<agent>` до внесения изменений. codex-cli сам коммитит в эту ветку, затем выполняет `git fetch`, решает конфликты (`rebase`/`merge`) и вливает её в `main` без привлечения других агентов.
- Резервируй задачи и файлы в [Agent Sync](#agent-sync): укажи позывной, дату/время (UTC), ветку и ключевые файлы. После merge/отмены работы снимай бронь.
- Если требуются правки в файлах, занятых другим агентом, договорись через Agent Sync о порядке работ; одновременное редактирование одного файла запрещено.
- Для крупных фич раскладывай изменения на подзадачи в README.md (секция «Roadmap & Epics») и, по возможности, включай фичефлаги, чтобы ограничить зону конфликта.
- Конфликты при `git rebase`/`merge` решает агент, начавший работу позже: обнови ветку, переиграй свои правки и только после этого пушь результат.

## Жёсткие архитектурные правила (не нарушать)
- Вся логика и зависимости, без которых бэкенд не стартует, живут в `core/`.
- Всё, что нужно только веб‑интерфейсу — в `web/` (тонкий слой UI и HTTP‑маршрутов, бизнес‑логика импортируется из `core/services`).
- Всё, что нужно только Telegram‑боту — в `bot/` (обработчики, FSM, роутеры, бизнес‑логика из `core/services`).
- Вспомогательные утилиты хранятся только в `utils/` и не используются рантаймом напрямую (никаких импортов из `utils/` внутри `core/`, `web/`, `bot/`).
- В `tests/` находятся только тесты; тесты не импортируют код из `utils/` на рантайме.
- В `docs/` — архивная документация, отчёты и гайды; актуальные правила и планы находятся в README.md.
- В `logs/` — только логи. Содержимое каталога не коммитим, каталог игнорируется в VCS.

## When updating API
- [ ] Измени код и тесты.
- [ ] Выполни `python -m web.openapi_export` для обновления `api/openapi.json`.
- [ ] Обнови раздел «Changelog» в README.md.

## Agent Self-Checklist (перед merge)
- [ ] Есть ссылка на эпик и AC из README.md (секция «Roadmap & Epics»)?
- [ ] Инварианты PARA соблюдены и покрыты тестами?
- [ ] Миграции/DDL идемпотентны; схема/SCHEMA.* обновлена?
- [ ] OpenAPI и фичефлаги в актуальном состоянии?
- [ ] UI соответствует стилю и отзывчивости; тексты на русском?
- [ ] README.md обновлён: Roadmap & Epics, Tasklist, Changelog?
- [ ] Локальные тесты зелёные (`pytest -q`)?

## Do Not Do
- Не создавать дубли напоминаний вне календаря.
- Не материализовать ежедневки в `calendar_items` — только виртуальная интеграция (agenda/ICS).
- Не класть бизнес-логику в `/web` или `/bot`.
- Не ломать префикс `/api/v1/*` и совместимость.

# AGENTS: работа с едиными источниками

## Где хранится бэклог и стратегия
- Основной источник правды: README.md, секция «Roadmap & Epics» (включает Roadmap, эпики E1–E18, MR-план, Definition of Done, Appendix).
- Исторические записи в `docs/BACKLOG.md` переведены в архивный режим; поддерживать актуальность нужно только в README.md.

## Где хранится история изменений
- Раздел «Changelog» в README.md ведём по формату *Keep a Changelog* и SemVer.
- После мержа PR добавляйте записи под `### [Unreleased]` с тегами `Added/Changed/Fixed/Removed` и ссылками на коммиты.
- При релизе переносите блок `Unreleased` под новую версию `X.Y.Z — YYYY-MM-DD` в README.md.

## README.md
- README теперь совмещает маркетинг, product vision, roadmap, tasklist, workflow и changelog.
- Ссылки на дополнительные материалы (`docs/reports/*`, гайды) приводите из соответствующих разделов README.
- Поддерживайте актуальность оглавления README и внутренних якорей: агенты и владелец ориентируются именно по этому документу.
