# GateRecord — Release bundle E2/E3/E17 (TL-Gate-6)

gate:
  stage: release
  tl_check:
    approved: true
    by: "@teamlead"
    when_utc: "2025-09-23T15:26:34Z"
  notes: |
    QA: reports/2025-09-20-release-qa.md — green.
    InfoSec: reports/infosec/2025-09-20-e2-e3-e17.md — Bandit MUST закрыт; Trivy 2025-09-23 (fastapi 0.117.1 / starlette 0.48.0) без CRITICAL/HIGH.
    DevOps: reports/runbooks/test-to-main.md обновлён security gating; свежий Trivy отчёт (`reports/infosec/trivy-2025-09-23.json`).
    TL: fast-forward `test -> main` выполнен 2025-09-23T15:10Z, последняя проверка README/AGENTS/agent_sync синхронизирована.
