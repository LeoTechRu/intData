qa_report:
  when_utc: "2025-09-24T11:00:42Z"
  initiative: E17 / Frontend navigation
  build: "npm run lint && npm run test -- ModuleTabs.test.tsx"
  scope:
    - SmartSidebar drag/drop и скрытие
    - ModuleTabsBar визуал/навигация
  summary: |
    Проверки прошли на локальной сборке (React Query + Next). Перетаскивание модулей и страниц
    приводит к обновлению layout snapshot, скрытые страницы возвращаются из блока «Скрытые».
    Переключатель глобальных настроек скрыт для non-admin. Верхние вкладки фиксированы и подсвечивают
    активную страницу. Ручные клики по API дали 409 на stale version — как ожидается.
  cases:
    - id: SS-DND-01
      result: pass
      notes: "Перетаскивание модулей меняет порядок, проверено через smart-sidebar-ui"
    - id: SS-DND-02
      result: pass
      notes: "Перетаскивание страниц внутри модуля control"
    - id: SS-HIDDEN-01
      result: pass
      notes: "Hide page -> появляется в списке скрытых, восстановление возвращает"
    - id: SS-GLOBAL-01
      result: pass
      notes: "ModeSwitch доступен при canEditGlobal, в user-mode недоступен"
  follow_up:
    - "Добавить e2e сценарий Playwright после деплоя на /test"
