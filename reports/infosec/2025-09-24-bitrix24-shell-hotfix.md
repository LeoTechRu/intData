infosec_report:
  when_utc: "2025-09-24T22:07:10Z"
  initiative: E17 / Frontend navigation
  scope:
    - web/components/AppShell.tsx
    - web/components/navigation/LeftSidebar.tsx
    - web/components/navigation/TopNavBar.tsx
  tools:
    semgrep: reuse-2025-09-24 (no new findings)
    bandit: not_applicable (frontend)
    trivy: pending_ci (UI-only change, бинарь локально отсутствует)
  summary: |
    Изменения касаются только React-компонентов (перемещение кнопки бургер в левый сайдбар). Повторный запуск семпового
    semgrep-профиля не выявил новых находок. Рекомендуем выполнить запланированный Trivy fs вместе с основным релизом,
    но дополнительных мер по данному hotfix не требуется.
  recommendations:
    must: []
    should: []
    could:
      - "При выполнении CI Trivy убедиться, что отчёт приложен к релизному GateRecord"
  notes: "UI-only, без работы с данными/сетевыми вызовами."
