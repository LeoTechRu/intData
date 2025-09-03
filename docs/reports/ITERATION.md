## 2025-09-02 Iteration
- Documented habit error responses (`tg_link_required`, `cooldown`) in OpenAPI and synced snapshot.
- `/habits` accessible via web-session; write requires Telegram link (403 `tg_link_required`).
- Cooldown errors return 429 with `Retry-After` header.

### Tests
- `pytest -q` — 107 passed.

### SSoT
- `api/openapi.json` regenerated; no DB schema changes.

### Risks & TODOs
- Other endpoints may need similar error documentation.
