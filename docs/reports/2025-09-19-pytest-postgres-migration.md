# Postgres pytest migration — snapshot (2025-09-19)

## Что уже сделано
- Добавлены Postgres-фикстуры (`tests/utils/db.py`, `tests/conftest.py`) с временными схемами и seed `users_tg`/`users_web`.
- Перенесены на Postgres и проходят тесты: `tests/test_time_service.py`, `tests/test_calendar_service.py`, `tests/test_access_control.py`, `tests/test_note_service.py`.
- Переписаны первые части `tests/test_habit_service.py`, `core/services/habits.py` переведён на timezone-aware `datetime`.
- Документация обновлена (AGENTS.md, BACKLOG, tasklist, changelog) + добавлена задача `TL-2025-09-19-pytest-postgres-migration`.
- Добавлены сид-хелперы `ensure_user_stats` и единообразные `ensure_tg_user`/`ensure_web_user`, обновлены API/веб-тесты (`tests/web/test_habits_v1_api.py`, `test_tasks_api.py`, `test_time_summary_api.py`, `test_calendar_feed_ics.py`, `test_alarms_api.py`, `test_notes_api.py`, `test_notes_page.py`, `test_include_sub_api.py`, `test_tasks_time_integration.py`, `test_admin_routes.py` и др.) для использования `postgres_db` и timezone-aware данных.
- Энд-то-энд проверки новых фикстур: пройдены таргетные прогоны вышеупомянутых тестов на Postgres, антифарм блок в `tests/test_habit_service.py` теперь стабильно проходит в одиночном запуске.

## Оставшиеся проблемы
- `pytest tests/test_habit_service.py` завершает тесты успешно, но процесс зависает на финализации фикстуры: при удалении временной схемы остаётся открытое подключение. Нужно найти и закрыть висящие сессии в сервисах/фикстурах.
- Ряд тестов всё ещё привязан к sqlite/временным in-memory данным (см. список без использования `postgres_db`), требуется поэтапный перенос.
- Полный `pytest -q` не запускался до зелёного состояния: сначала нужно разрулить зависание teardown'а и завершить миграцию оставшихся тестов.
- При переходе на Postgres всплыли расхождения по временным зонам (пример: `/notes`, `/calendar`), необходимо провести ревизию остальных тестов на предмет naive datetime.

## Действия на следующую сессию
1. Разобраться с зависанием `pytest tests/test_habit_service.py` (видимо, незакрытые сессии в `HabitsService`/`postgres_db`), починить teardown временной схемы.
2. Продолжить перенос оставшихся web/API тестов на общий `postgres_db` и привести их ожидания к современному UI (где SSR отсутствует).
3. Прогнать расширенный набор (`tests/web`, `tests/core/services`) на Postgres, убедиться в корректности siteseed'ов (`ensure_user_stats`, timezone-aware поля).
4. После стабилизации — полный `pytest -q`, обновление документации и закрытие `TL-2025-09-19-pytest-postgres-migration`.

> Ветка: `feature/E9/test-postgres-env-codex`. Pipenv/venv активен, база `intdatadb_test` уже создана.
