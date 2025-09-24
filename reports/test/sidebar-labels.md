handoff:
  from: qa
  to: tl
  initiative: E17/IB-24
  task: TL-2025-09-24-sidebar-labels
  context: |
    Запущены npm run lint / npm run test после удаления текстовых заголовков в сайте-баре. Предупреждения timezone ожидаемы.
  artifacts:
    - path: web/components/AppShell.tsx
      note: визуальная проверка отсутствия текстовых подписей
  acceptance:
    - eslint прошёл без ошибок
    - vitest все тесты зелёные
  blockers:
    - нет
