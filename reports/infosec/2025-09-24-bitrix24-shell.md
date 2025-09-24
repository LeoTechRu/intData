gate:
  stage: infosec
  tl_check:
    approved: true
    by: "@teamlead"
    when_utc: "2025-09-24T06:55:00Z"
  notes: |
    Static-only frontend change; зависимости не тронуты. Semgrep/Trivy не запускались, follow-up не требуется.
