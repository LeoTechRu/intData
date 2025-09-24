# Архитектура Bitrix24-стиля навигации (E17)

## Контекст и цели
- Реплицировать UX Bitrix24 для AppShell: левый бар с модулями и скрытыми страницами + верхняя полоска с табами выбранного модуля.
- Соблюсти AC-1..AC-9, включая drag-and-drop, primary tool, персональные/глобальные раскладки и адаптив.
- Подготовить реализацию без изменения backend-контрактов, но расширение layout merge: поддержка primaryModule и customLinks.

## Текущая реализация (2025-09-24)
- `SmartSidebar` уже использует `@dnd-kit` для модулей/страниц, но рендерит карточки c заголовками, отдельные "Скрытые" per-модуль и нет collapsed режима.
- Верхняя панель через `ModuleTabsBar`: badge модуля + табы + профиль; содержимое включает заголовки страницы в `AppShell`.
- Layout merge отсутствует: `AppShell` получает items из `/api/v1/navigation/sidebar`; пользовательские/глобальные настройки пишутся напрямую через `navigation-layout` utilities.

## Данные и API
- Расширяем `NavItem`, `ModuleDef`, `SidebarLayout` (см. промпт): primaryModule, customLinks, явные orders.
- Новый API-слой (frontend):
  - `GET /api/v1/ui/sidebar/layout?scope=user|global` → `{ layout: SidebarLayout, version, canEditGlobal }`.
  - `POST /api/v1/ui/sidebar/layout?scope=...` → сохраняет layout.
- Фронтенд util `mergeSidebarLayout(global, user)` → возвращает `{ modules, items, primaryModule }` объединяя глобальный порядок и пользовательские overrides.
- `computeHidden(items)` собирает скрытые элементы в один массив для "Скрытых страниц".
- `moduleDefaultTargets` заполняется из первого видимого href внутри модуля (учитывает custom links).
- `useModuleTabs({ moduleId })` опирается на merged layout: табы = items выбранного модуля (включая customLinks), без скрытых.

## Состояния левого меню
1. **Collapsed** (`isSidebarCollapsed === true`)
   - width `w-[56px]`; иконки модулей; тултипы через aria-label + data-tooltip.
   - Кнопка-бургер в TopNavBar переключает состояние.
2. **Expanded**
   - width `w-[248px]`; отображение label, видимых страниц, кнопка "Настроить меню".
   - Секция "Скрытые страницы" одна, внизу: списком hiddenItems; действия "Показать" → `onToggleHidden(false)`.
3. **Edit mode** (вызов SidebarEditor)
   - overlay `SidebarConfigurator`: drag сортировка модулей/страниц, чекбоксы hide, кнопка "Добавить ссылку" → вставка custom link в выбранный модуль/корень.
   - Select primary tool.
   - Actions: `Сохранить персонально` (`POST scope=user`), если `viewer.role === 'admin'` → `Применить для всех` (`POST scope=global`).

## Компоненты
- `AppShell`
  - Считывает global/user layouts, merge → `effectiveLayout`.
  - Вычисляет `moduleGroups` из merged items (поддерживает customLinks и hidden flag).
  - `allHiddenItems` memo → передаём в `LeftSidebar`.
  - Больше не выводит `title`/`subtitle` в TopNav; контентные заголовки остаются внутри страниц при необходимости.
  - State `isSidebarCollapsed` хранится локально (persist в `localStorage` через `useLocalStorageState`).
- `LeftSidebar`
  - Управляет collapsed/expanded стилями, renders modules list + hidden section + configure button.
  - Клик по модулю → `handleModuleSelect` (router push на default target).
  - Drag-and-drop делегируется `SidebarConfigurator` (внутри overlay).
- `TopNavBar` (новый вместо ModuleTabsBar)
  - Layout: `flex h-12 items-center bg-[var(--header-bg,#0b66ff)] text-white px-4`.
  - Left: burger (toggles sidebar), ModuleTabs (scrollable), Right: `UserSummary`.
- `ModuleTabs`
  - Принимает `items` (>=1) → горизонтальный scroll container, active tab = filled pill (#0b66ff), остальные hover lighten.
  - Mobile `<768px`: `overflow-x-auto`, gradient mask edges.
- `SidebarConfigurator`
  - Reuse `@dnd-kit` logic из `SmartSidebar`, но отдельный экран с tabs `Модули` / `Пункты` не требуется — один canvas.
  - Form controls: switch primary tool, per-item hide checkbox, button add custom link (modal).
  - Оптимистическое обновление: локально изменяем state, затем POST, invalidate queries.

## Алгоритмы порядка и merge
1. `mergeSidebarLayout(globalLayout, userLayout)`
   - Стартуем из `base = sortBy(order)` глобальных модулей/items.
   - Если `user.primaryModule` → ставим модуль первым, иначе используем `global.primaryModule`.
   - Для каждого item: apply user overrides (`order`, `hidden`), fallback на global.
   - Custom links объединяются: `global.customLinks` + `user.customLinks` (user может переопределить label/icon по key).
2. `computeHidden(items)`
   - Собирает все items `hidden=true`. Возвращает `[NavItem]` уникальные по key (Map) чтобы исключить дубликаты.
3. Drag reorder
   - Modules: `handleModulesReorder(nextOrder)` обновляет локальный layout state и вызывает POST.
   - Items: `handleItemsReorder(moduleId, itemKeys)` обновляет layout для данного модуля.
4. `primaryModule`
   - В редакторе переключатель: обновляет `layout.primaryModule` (user/global).
   - При merge первый модуль = primary (если существует), иначе order by `order`.

## Доступность
- Сайдбар: `nav` with `role="navigation"`, `aria-label="Основная навигация"`.
- Модули: `button` с `aria-pressed`, `aria-keyshortcuts` (Alt+Shift+number) optional (follow-up).
- Hidden toggle: `aria-expanded` на секции "Скрытые страницы".
- ModuleTabs: `role="tablist"`? Bitrix style uses nav; останемся на `nav` + `aria-current` для active.
- Keyboard: ArrowUp/Down циклически по модулям, Home/End jump, Space/Enter select; Tab order сохраняет бургер → табы → профиль.

## Риски и допущения
- Бэкенд контракт `/api/v1/ui/sidebar/layout` готов/подготовим (если backend ещё не готов — потребуется временный bridge к текущим endpoints).
- Custom link icon set ограничен существующими `NavIcon`; потребуется mapping (fallback `nav-custom`).
- Перенос `SmartSidebar` в редактор: следить за bundle size `@dnd-kit`; lazy load редактора через dynamic import.

## Follow-ups
- e2e сценарии (Cypress/Playwright) для меню (mobile & desktop) — оформить в QA backlog.
- Документация: README Tasklist обновить после реализации.
- Если backend merge задержится, добавить feature flag `enableBitrixNav`.
