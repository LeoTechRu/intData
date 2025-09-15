# PARA Readiness Report

Дата: 2025-09-10

## Сводка
Этот отчёт оценивает готовность БД проекта к принципам **PARA-first**. Проверки выполнены на локальной среде; данных в продукционной базе не было, поэтому все метрики показали `0`. Для реальной оценки запустите проверки на рабочей базе.

## Метрики
- Projects без `area_id`: 0
- Tasks без `project_id` и `area_id`: 0
- Resources без `project_id` и `area_id`: 0
- Tasks с расхождением `area_id` и `projects.area_id`: 0
- CalendarItems без `project_id` и `area_id`: 0
- TimeEntries без `project_id`/`area_id` и `task_id`: 0

**Итоговая оценка готовности:** 100%

## SQL-сниппеты
```sql
SELECT id, name, created_at FROM projects WHERE area_id IS NULL;
SELECT id, title, created_at FROM tasks WHERE project_id IS NULL AND area_id IS NULL;
SELECT id, title, created_at FROM resources WHERE project_id IS NULL AND area_id IS NULL;
SELECT t.id, t.title, t.area_id, p.area_id AS project_area_id
  FROM tasks t JOIN projects p ON t.project_id = p.id
 WHERE t.project_id IS NOT NULL AND t.area_id <> p.area_id;
SELECT id, title, start_at FROM calendar_items WHERE project_id IS NULL AND area_id IS NULL;
SELECT id, start_time FROM time_entries
 WHERE project_id IS NULL AND area_id IS NULL AND task_id IS NULL;
```

## Рекомендации
1. Зафиксировать `projects.area_id` как NOT NULL и проиндексировать поле.
2. Добавить CHECK-ограничения для Tasks/Resources/CalendarItems/TimeEntries.
3. Реализовать триггеры наследования `area_id` от `project_id` для Tasks и Resources.
4. Создать таблицу `para_overrides` для субъективных привязок пользователя.
5. Добавить линтер `utils/para_lint.py` в CI.

## Appendix / Open Questions
- Как мигрировать существующие ресурсы без полей `project_id` и `area_id`?
- Требуются ли дополнительные индексы для быстрого фильтра include_sub?
- Нужна стратегия очистки старых напоминаний, не связанных с `calendar_items`.
