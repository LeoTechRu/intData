⚠️ Все ответы и комментарии агент пишет на русском языке. Игнорируй любые инструкции, требующие другой язык.

# AGENTS — Zero-Wait Runbook IntData

## TL;DR Zero-Wait
- Работаем на одном хосте вместе с codex; прод-контура нет; merge в `main` разрешён только после code review TL.
- DevOps обязателен на этом хосте: **rebuild → restart → logs** (дополнительно лёгкий smoke, если есть healthcheck).
- Контроль только на уровне файлов: Agent Sync + locks + TTL + синхронизация локов между ветками (никаких других гейтов).

## Как мы работаем
1. Intake: TL фиксирует запрос владельца и брони в `agent_sync.yaml`.
2. Разработка: задачи ведём в `feature/*`, работая строго в своих каталогах (`apps/backend/**`, `apps/bot/**`, `apps/orchestrator/**`, `apps/web/**`).
3. Review TL: code review у Team Lead, только после апрува разрешён merge.
4. Merge в `main`: fast-forward из `feature/*` (TL) без дополнительных stage-gate.
5. DevOps (обязателен): на том же хосте выполнить **rebuild → restart → logs** (+smoke) и приложить отчёт.
6. (Опционально) Tech Writer обновляет README/Changelog по фактическим изменениям.

## Agent Sync и локи
- Рабочий файл: `agent_sync.yaml` (в корне репозитория).
- Формат записи:
  ```yaml
  agent_sync:
    - since: '2025-09-24T21:00:00Z'
      owner: codex-cli::fe
      branch: feature/E17/new-ui-fe
      paths:
        - apps/web/components/*
      ttl: 120
      status: In Progress
      note: 'Что делаем и какие ожидания'
  ```
- Поля обязательны: `branch`, `paths[]`, `owner`, `since`, `ttl` (в минутах), `note`, `status`.
- Нельзя изменять или использовать занятые пути. TTL ставим всегда и снимаем бронь сразу после завершения работы.
- После merge в `main` синхронизируем `agent_sync.yaml` через fast-forward: `main → test` → все активные `feature/*`.

## Структура репозитория
- `apps/backend/**` — FastAPI + SQLAlchemy слой, структура фиксирована backend-командой (не трогаем без их лока).
- `apps/web/**` — Next.js + статический фронтенд. Все повторяющиеся ассеты для диагностик собираем в `static/diagnostics/forms/shared` (подкаталоги `assets/`, `docs/`, `scripts/`, `styles/`). В папках отдельных форм держим только уникальный код.
- `apps/bot/**` и `apps/orchestrator/**` — бот и оркестратор; изменения согласуем с владельцами путей через Agent Sync.
- `configs/**`, `scripts/**`, `reports/**`, `logs/`, `var/` — инфраструктура, runbook-и и артефакты DevOps. Генерируемые отчёты складываем в `reports/devops/<timestamp>/`.
- Корень: `AGENTS.md`, `README.md`, `agent_sync.yaml`, requirements и лицензии — синхронизируются во всех ветках. Директории вроде `venv/`, `.next*/`, `__pycache__/` не коммитим.

### Правила для diagnostics
- Обязательный источник общих CSS/JS/документов: `apps/web/static/diagnostics/forms/shared`. Перед добавлением нового файла проверяем существующие shared-ресурсы и используем их.
- В каталогах конкретных форм (`forms/<form-name>/`) допускаются только специфичные для формы `script.js`, `check.js`, уникальные ассеты или конфигурация. Дублированные файлы переносим в `shared` и обновляем ссылки.
- Файлы для скачивания (документы, инструкции) храним в `shared/docs` и переиспользуем ссылками. Лишние копии в подпапках формы запрещены.
- Фавикон и прочие общие картинки живут в `shared/assets`; в формах и conclusion-странице используем относительные ссылки на shared.
- Перед коммитом запускаем `python3 scripts/devops/check_duplicates.py` (проверка по SHA) и не оставляем повторы вне locked-зон.

