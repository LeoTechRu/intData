# DevOps записка: таймауты pytest на PostgreSQL (2025-09-19)

## Текущее состояние
- Workflow `.github/workflows/tests.yml` разделён на два шага: web/diagnostics и остальной набор с `--ignore`, каждый с собственным `timeout-minutes`.
- Логи `pytest-part1.log` и `pytest-part2.log` всегда загружаются как артефакты.
- Полный прогон больше не зависит от единого 10-минутного лимита.

## Реализация
1. Шаг `Run web & diagnostics tests` запускает `pytest tests/web tests/test_diagnostics_service.py -q` с `timeout-minutes: 20`.
2. Шаг `Run remaining tests` запускает `pytest -q --ignore=tests/web --ignore=tests/test_diagnostics_service.py --maxfail=1` с `timeout-minutes: 30`.
3. Оба шага пишут логи (`pytest-part1.log`, `pytest-part2.log`), которые выгружаются артефактом `pytest-logs`.

## Блокеры
- Нет: тесты на PostgreSQL зелёные, workflow обновлён.

## Next Steps
- Проследить за CI: убедиться, что оба шага проходят на ветках feature/PR.
- При необходимости скорректировать `timeout-minutes` по фактическим показателям.
