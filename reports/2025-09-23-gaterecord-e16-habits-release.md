gate:
  stage: release
  tl_check:
    approved: true
    by: "@teamlead"
    when_utc: "2025-09-23T22:36:00Z"
  notes: |
    Выполнен fast-forward `test -> main` (commit 5ed6372).
    QA автотесты и lint зелёные; ручной смоук `/habits` отмечен как follow-up в QA отчёте.
    InfoSec advisory 2025-09-23 без блокеров; DevOps задач на инфраструктуру не требуется.
