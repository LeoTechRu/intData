### Iteration 1 (date)
- Fixed `/habits` auth to allow web-session read access; write requires Telegram link (403 `tg_link_required`).
- Mapped habit cooldown errors to HTTP 429 with `Retry-After` header and updated client messaging.
- Exported runtime OpenAPI to `api/openapi.json` with documented `tg_link_required` and `cooldown` errors.

**Tests**
- `python -m core.db.migrate` (failed: connection refused)
- `python -m core.db.repair` (not executed due to above)
- `pytest -q` – 107 passed

**SSoT parity**
- `api/openapi.json` regenerated; matches runtime (`tests/test_openapi_ssot` passed).
- `core/db/SCHEMA.*` unchanged.

**Notes**
- PostgreSQL service required for `core.db.migrate`/`repair` is unavailable in this environment.
