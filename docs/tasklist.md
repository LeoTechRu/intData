# Tasklist Template

`tasklist.md` отражает конкретные задачи, вытекающие из текущего `vision.md`. Это «оперативный» список, которым руководствуются агенты при планировании.

## Формат записи
```
## <Инициатива / эпик>
- [ ] <ID задачи> — краткое описание (ответственный, ожидания, ссылки)
```

### Правила ведения
1. Задача появляется в tasklist только после того, как идея описана в `vision.md`.
2. В каждой задаче делайте ссылки на эпик в `docs/BACKLOG.md` и, при необходимости, на конкретные разделы `vision.md`/`conventions.md`.
3. После завершения ставьте отметку `[x]` и добавляйте ссылку на PR/коммит.
4. Если задача разбивается — создайте подпункты или новую секцию и синхронизируйте с BACKLOG.

## Текущий список

## E17: Frontend Modernization
- [ ] TL-2025-09-18-nav-blueprint — Расширить NAV_BLUEPRINT и API `/api/v1/navigation/sidebar*` полями модулей и секций (owner: codex, ветка `feature/E17/menu-grouping-codex`, см. vision «Modular Navigation»).
- [ ] TL-2025-09-18-appshell-modules — Перестроить AppShell и SidebarEditor: секции + collapsible, единый список избранных страниц без дублей (owner: codex, ветка `feature/E17/menu-grouping-codex`).
- [ ] TL-2025-09-18-module-tabs — Добавить верхние вкладки модулей и компонент FavoriteToggle, управляющий видимостью страниц в меню (owner: codex, ветка `feature/E17/menu-grouping-codex`).
- [x] TL-2025-09-18-bot — Восстановить публичный лендинг `/bot` на Next.js (agent: codex, ветка `feature/E17/bot-landing-codex`).
- [x] TL-2025-09-18-groups — Перенести `/groups`, `/groups/manage/{id}` и `/products` на Next.js, добавить тултипы `TermHint`, удалить legacy-шаблоны и `ui_router` (agent: codex, ветка `feature/E17/groups-products-ui-codex`).
- [x] TL-2025-09-18-support — Обновить лендинг `/tariffs` (кликабельное сообщество, упоминания поддержки) и добавить условные кнопки поддержки в AppShell (agent: codex, ветка `feature/E17/groups-products-ui-codex`).
- [x] TL-2025-09-18-legacy-final — Завершить перенос legacy-страниц: включить `/products` и `/groups` в AppShell, перевести `/ban` и `/cup/admin-embed` на Next.js, удалить Jinja-шаблоны и статические JS/CSS (agent: codex, ветка `feature/E17/legacy-migration-codex`).
- [x] TL-2025-09-18-mobile-ui — Подточить мобильную адаптивность AppShell и дашборда (`/`): убрать чип роли на узких экранах, перестроить сетку шапки, скрыть редактор дашборда (agent: codex, ветка `feature/E17/mobile-responsive-ui-codex`).

## E18: CRM Knowledge Hub
- [x] TL-2025-09-18-crm-blueprint — Подготовить архитектурный план CRM (PARA × Zettelkasten), описать автоматизации и данные в `docs/vision.md` (owner: codex, epic E18).
- [x] TL-2025-09-19-crm-ddl — Добавить DDL для продуктов, тарифов, версий, сделок, подписок и коммуникаций (`core/db/ddl`, SCHEMA, repair); обеспечить наследование PARA и отсутствие новой таблицы для клиента (owner: codex).
- [x] TL-2025-09-19-crm-services — Реализовать `core/services/crm` (products, deals, accounts, subscriptions, automations) с поддержкой upgrade/downgrade потоков (owner: codex).
- [x] TL-2025-09-19-crm-ui — Собрать модуль `/crm` (deals канбан, accounts, products с тарифами/потоками, analytics), перенести legacy `/products` и добавить knowledge panel (owner: codex).
- [x] TL-2025-09-19-auth-multichannel — Обновить авторизацию (username/email/телефон) и UI-автодетект режима, синхронизировать API/бот (owner: codex).
