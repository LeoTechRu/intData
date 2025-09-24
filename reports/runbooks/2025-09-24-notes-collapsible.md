# Release Checklist — TL-2025-09-24-notes-collapsible

## Build & Tests
- [x] `npm run lint`
- [x] `npm run test -- NotesModule`
- [x] `npm run build`

## Deploy Steps (after merge to test/main)
1. `npm ci && npm run build` на сервере — проверено локально, дополнительных миграций нет.
2. Рестарт `intdata-web` (systemd) — стандартный скрипт `scripts/deploy/restart_web.sh`.
3. Smoke после релиза:
   - Убедиться, что `/notes` отображает секции «Создать заметку» и «Фильтры» в свернутом виде.
   - Создать тестовую заметку и убедиться, что форма закрывается и карточка появляется в списке.
   - Включить «Показать архив» и убедиться, что бейдж в заголовке обновляется.
4. Проверить логи `journalctl -u intdata-web -n 100` — ошибок быть не должно.

## Rollback Plan
- Fast-forward `main` → предыдущий коммит (до merge PR), redeploy, очистить кеш браузера.

## Notes
- Backend/SCHEMA не менялись; миграции отсутствуют.
- Оставшийся follow-up: e2e тест на мобильную адаптивность (QA backlog).
