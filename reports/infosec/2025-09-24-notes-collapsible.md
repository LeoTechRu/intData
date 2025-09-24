# InfoSec Advisory — TL-2025-09-24-notes-collapsible

## Scope
- Файлы: `web/components/notes/NotesModule.tsx`, `web/components/ui/CollapsibleSection.tsx`, `web/components/notes/NotesModule.test.tsx`.
- Тип изменений: фронтенд UI (React) без серверных эндпоинтов и данных.

## Анализ
- SAST/Secrets: локальный `npm run lint` (ESLint + security plugins) — нарушений нет.
- Данные: новые стейты и DOM-обработчики не обрабатывают чувствительную информацию; запросы к API остаются прежними.
- Валидация: формы используют существующие проверки (`required`), дополнительные UX-секции не обходят валидацию.

## Рекомендации
- **Must:** нет.
- **Should:** добавить e2e-шаг в security regression backlog, чтобы проверять отсутствие утечек данных при сворачивании/раскрытии (совместно с QA).
- **Could:** рассмотреть автоматические тесты Lighthouse/axe для новых секций (a11y).

## Итог
- Advisory неблокирующий, уязвимости не обнаружены.
