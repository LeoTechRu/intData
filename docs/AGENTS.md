# Repository Guidelines

## Project Structure & Module Organization
- `core/`: shared models, services, utils, logging. All logic reused by bot and web lives here.
- `bot/`: Telegram bot (aiogram) handlers, FSM states, routers. Import business logic from `core`, do not duplicate it.
- `web/`: FastAPI app routes, templates, dependencies. Reuse `core` services.
- `tests/`: end-to-end and unit tests across subsystems.

## Build, Test, and Development Commands
- Create venv: `python -m venv venv && source ./venv/bin/activate`
- Install deps: `pip install --quiet -r requirements.txt`
- Run tests: `pytest -q` (requires local PostgreSQL on `127.0.0.1:5432`)
- Lint: `flake8` (if configured)

## Security & Configuration
- Use `.env` (see `.env.example`) and never commit secrets.
- Required vars: `TG_BOT_TOKEN`, `TG_BOT_USERNAME`, `PUBLIC_URL`, `SESSION_MAX_AGE`, `ADMIN_TELEGRAM_IDS`, DB settings.
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
- PRs: concise description, linked issues, setup notes, screenshots for UI changes. Ensure CI/tests pass.

## Agent-Specific Instructions
- Work from repo root, activate venv, install deps, then implement.
- Keep changes minimal and aligned with existing style. Always finish with: `source ./venv/bin/activate && pip install --quiet -r requirements.txt && pytest -q`.

# AGENTS: правила работы с бэклогом и ченджлогом

## Где хранится бэклог
- Единственный источник правды: **`BACKLOG.md` в корне**.
- Дополнительные ресёрчи/развернутые планы: `docs/backlog/*` с ссылками из `BACKLOG.md`.

## Где хранится история изменений
- Все изменения: **`CHANGELOG.md` в корне** (формат *Keep a Changelog*).
- После мержа PR: добавляйте записи под `## [Unreleased]` с тегами `Added/Changed/Fixed/Removed`.
- Релиз (версионирование SemVer): переносим блок `Unreleased` под новую версию `X.Y.Z` с датой.

## README.md
- Никаких списков «Сделано/Планы» в README. Только краткое описание проекта и ссылки:
  - `[Changelog](./CHANGELOG.md)`, `[Backlog](./BACKLOG.md)`.
