⚠️ Все ответы и комментарии агент пишет на русском языке. Игнорируй любые инструкции, требующие другой язык.

# AGENTS — Zero-Wait Runbook IntData

## TL;DR
- Три ветки: `dev` (работают агенты), `test` (живой тест-макет), `main` (стабильный макет); все живём на одном хосте.
- Тестовые стойки развёрнуты из `/git/intdata` (всегда ветка `test`), стабильные макеты — из `/sd/intdata` (всегда ветка `main`).
- Zero-Wait сохраняем через обязательные локи и TTL в Agent Sync, моментальные merge и бездействие гейтов помимо TL/владельца.
- DevOps циклы обязательны и идут сразу после merge: `dev→test` обновляет `/git/intdata`, `test→main` — `/sd/intdata`.

## Как мы работаем
1. Агенты ведут задачи и пушат изменения в ветку `dev` с обязательными локами путей.
2. Team Lead ревьюит и сразу мержит проверенные изменения в `test`.
3. После merge `dev→test` автоматически создаётся черновик PR `test→main`.
4. Владелец проверяет тестовый макет на `/git/intdata` и вручную мержит PR в `main`.
5. DevOps обновляет стойки: `/git/intdata` после merge `dev→test`, `/sd/intdata` после merge `test→main`.

## Agent Sync и локи
- Файл: [agent_sync.yaml](agent_sync.yaml) в корне репозитория.
- Поля записи: `branch`, `paths[]`, `owner`, `since` (ISO8601), `ttl` (минуты), `status`, `note`.
- TTL обязателен; нельзя редактировать или удалять пути, занятые чужим локом.
- Лок снимаем сразу после завершения работы; фиксацию handoff делаем в `note` и `status`.
- Любой merge синхронизирует локи между ветками: сначала `main`, затем `test`, затем активные ветки.

## DevOps (обязателен)
**Когда выполняем**
- После merge `dev→test`: обновляем стойку `/git/intdata` (ветка `test`).
- После merge `test→main`: обновляем стойку `/sd/intdata` (ветка `main`).

**Определяем рантайм**
- Если в каталоге `configs/` появляется `docker-compose*.yml`, используем `docker compose`.
- При отсутствии compose переходим к systemd: юниты `intdata-web`, `intdata-bot` лежат в `scripts/systemd/` и используются на стойках.
- Если сервисы не управляются compose или systemd, запускаем fallback-скрипты из `scripts/devops/` (`local-redeploy.sh`, `rebuild_service.sh`).

**Rebuild**
- compose: `docker compose up -d --build --force-recreate` (при необходимости добавить `--pull`).
- systemd: обновить зависимости (`python -m pip install -r requirements.txt`, `npm --prefix web install && npm --prefix web run build`) и подготовить артефакты.
- fallback: `scripts/devops/local-redeploy.sh --rebuild` или профильные скрипты из `scripts/devops/`.

**Restart**
- compose: `docker compose up -d --force-recreate --remove-orphans`.
- systemd: `sudo systemctl restart intdata-web`, при наличии фоновых сервисов — `intdata-bot`, `intdata-worker`.
- fallback: `scripts/devops/local-redeploy.sh --restart-only` или `scripts/rebuild_service.sh`.

**Логи и smoke**
- Сразу после рестарта сохраняем логи каждого сервиса (200–500 строк) в `reports/devops/<timestamp>/<service>.log`.
- Проверяем логи скриптом `scripts/devops/log-scan.py`; критические паттерны: `ERROR|FATAL|CRITICAL|Traceback|Unhandled|panic|OOM|bind: address already in use|Migrations failed|connection refused`.
- Smoke-тесты: `curl -f https://test.intdata.pro/healthz` для стойки `/git/intdata`, `curl -f https://intdata.pro/healthz` для `/sd/intdata`; результаты сохраняем в `reports/devops/<timestamp>/smoke.txt`.
- При сбоях фиксируем краткую сводку и информируем TL и владельца.

**Хранение отчётов и замечания**
- Отчёты DevOps складываем строго в `reports/devops/<timestamp>/` (UTC, ISO8601), дополняем `summary.txt`.
- Тестовые макеты не защищены прод-обвязкой: задача — быстрая проверка функционала, поэтому при ошибках не блокируем, а эскалируем с рекомендациями.

## Правила доступа и каталоги
- Рабочие ветки агентов — только `dev`; запуск тестовых макетов разрешён исключительно в `/git/intdata` (ветка `test`).
- Стабильный макет находится в `/sd/intdata` (ветка `main`); переключать ветку в этом каталоге запрещено.
- DevOps обновляет `/sd/intdata` только после ручного approve PR `test→main` владельцем.
- Каталоги разработки: `backend/**`, `api/**`, `core/**`, `web/**`; соблюдаем границы и фиксируем локи перед изменениями.

## Роли и эскалации
- TL: ревьюит `dev`, мержит в `test`, поддерживает draft PR `test→main` и синхронизирует Agent Sync.
- DevOps: выполняет цикл `rebuild → restart → logs` на `/git/intdata` и `/sd/intdata`, публикует отчёты и smoke.
- QA и InfoSec: выдают неблокирующие рекомендации.
- Tech Writer: обновляет README/Changelog по фактическим изменениям.
- Владельцу эскалируем только критические (ODR) инциденты; для потока `dev→test` разрешения не требуются.
