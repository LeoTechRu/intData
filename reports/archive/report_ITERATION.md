# Iteration Report

## Completed Tasks
- E16 Habits: web page accepts web-session without TG; write actions require TG link (403 `tg_link_required`).
- Habit cooldown errors return 429 with `Retry-After` header.
- OpenAPI snapshot updated with error models and kept in sync with runtime.

## Test Summary
- `python -m core.db.migrate` – failed (no PostgreSQL).
- `python -m core.db.repair` – ran (no output).
- `pytest -q` – 107 passed.

## SSoT Parity
- `api/openapi.json` regenerated – in sync.
- `backend/db/SCHEMA.*` – no changes.

## Risks & TODOs
- Database migration scripts require running PostgreSQL instance.
- Monitor habit cooldown to avoid abuse.

---

## Completed Tasks
- E13 Tasks & Time: bare timer auto-creates Inbox task; task creation enforces project/area with inheritance.

## Test Summary
- `python -m core.db.migrate` – failed (no PostgreSQL).
- `python -m core.db.repair` – ran (no output).
- `pytest -q` – 109 passed.

## SSoT Parity
- `api/openapi.json` regenerated – in sync.
- `backend/db/SCHEMA.*` – no changes.

## Risks & TODOs
- API clients must provide `area_id` or `project_id` when creating tasks.
