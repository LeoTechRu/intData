handoff:
  from: architect
  to: frontend
  initiative: E17/IB-24
  task: TL-2025-09-24-bitrix24-shell
  context: |
    Визуальные требования Bitrix24: отдельный икон-рейл, синий header, ModuleTabs для подстраниц.
    Нельзя ломать SidebarEditor, FavoriteToggle и сохранение layout.
  artifacts:
    - path: web/lib/useModuleTabs.ts
      note: ресайз вкладок и fallback href при пустых данных API.
    - path: web/lib/navigationFallback.ts
      note: fallback списки модулей/категорий/страниц.
  acceptance:
    - ModuleTabs отображаются только при >1 категории
    - В моб. режиме табы заменены select
    - Tooltip на иконках модулей без пересечения с mobile nav
  blockers:
    - нет
