# GateRecord — Documentation Consolidation (2025-09-20)

## Контекст
- Owner directive на 2025-09-20 требует полного отказа от каталога `docs/`.
- README должен оставаться единственным человекочитаемым источником на русском языке; технические артефакты перемещаются в `reports/`.

## Что сделано
- Перенесены все материалы из `docs/**` в `reports/`, `reports/archive/`, `reports/guides/`, `reports/runbooks/`, `reports/ops/`; каталог `docs/` удалён.
- README обновлён: добавлен раздел «🗒️ Политика документации», переписаны ссылки на `reports/`, уточнены обязанности ролей.
- AGENTS обновлён: добавлены Branch & CI Guardrails с запретом `docs/`, новая Documentation Policy, Sync Policy расширен до README + AGENTS.
- Добавлены CI-гейты (`docs-guards` workflow) для запрета `docs/**`, проверки русскоязычности README и поиска устаревших ссылок; создан скрипт `scripts/sync-docs.sh` для зеркалирования README/AGENTS.
- Обновлены вспомогательные материалы (`internal-handbook`, role boundary link в `/habits` и др.) под новую структуру `reports/`.

## Ссылки
- Коммит: 14443d4 «chore(docs): remove docs folder; move reports to ./reports; consolidate README (ru)»
- Ветка: `cleanup/docs-removal`

## Follow-ups
- После merge запустить `scripts/sync-docs.sh`, чтобы синхронизировать README/AGENTS в `test` и активных `feature/*`.
- Контроль: CI `docs-guards` должен оставаться включён постоянно; README и AGENTS проверять на русскоязычность и идентичность между ветками.
