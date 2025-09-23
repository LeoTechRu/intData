# GateRecord — Release bundle E2/E3/E17 (TL-Gate-6)

gate:
  stage: docs
  tl_check:
    approved: false
    by: "@teamlead"
    when_utc: null
  notes: |
    QA: reports/2025-09-20-release-qa.md — green.
    InfoSec: reports/infosec/2025-09-20-e2-e3-e17.md — Bandit MUST закрыт; Trivy 2025-09-23 (fastapi 0.117.1 / starlette 0.48.0) без CRITICAL/HIGH.
    DevOps: reports/runbooks/test-to-main.md обновлён security gating; свежий Trivy отчёт (`reports/infosec/trivy-2025-09-23.json`).
    Pending: Tech Writer обновил README/Tasklist/Changelog; ожидание TL Gate-5 approval.
