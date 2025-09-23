# Runbook — релиз ветки `test` в `main`

## Контекст
- Эпик: E9 «Тесты и документация фичефлаг» (см. README).
- Цель: промоутировать протестированную ветку `test` в продуктивную `main`, задеплоить сервисы и подтвердить доступность.
- Ответственный: Team Lead codex-cli (при участии DevOps и QA).

## Предварительные условия
1. Все фиче-ветки смёрджены в `test`; GitHub Actions `Tests` прошёл успешно на commit'е ветки `test`.
2. CI-деплой тестового контура (`Deploy (test)`) выполнился без ошибок, QA провёл smoke на `https://test.intdata.pro`.
3. В GitHub настроены секреты `TEST_VPS_HOST|USER|KEY`, `TEST_DEPLOY_PATH|USER`, `TEST_WEB_SERVICE`, `TEST_BOT_SERVICE`.
4. В PROD secrets заданы `VPS_HOST|USER|KEY` и сервисы `intdata-web`, `intdata-bot`.
5. Локально выполнен `pytest` (разделённый прогон) и задокументированы результаты.

## Переменные и секреты
| Назначение                | GitHub Secret                    | Примечание |
|---------------------------|----------------------------------|------------|
| Deploy main               | `VPS_HOST`, `VPS_USER`, `VPS_KEY`| Прод окружение |
| Deploy test               | `TEST_VPS_HOST`, `TEST_VPS_USER`, `TEST_VPS_KEY` | Тестовый сервер |
| Custom deploy path        | `TEST_DEPLOY_PATH` *(опц.)*      | Дефолт `/sd/intdata-test` |
| Custom deploy user        | `TEST_DEPLOY_USER` *(опц.)*      | Дефолт `deploy` |
| Systemd сервис (web)      | `TEST_WEB_SERVICE` *(опц.)*      | Дефолт `intdata-test-web` |
| Systemd сервис (bot)      | `TEST_BOT_SERVICE` *(опц.)*      | Дефолт `intdata-test-bot` |
| Pytest Postgres           | `TEST_DATABASE_URL` или `TEST_DB_*` | Для локального/CI прогона |
| Telegram тестовый бот     | `TEST_BOT_TOKEN`, `TEST_BOT_USERNAME` | Не хранить в коде |
| Telegram тест админы      | `TEST_ADMIN_TELEGRAM_IDS` | Для доступа в тестовом контуре |

## Процедура release (`test` → `main`)
1. **Заморозить `test`**: TL объявляет code freeze, проверяет незакрытые PR.
2. **Фиксация commit'а**: убедиться, что `origin/test` и локальная `test` синхронизированы.
3. **Merge в main**: выполнить `git checkout main && git pull && git merge --ff-only origin/test`.
4. **Push**: `git push origin main`. Убедиться, что стартовал workflow `Deploy`.
5. **Мониторинг CI**: дождаться успешного завершения `Deploy`.
6. **Smoke на проде** (QA):
   - `/` (дашборд) открывается, виджеты подгружаются.
   - `/notes` и `/crm/products` отвечают 200.
   - API `/api/v1/health` возвращает `ok`.
   - Бот `@intDataBot` отвечает на `/start`.
7. **Мониторинг**: проверить `journalctl -u intdata-web -n 200` и `journalctl -u intdata-bot -n 200`.
8. **GateRecord**: TL фиксирует Gate-4/5 в `docs/reports/YYYY-MM-DD-gaterecord-<scope>.md`.
9. **Changelog & Tasklist**: Tech Writer отмечает релиз в README и `docs/CHANGELOG.md` (если требуется публичная запись).

## Smoke чек-лист (тестовый контур)
1. `https://test.intdata.pro/api/v1/health` → `{"status":"ok"}`.
2. Авторизация через Magic Link отправляет письмо (можно на тестовый почтовый ящик).
3. `/notes` отображает карточки Inbox и позволяет открыть архив.
4. `/crm/products` загружает продукты и тарифы.
5. Telegram `@intDataTestBot` отвечает `/ping`.

## Rollback
1. Если деплой main неуспешен — остановить `intdata-web`/`intdata-bot` (`sudo systemctl stop ...`) и выполнить `git reset --hard <предыдущий commit>` на сервере.
2. Перезапустить сервисы и подтвердить откат.
3. Задокументировать инцидент в README («Инциденты») и завести задачу на устранение причин.

## Журнал
- 2025-09-20 — добавлен автоматический деплой ветки `test` и runbook; ответственный codex.
- 2025-09-23 — выполнен релизный fast-forward `test -> main` (коммит `d10c2a1`), подтверждён новый Trivy, GateRecord обновлён.
