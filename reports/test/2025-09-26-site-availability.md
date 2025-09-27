# Site Availability QA — 2025-09-26

## Scope
- Приложение Next.js в `apps/web/` (prod build, app router)
- Все страницы уровня `app/**/page.tsx`, включая динамические сегменты с тестовыми slug

## Методика
1. `npm run build` (Next 15.5.2) — сборка прошла без ошибок.
2. `PORT=3200 npx next start` — поднят production-сервер; логи сохранены в `reports/test/2025-09-26-site-availability-start.log`.
3. Скрипт на `python3` сформировал список маршрутов из `apps/web/app/**/page.tsx` и запросил каждый URL через `curl -L` (следуем редиректам).
4. Результаты статусов собраны в TSV `reports/test/2025-09-26-site-availability.tsv`.

## Итоги
- 34 маршрута возвращают HTTP 200 после следования редиректам (`/crm`, `/pricing`, `/products` перенаправляют на рабочие страницы).
- Динамические страницы (`[slug]`, `[groupId]`) проверены с placeholder-значениями и успешно рендерятся без SSR-ошибок.
- Серверные логи без ошибок; фиксирована единственная warning от Next: "static directory deprecated".

## Рекомендации
- Перенести содержимое `apps/web/static/` в `apps/web/public/`, чтобы убрать предупреждение Next.js о deprecated static directory.

## Артефакты
- Таблица статусов: `reports/test/2025-09-26-site-availability.tsv`
- Логи запуска сервера: `reports/test/2025-09-26-site-availability-start.log`
