# Руководство: запуск codex-cli и работа несколькими сессиями

## Подготовка окружения
1. Обновите репозиторий и зависимости:
   ```bash
   git fetch --all
   git checkout main
   git pull
   ```
2. Убедитесь, что рабочее дерево чистое (`git status`). Если есть чужие незакоммиченные файлы — свяжитесь с владельцем.

## Как запускать новую сессию codex-cli
1. Откройте `reports/archive/BACKLOG.md` и раздел *Agent Sync*.
2. Если ваша задача свободна:
   - Зарезервируйте её в таблице Agent Sync (укажите позывной, ветку, ключевые файлы, UTC-время).
   - Создайте рабочую ветку: `git checkout -b feature/<epic>/<scope>-<прозвище>`.
3. Если задача уже занята — дождитесь, пока владелец освободит запись, либо согласуйте порядок.
4. Запускайте codex-cli уже после того, как резерв оформлен.

## Что писать в промпте codex-cli при старте
В начале каждой сессии передайте агенту базовый набор инструкций:
```
Ты работаешь в ветке feature/<...>. Прочитай AGENTS.md и следуй разделу Multi-Session Workflow. 
1. Обнови Agent Sync (если ещё не обновлено).
2. Не изменяй файлы, которых нет в моей броне.
3. Прежде чем писать код, посмотри reports/archive/idea.md → vision.md → tasklist.md → workflow.md → conventions.md.
4. По завершении создай коммит и push, обнови Agent Sync и tasklist.
```
Дополнительно перечислите конкретные файлы и задачи из `tasklist.md`, чтобы ограничить контекст.

## Завершение работы
1. Выполните обязательные проверки (lint/build/tests согласно AGENTS.md).
2. Зафиксируйте изменения (`git commit`, `git push`).
3. Обновите Agent Sync и `reports/archive/tasklist.md`/`reports/archive/CHANGELOG.md` при необходимости.
4. Снимите замок/бронь.

## Полезные ссылки
- [AGENTS.md](../AGENTS.md)
- [idea.md](../idea.md)
- [vision.md](../vision.md)
- [conventions.md](../conventions.md)
- [tasklist.md](../tasklist.md)
- [workflow.md](../workflow.md)
