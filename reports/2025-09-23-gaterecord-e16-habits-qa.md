gate:
  stage: qa
  tl_check:
    approved: true
    by: "@teamlead"
    when_utc: "2025-09-23T22:25:00Z"
  notes: |
    Автотесты (pytest, vitest) и линт подтверждены на ветке `test`.
    Ручной смоук `/habits` и покупка наград остаются в очереди QA, требуется прогон на стенде после деплоя.
    Следующий шаг — InfoSec advisory по новому агрегатору `/api/v1/habits/dashboard`.
