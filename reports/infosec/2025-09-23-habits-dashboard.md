# InfoSec Advisory — Habits Dashboard (2025-09-23)

## Scope
- Новый эндпоинт `/api/v1/habits/dashboard` (FastAPI) и связанные фильтры area/project/include_sub.
- Next.js клиент `/habits` с Fetch-запросами к агрегатору.
- PARA-констрейнты в моделях/DDL (habits/dailies/rewards).

## Automated Scans
| Tool | Command | Result |
|------|---------|--------|
| npm audit | `npm --prefix web audit --omit=dev` | ✅ 0 vulnerabilities |
| pytest | `./venv/bin/pytest tests/web/test_habits_v1_api.py` | ✅ Pass (coverage на бизнес-логику) |

## Findings
- **MUST**: Перед релизом подтвердить ручной смоук `/habits` на QA-окружении, включая покупку награды (зависит от боевого cron/stats).
- **SHOULD**: Дополнительно прогнать Trivy `fs` (последний отчёт 2025-09-23) после объединения веток, чтобы поймать зависимые обновления контейнера.
- **COULD**: Рассмотреть Semgrep профиль для FastAPI с фокусом на параметризованных запросах (в фильтрах используются raw QueryParams, сейчас фильтруются через SQLAlchemy, риск низкий).

## Notes
- Валидация проекта привязана к owner_id, делая SQL injection в комбинированных фильтрах маловероятным; при некорректном `project_id` возвращается пустой список.
- include_sub флаг конвертируется в bool, что предотвращает передачу произвольных значений в `_resolve_area_ids`.

## Status
Неблокирующие рекомендации. Следующий gate — DevOps Release после фиксации ручного QA и триггера Trivy.
