# QA отчёт: pytest на PostgreSQL (2025-09-19)

## Контекст
- Ветка: `feature/E9/test-postgres-env-codex`
- Сессия: QA (TL-2025-09-19-pytest-postgres-qa)
- Цель: подтвердить зелёный прогон `pytest` после переноса на PostgreSQL и зафиксировать актуальные падения.

## Прогон команд
1. `pytest tests/web -q` — ✅ 55 passed (40.08s)
2. `pytest tests/test_diagnostics_service.py -q` — ✅ 1 passed (1.80s)
3. `pytest tests/test_access_control.py ... tests/test_decorators.py -q` — ✅ 20 passed (4.58s)
4. `pytest tests/test_habit_service.py -q` — ✅ 7 passed (4.33s)
5. `pytest tests/test_env_file.py ... tests/test_navigation_api.py -q` — ✅ 25 passed (9.16s)
6. `pytest tests/test_note_service.py ... tests/test_user_settings.py -q` — ✅ 42 passed (22.80s)

## Новые фиксы в рамках QA
- Переписали `ProfileService` (re-select grants + автогенерация профиля пользователя) — каталоги и Bootstrap работают на PostgreSQL.
- Тесты задач/таймера/групп сидят `users_tg`; сервис Telegram не записывает `owner_id` без предварительного апдейта пользователей.
- Модули time/task link и watchers используют вспомогательные сиды, убраны FK-конфликты.
- `user_settings` API и repair обновлены под PostgreSQL (`AsyncClient`, postgresql `ON CONFLICT`, корректные права).

## Итоговый статус
- Все тесты, включая ранее падавшие, зелёные при прогоне партиями (см. список команд выше).
- Полный `pytest -q` в окружении CLI по-прежнему упирается в лимит 10 минут; рекомендуем запускать двумя шагами (см. DevOps записку).

## Вывод
- QA подтверждает, что перенос на PostgreSQL завершён: web/diagnostics/прикладные тесты проходят.
- Блокеры отсутствуют; остаётся задача DevOps по таймаутам CI.
