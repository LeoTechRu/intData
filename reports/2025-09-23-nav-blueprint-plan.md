# Nav Blueprint Extension — Work Plan (2025-09-23)

## Goal
Завершить TL-2025-09-18-nav-blueprint: расширить NAV_BLUEPRINT и API `/api/v1/navigation/sidebar*`, чтобы приложения (AppShell, ModuleTabs, SidebarEditor) могли строить модульные секции и верхние вкладки из единого источника.

## Proposed Data Model
- `NavBlueprintItem` новые поля:
  - `category`: slug (например, `"overview"`, `"planning"`, `"knowledge"`).
  - `module`: оставить (уже есть).
  - `section_order`: оставить как вес внутри модуля/категории.
- Категории по умолчанию (module → categories):
  - **control**: `overview`, `inbox`.
  - **calendar**: `calendar_core` (Календарь, Время).
  - **tasks**: `planning` (Tasks, Projects, Areas), `resources`.
  - **knowledge**: `notes`, `products`.
  - **team**: `people` (Team, Groups), `habits` (если включено).
  - **admin**: `settings`, `admin_tools`.
- Новый reference `CATEGORY_DEFINITIONS = { (module, category) -> (label, order) }`.
- API payload добавляет `categories: [{ id, module_id, label, order }]`, а `items[*]` содержит `category`.

## Backend Tasks
1. Обновить `NavBlueprintItem` dataclass + NAV_BLUEPRINT.
2. Добавить `CATEGORY_DEFINITIONS`, функцию `get_category_definition`.
3. Расширить `build_navigation_payload`:
   - Конструировать `categories` из модулей/категорий присутствующих items.
   - В `items_payload` добавлять `category`.
4. Поддержать backward compatibility: старые layout JSON не ломаем (игнорируют новое поле).
5. Тесты `tests/test_navigation_api.py`:
   - Проверить наличие `category` в items.
   - Убедиться, что категории возвращаются и сортируются по `order`.

## Frontend Tasks
1. Types (`web/lib/types.ts`):
   - Добавить `SidebarCategoryDefinition`.
   - Расширить `SidebarNavItem` полем `category`.
2. Helpers (`navigation-helpers.ts`):
   - Group items сначала по module, затем по category.
   - Экспортировать функции `groupSidebarItemsByCategory` для SidebarEditor.
3. `SidebarEditor.tsx`:
   - Отображать категории как подразделы внутри модуля (заголовки, drag-drop в категории).
   - Обновить editable state, чтобы хранить `category`.
4. `AppShell.tsx`:
   - Sidebar: вывод категорий, свернуть/развернуть категории независимо внутри модуля (опционально).
   - ModuleTabs: использовать категорию для формирования вкладок (вкладки = категории).
5. `ModuleTabs.tsx`/`FavoriteToggle` — убедиться в корректных props (скрытые элементы, активные вкладки).
6. Обновить соответствующие тесты/снапшоты (`ModuleTabs.test.tsx`, `SidebarEditor` story/test если есть).

## Docs & Sync
- README (E17) — убрать TODO, описать категории и новое API поле.
- AGENTS.md — статус задачи → `In Progress` (добавлено), по завершении `Done`.
- Добавить краткий changelog в `reports/2025-09-18-modular-navigation-research.md`.

## Open Questions
- Нужно ли API возвращать отдельный список секций для скрытых элементов (editor)? Предлагаю начать с `categories` + `items`.
- Требуется ли миграция сохранённых layout? Сейчас layout хранит только `key`, `hidden`, `position`; категории вычисляются из blueprint — без миграций.

## Timeline
- День 1: Backend payload + tests.
- День 2: Frontend helpers/editor/ModuleTabs.
- День 3: UI polishing, docs, e2e checks.

