# 2025-09-19 — Консолидация документации

## Итог правок
- `README.md`: перенёс backlog/idea/vision/conventions/workflow/tasklist/changelog в единый источник для владельца.
- `AGENTS.md`: обновил правила агентов, указал, что стратегический контент живёт в README, сохранил Agent Sync.
- `docs/*.md` (backlog, changelog, idea, vision, conventions, workflow, tasklist): перевёл в архивный режим с ссылкой на новые секции README.

## Diff (сокращённый)

```diff
$(git diff AGENTS.md README.md docs/BACKLOG.md docs/CHANGELOG.md docs/conventions.md docs/idea.md docs/tasklist.md docs/vision.md docs/workflow.md)
```

> Для применения: `git apply docs/reports/2025-09-19-docs-consolidation.patch` (потребуется вручную собрать патч из diff выше).