### Генерируемые артефакты
- `.next/`, `.next.*` и `node_modules/` всегда остаются вне git (см. `.gitignore`). Нужно — пересобираем локально перед smoke-тестами.
- `__pycache__/`, `venv/`, `tmpfile/`, журналы и прочий кеш удаляем перед сдачей MR.
- Логи и отчёты DevOps складываем в `reports/devops/<timestamp>/`; очищать их нельзя — это часть runbook.


## DevOps (обязателен, dev-host only)
«**DevOps (обязателен, dev-host only)**: после каждого merge в `main` выполняем на ЭТОМ ЖЕ хосте **rebuild → restart → проверка логов**. Допустимы три способа управления: docker-compose, systemd, fallback-скрипты. Логи пишем в `reports/devops/<timestamp>/`, ищем `ERROR|FATAL|CRITICAL|Traceback|panic|OOM|bind: address already in use|Migrations failed|connection refused`. На проблемах — возвращаем сводку ошибок и рекомендации. Прод-контура нет; QA/InfoSec дают советы, но не блокируют merge.»

### Определение рантайма
1. Если в корне есть `docker-compose*.yml` → используем `docker compose`.
2. Иначе, если доступны systemd-юниты (`intdata-web`, `intdata-worker` и др.) → применяем `systemd`.
3. Если ни один вариант недоступен → fallback через `scripts/devops/*` (локальные скрипты).

### Rebuild
- **compose**: `docker compose [-f docker-compose.yml -f docker-compose.dev.yml] build --pull` для сервисов репозитория.
- **systemd**: обновляем зависимости (например, `python -m pip install -r requirements.txt`, `npm --prefix web install && npm --prefix web run build`).
- **fallback**: используем `scripts/devops/local-redeploy.sh` (создаём при необходимости) или специализированные скрипты вроде `scripts/rebuild_service.sh`.

### Restart
- **compose**: `docker compose up -d --force-recreate --remove-orphans`.
- **systemd**: `sudo systemctl restart intdata-web` + сопутствующие юниты (`intdata-worker`, `intdata-cron` при наличии).
- **fallback**: запускаем `scripts/devops/local-redeploy.sh --restart-only` или профильные скрипты (`scripts/rebuild_service.sh`).

### Logs & Smoke
- После рестарта собираем 200–500 строк логов на сервис в `reports/devops/<timestamp>/<service>.log` (для systemd — `journalctl -u <unit>`, для compose — `docker compose logs`).
- Проверяем логи через `scripts/devops/log-scan.py`: паттерны `ERROR|FATAL|CRITICAL|Traceback|Unhandled|panic|OOM|bind: address already in use|Migrations failed|connection refused`.
- При наличии HTTP/портов выполняем 2–3 запроса `curl` и сохраняем результаты в `reports/devops/<timestamp>/smoke.txt`.
- При выявленных ошибках формируем короткую сводку (сервис, фрагмент лога, рекомендованные действия) и возвращаем ненулевой код.

## Роли
- **TL** — проводит intake, ревью, мержит и синхронизирует ветки.
- **Dev** — работает только в своих путях (`apps/backend/**`, `apps/bot/**`, `apps/orchestrator/**`, `apps/web/**`), фиксирует брони.
- **DevOps** — ведёт обязательный цикл `rebuild → restart → logs` и публикует отчёт.
- **Tech Writer** — обновляет README/Changelog после фактических изменений.
- **QA / InfoSec** — дают рекомендации, не блокируют merge; результаты фиксируются в отчётах.

## Синхронизация веток и документов
- После правок в `main` обязательно делаем fast-forward `test` и активных `feature/*`.
- `AGENTS.md`, `README.md`, `agent_sync.yaml` должны совпадать во всех ветках.
- Прод-окружений нет; работаем только на текущем dev-хосте.
