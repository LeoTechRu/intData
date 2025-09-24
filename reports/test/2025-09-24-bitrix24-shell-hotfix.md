qa_report:
  when_utc: "2025-09-24T22:05:10Z"
  initiative: E17 / Frontend navigation
  build: "npm run lint && npm run test -- ModuleTabs"
  scope:
    - LeftSidebar burger placement
    - TopNavBar tab-only layout
  summary: |
    Проверено локально: бургер панель теперь внутри левого меню (верхняя зона), состояние коллапса сохраняется,
    верхняя шапка отображает только вкладки текущего модуля и профиль. Мобильный просмотр (375px) — бургер открывает
    сайдбар overlay, вкладки скроллятся горизонтально. Автотесты ModuleTabs без изменений.
  cases:
    - id: HOTFIX-BURGER
      result: pass
      notes: "Кнопка сворачивания в сайдбаре, тултипы и aria-label корректны"
    - id: HOTFIX-TABS
      result: pass
      notes: "TopNavBar без бургер-кнопки, вкладки и профиль отображаются как требовалось"
  follow_up: []
