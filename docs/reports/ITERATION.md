# Iteration Report

## Completed Tasks
- Fixed `/habits` web-session auth; write actions require TG and cooldown returns `429` with `Retry-After`.
- Documented `tg_link_required` and `cooldown` errors in OpenAPI snapshot.

## Test Summary
- `python -m core.db.migrate` (failed: connection refused)
- `python -m core.db.repair` (no output)
- `pytest -q` – 107 passed

## SSoT Parity
- `api/openapi.json` regenerated from runtime.

## Risks & TODOs
- PostgreSQL database not available during migrate/repair.
