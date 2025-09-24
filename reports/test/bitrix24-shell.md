handoff:
  from: qa
  to: tl
  initiative: E17/IB-24
  task: TL-2025-09-24-bitrix24-shell
  context: |
    Выполнены линт (`npm run lint`) и unit-tests (`npm run test`). Предупреждения об отсутствии timezone являются ожидаемыми для окружения тестов.
  artifacts:
    - path: web/components/AppShell.tsx
      note: визуальные проверки
    - path: web/components/navigation/ModuleTabs.tsx
      note: вкладки модулей
  acceptance:
    - Линтер завершился без ошибок
    - Все Vitest тесты зелёные
    - Мобильный селектор вкладок присутствует в DOM снапшоте
  blockers:
    - нет
