# QA Report — Release bundle E2/E3/E17 (2025-09-20)

- **Commit**: `test` @ `f34a994`
- **Компоненты**: E2 (PARA инварианты), E3 (Calendar feed, Diagnostics), E17 (Navigation runtime)
- **Дата**: 2025-09-20T22:55Z

## Прогоны

| Scope | Команда | Итог |
|-------|---------|------|
| PARA invariants (E2) | `pytest tests/test_para_invariants.py` *(см. отчёт)* | ✅ 2 passed |
| Calendar feed VALARM (E3) | `pytest tests/web/test_calendar_feed_ics.py` | ✅ 1 passed (pydantic warnings) |
| Diagnostics API (E3) | `pytest tests/test_diagnostics_service.py` | ✅ 1 passed |
| Navigation API (E17) | `pytest tests/test_navigation_api.py` | ✅ 2 passed (datetime.utcnow warning) |
| Frontend regression | `npm test` (Vitest) | ✅ 11 файлов, 28 тестов (ожидаемые timezone-mock предупреждения) |

## Наблюдения
- Pydantic deprecation (`config`, `json_encoders`) — известный технический долг E2/E3, требует миграции на ConfigDict.
- `datetime.utcnow()` в `core/services/app_settings_service.py` — рекомендуется follow-up на timezone-aware datetime.
- Vitest warning `Failed to fetch timezone setting` — ожидаемый из-за отсутствия моков AppShell, не влияет на AC.

## Вывод
Регрессия пройдена, блокирующие дефекты не обнаружены. Релиз готов к Gate-4 (InfoSec) и Gate-5 при условии устранения security MUST.
