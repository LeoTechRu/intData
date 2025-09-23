gate:
  stage: infosec
  tl_check:
    approved: true
    by: "@teamlead"
    when_utc: "2025-09-23T22:32:00Z"
  notes: |
    npm audit для Next.js витрины — 0 уязвимостей; pytest подтвердил новые фильтры.
    Trivy fs 2025-09-23 остаётся актуальным, повторить запуск после QA смоука (шаг DevOps).
    Ручная проверка `/habits` необходима перед релизом, но не блокирует InfoSec gate.
