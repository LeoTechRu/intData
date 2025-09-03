# Iteration Report

## Tasks Completed
- Documented `tg_link_required` and `cooldown` errors in Habits API and enforced OpenAPI snapshot parity.

## Acceptance Criteria
- `/habits` доступна по веб-сессии; write-действия требуют TG (403).
- Кулдаун привычек возвращает 429 с заголовком `Retry-After`.
- Снимок `api/openapi.json` идентичен рантайм-спеку и содержит новые ошибки.

## Test Summary
- `python -m core.db.migrate && python -m core.db.repair` *(failed: connection refused)*
- `python -m tools.schema_export check` *(passed)*
- `pytest -q` *(107 passed)*

## SSoT Parity
- `api/openapi.json` regenerated; parity test passes.
- DB schema unchanged.

## Risks & TODOs
- PostgreSQL instance required for migrate/repair commands.
