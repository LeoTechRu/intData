# Notes API & UI

## Endpoints
- `GET /api/v1/notes` — list notes. Supports filters: `area_id`, `project_id`, `pinned`, `archived`, `q`, `limit`, `offset`.
- `POST /api/v1/notes` — create note. Body: `{title?, content, area_id?, project_id?, color?}`.
- `PATCH /api/v1/notes/{id}` — update fields: `{title?, content?, area_id?, project_id?, color?, pinned?, archived_at?}`.
- `POST /api/v1/notes/{id}/archive` / `POST /api/v1/notes/{id}/unarchive` — toggle archive.
- `POST /api/v1/notes/reorder` — set `order_index` for list of note ids.

## Frontend
- Page `/notes` renders responsive grid `.notes-grid`.
- Cards use classes like `.note-card` and color tokens `.note-yellow`, `.note-mint`, etc.

