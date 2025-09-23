# AGENTS - Stage-Gate Playbook IntData

## TL;DR
- AGENTS Spec v1.2 (2025-09-19): Intake (TL) -> Архитектура -> Реализация -> PR в `test` (merge делает TL) -> QA на `test` (PR с path-guard) -> InfoSec advisory (неблокирующий) -> DevOps release (TL fast-forward `test->main`) -> Tech Writer.
- Лучшие практики IntBridge (router, handoff, role-boundary-check, YAML `agent_sync` с TTL) совмещаем с git-потоком IntData (`feature/*` -> PR -> `test` -> fast-forward -> `main`).
- QA работает только в общей ветке `test`; InfoSec выдаёт неблокирующие рекомендации between QA и DevOps; на каждом gate присутствует двойной контроль TL.
- Все роли поддерживают README-вортонку (idea -> vision -> conventions -> tasklist -> workflow), фиксируют handoff и GateRecord, обновляют `agent_sync`.

## Почему stage-gate и что объединено
1. **Router + handoff (IntBridge)** - TL маршрутизирует задачи, выдаёт карточки, контролирует lock-и и TTL.
2. **Git-дисциплина (IntData)** - разработка живёт в `feature/*`, merge в `test`/`main` делает только TL, релизы = fast-forward.
3. **QA в `test`** - единая ветка даёт общий контекст, QA не трогает продуктивный код, работает через path-ограниченные PR.
4. **InfoSec advisory** - security-analyzers не блокируют релиз, но формируют обязательные follow-ups.
5. **GateRecord и двойной контроль** - на каждом переходе TL проверяет AC, границы ролей и обновление funnel.
6. **Глобальный `agent_sync`** - одна таблица броней, TTL и locks; правки `AGENTS.md` и `agent_sync.yaml` синхронизируются во всех ветках сразу.

## Stage-Gate pipeline (обязательно соблюдаем)
0. **Funnel upkeep** - постоянная синхронизация README/Agent Sync, фиксация идеи -> vision -> conventions -> tasklist -> workflow.
1. **Intake / TL-Gate-0** - TL принимает запрос владельца, формирует intake, проверяет артефакты, записывает в Agent Sync.
2. **Architecture / TL-Gate-1** - Architect подтверждает инварианты, обновляет ADR/Conventions, описывает технические рамки.
3. **Decomposition & Routing / TL-Gate-2** - TL делит работу на TaskCards, назначает роли и ветки `feature/<epic>/<task>-<role>`.
4. **Implementation / TL-Gate-3** - BE/FE работают в своих путях, покрывают тестами, создают PR в `feature/*`, TL делает code review.
5. **Merge to test & QA** - TL мержит одобренные PR в `test`; QA работает через PR в `test` с лейблом `qa:test-only` (path-guard `tests/**`, `reports/test/**`).
6. **InfoSec Advisory / TL-Gate-4** - InfoSec запускает SAST/SCA/Secrets/DAST, публикует отчёт и рекомендации.
7. **DevOps Release / TL-Gate-5** - DevOps готовит runbook, миграции, smoke; TL fast-forward `test->main`.
8. **Documentation / TL-Gate-6** - Tech Writer обновляет README/Changelog/Workflow, фиксирует ссылки и заключает итерацию.

## Ролевые каталоги и системные промпты
Каждая роль работает по TaskCard, ведёт handoff и обновляет Agent Sync. TL подписывает GateRecord только после проверки AC/границ роли.

### Team Lead / Router
- **Зона ответственности:** intake, декомпозиция, ревью, merge, funnel upkeep, контроль Agent Sync.
- **Запреты:** продуктивный код (кроме аварий). Все обращения к владельцу идут через TL.
- **Промпт:**
> Вы - Team Lead/Router IntData. Работаете по stage-gate: Intake -> Архитектура -> Реализация -> PR в `test` -> QA -> InfoSec -> Release -> Documentation. Назначаете роли по путям, контролируете Agent Sync и GateRecord, единолично мержите в `test` и `main`.
- **Definition of Done:** intake/TaskCards готовы, GateRecord оформлен на каждом этапе, релиз `test->main` закрыт, README/Agent Sync синхронизированы, follow-ups заведены.

### Architect
- **Зона:** `reports/arch/**`, ADR, схемы интеграций, conventions.
- **Запреты:** продуктивный код.
- **Промпт:**
> Вы - Architect IntData. Уточняете инварианты, обновляете ADR/Conventions, фиксируете требования для BE/FE, риски и зависимые сервисы. При необходимости реализации - handoff TL.
- **DoD:** ADR/Conventions обновлены, инженерные решения и риски описаны, handoff разработке оформлен.

### Backend Developer
- **Зона:** `backend/**`, `core/**`, миграции БД, OpenAPI, scripts.
- **Запреты:** UI, инфраструктура.
- **Промпт:**
> Вы - Backend IntData. Работаете только в `backend/**` и `core/**`, обновляете OpenAPI/SCHEMA, покрываете тестами, готовите handoff QA/TW.
- **DoD:** тесты зелёные, OpenAPI/SCHEMA экспортированы, handoff QA/TW заполнен, GateRecord подписан.

### Frontend Developer
- **Зона:** `web/**` (Next.js UI, Tailwind, витрина).
- **Запреты:** backend, инфраструктура.
- **Промпт:**
> Вы - Frontend IntData. Меняете только `web/**`, соблюдаете UI-guidelines, фиксируете скриншоты и сторибуки, handoff QA/TW.
- **DoD:** сборка/линт зелёные, UI адаптивен, скриншоты приложены, GateRecord подписан.

### QA
- **Зона:** `tests/**`, `reports/test/**`.
- **Промпт:**
> Вы - QA IntData. Работаете через PR в `test` (path-guard на `tests/**`, `reports/test/**`). Подтверждаете AC, оформляете отчёт и handoff TL/TW.
- **DoD:** тест-кейсы и фикстуры актуальны, отчёт приложен, дефекты заведены через TL, GateRecord `qa` подписан.

### InfoSec Advisory
- **Зона:** `reports/infosec/**`, конфиги сканеров.
- **Промпт:**
> Вы - InfoSec Advisory IntData. Запускаете SAST/SCA/Secrets/DAST, публикуете неблокирующий отчёт (must/should/could), уведомляете TL о follow-ups.
- **DoD:** отчёт загружен, риски классифицированы, GateRecord `infosec` подписан TL.

### DevOps/SRE
- **Зона:** `.github/**`, `config/**`, docker/compose, scripts/deploy, observability.
- **Промпт:**
> Вы - DevOps/SRE IntData. Настраиваете CI/CD, окружения, runbook, готовите выпуск `test->main`, обеспечиваете бэкапы и мониторинг.
- **DoD:** пайплайны зелёные, runbook и smoke-checklist заполнены, миграции idempotent, GateRecord `release` подписан.

### Tech Writer
- **Зона:** `README.md`, `reports/**` (кроме infosec), Changelog.
- **Промпт:**
> Вы - Tech Writer IntData. Закрываете стадию Documentation stage-gate от лица технического писателя codex-cli. Перед началом сверяете README funnel, GateRecord и agent_sync. Во время работы:
> - обновляете README (Vision/Conventions/Tasklist/Workflow) и Changelog, поддерживая русскоязычный контент и единые ссылки на PR/коммиты;
> - структурируете `reports/**` (runbook, QA/InfoSec summaries, ADR), убеждаясь, что новые материалы оформлены там, а каталог `docs/` не возрождается;
> - контролируете, чтобы AC, рекомендации QA/InfoSec и договорённости DevOps отражались в README и соответствующих отчётах `reports/**`;
> - синхронизируете изменения `README.md`, `AGENTS.md` и `agent_sync.yaml` между `main`, `test` и всеми активными ветками `feature/*`.
> Завершаете работу после того, как TL принял GateRecord `docs`, CI-гейты зелёные, а README/AGENTS побайтно совпадают во всех ветках.
- **DoD:** документация актуальна, README и AGENTS зеркалированы, ссылки добавлены, GateRecord `docs` подписан.

## Форматы для codex-cli
Используем унифицированные шаблоны (YAML):

### Intake
```yaml
intake:
  source: owner
  initiative: "E?/IB-??"
  task: "TL-YYYY-MM-DD-..."
  goal: "что меняется для пользователей"
  acceptance:
    - измеримый критерий
  constraints:
    - срок / совместимость / риск
  artifacts_expected:
    - path: path/to/*
      type: code|test|doc|config
```

### Handoff между ролями
```yaml
handoff:
  from: teamlead|architect|backend|frontend|qa|infosec|devops|writer
  to:   <роль-получатель>
  initiative: E?/IB-??
  task: TL-YYYY-MM-DD-...
  context: |
    фабула, риски, ссылки
  artifacts:
    - path: ...
      note: зачем адресату
  acceptance:
    - критерий #1
  blockers:
    - если есть препятствия
```

### Gate check (TL двойной контроль)
```yaml
gate_check:
  gate: 1|2|3|4|5|6
  role_owner: <роль, завершившая этап>
  tl_checklist:
    - AC закрыты
    - границы роли соблюдены (role-boundary-check)
    - README/agent_sync обновлены
  status: pass|fail
  notes: "если fail - что исправить"
```

### Agent Sync entry
```yaml
agent_sync_entry:
  when_utc: "2025-09-19T21:50:00Z"
  agent: "codex-cli::<call-sign>"
  branch: "feature/E9/test-postgres-env-be"
  locks:
    - path: "core/services/*"
  status: "In Progress | Review | Blocked | Handoff | Done"
  ttl_minutes: 120
  note: "краткое описание работ"
```

### GateRecord
```yaml
gate:
  stage: qa|infosec|release|docs
  tl_check:
    approved: true
    by: "@teamlead"
    when_utc: "2025-09-20T07:45:00Z"
  notes: |
    решения, риски, follow-ups
```

## Branch & CI Guardrails
- Все реализации живут в `feature/<epic>/<task>-<role>`.
- Merge в `test` и `main` выполняет только TL (fast-forward, без merge-commit).
- QA создаёт PR в `test` с path-guard на `tests/**` и `reports/test/**` + лейбл `qa:test-only`; GitHub Action `qa-tests-only-check` блокирует любые другие пути.
- Каталог `docs/` запрещён. CI job `docs_folder_guard` валит любой PR, затрагивающий `docs/**`, и проверяет отсутствие каталога в дереве.
- README (русский) — единственный человекочитаемый источник для владельца; техотчёты, ADR, runbook и гайды живут в `reports/**`.
- CODEOWNERS: `tests/** -> @qa`, `backend/** -> @backend`, `web/** -> @frontend`, `config/** -> @devops`, `reports/** -> @techwriter`, `AGENTS.md -> @teamlead`.
- CI цепочка включает: `docs_folder_guard`, `readme_ru_check`, `links_check`, `role-boundary-check`, lint/test/build, OpenAPI/SCHEMA sync, `infosec-advisory` (semgrep/bandit/trivy) и release-runbook smoke.
- Правки `README.md`, `AGENTS.md` и `agent_sync.yaml` сразу распространяем во все активные ветки (`feature/*`, `test`, `main`). TL отклоняет PR, если файлы расходятся.
- Любой PR, затрагивающий `README.md` или `AGENTS.md`, обязан содержать байтово идентичную копию файлов из `main`; пайплайн завершается ошибкой при расхождении.


## Documentation Policy
- `README.md` в ветке `main` — каноническая версия. Контент поддерживается на русском языке и отражает funnel владельца (Idea → Vision → Conventions → Tasklist → Workflow).
- Перед стартом сессии агент сравнивает README между `main`, `test` и своей рабочей веткой. Любые расхождения устраняем немедленно (fast-forward или sync-коммит).
- Пользовательские и управленческие документы ведём только в README. Добавление новых файлов для владельца запрещено.
- Технические отчёты, ADR, runbook, QA/InfoSec отчёты размещаем в `reports/**`; язык материалов свободный.
- Любые ссылки вида `docs/...` считаются ошибкой. Исторические материалы лежат в `reports/archive/` и помечаются как архивные.
- Tech Writer отвечает за зеркалирование README/AGENTS и контроль CI-гейтов (`docs_folder_guard`, `readme_ru_check`, `links_check`).

## Sync Policy (README.md + AGENTS.md + agent_sync.yaml)
- Источник истины: `README.md` и `AGENTS.md` в `main`. Любые правки действительны только после попадания в `main` и проходят TL review.
- Немедленная зеркализация: сразу после обновления `README.md` или `AGENTS.md` в `main` файлы синхронно переносим в `test` и все активные `feature/*` (fast-forward или отдельный sync-коммит). Содержимое обязано быть побайтно одинаковым.
- Проверка при старте: перед началом новой сессии агент сравнивает локальные `README.md` и `AGENTS.md` с `main`. При расхождении — остановиться и выполнить sync (или оформить REASSIGN на TL).
- `agent_sync.yaml` хранится в корне репозитория и действует глобально. Любой lock распространяется межветочно. Попытка редактировать залоченный путь — нарушение процесса; если без файла нельзя работать, оформляйте handoff/отклонение через TL с указанием причин.
- После merge в `main` запускаем `scripts/sync-docs.sh`, чтобы автоматизированно обновить `test` и все ветки `feature/*`.

## Agent Sync & Multi-session
- Agent Sync — единый межветочный GateLog. Перед стартом бронируйте ветку и список путей, указывайте TTL (UTC). Используем фиксированные статусы: `In Progress | Review | Blocked | Handoff | Done`.
- Locks обязательны: пока путь указан в locks, никакая роль не редактирует его ни в одной ветке. Для разблокировки обновите запись (`Handoff` или `Done`) либо оформите REASSIGN через TL.
- Если TTL истёк и запись не обновлена, TL вправе снять бронь и перераспределить работу.
- Завершая этап, выполняйте push, обновляйте статус, добавляйте GateRecord/hand-off и отражайте изменения в README/Changelog.
- Все sync-операции с `AGENTS.md` и `agent_sync.yaml` проводим централизованно согласно Sync Policy.

## Session continuity & recovery
- Работайте через `tmux`/`screen` и сохраняйте `.codex_sessions/<session-id>.json` (роль, ветка, план, инструкции); обновляйте файл после каждого gate.
- При обрыве SSH найдите в `~/.codex/log/codex-tui.log` последнюю запись `session_meta`, восстановите план через `update_plan`, затем перепроверьте Sync Policy, locks и только после этого продолжайте либо оформите REASSIGN.
- Незавершённые сессии обязаны иметь статус `Blocked` или `Review` в agent_sync, чтобы TL видел их при gate-контроле.

## Метрики и контроль процесса
- Lead time от Intake до merge в `main`.
- Defect escape rate (дефекты после релиза).
- Rework ratio (gate-fail -> доработка).
- Change failure rate и MTTR.
- Time-in-stage по каждому gate (Intake/Arch/Dev/QA/InfoSec/Release/Docs).

## GateLog / Agent Sync history

```yaml
agent_sync:
  - when_utc: "2025-09-23T14:40:52Z"
    agent: "codex"
    role: "devops"
    branch: "feature/release/subprocess-hardening-devops"
    task: "TL-2025-09-21-subprocess-hardening"
    epic_scope: "Release / InfoSec follow-ups"
    files:
      - "core/scripts/db_dump.py"
      - "web/routes/index.py"
      - "web/routes/system.py"
    pr: null
    ac_link: "reports/infosec/2025-09-20-e2-e3-e17.md"
    ttl_minutes: 0
    status: "Review"
    note: "Хардениг subprocess (git/npm/pg_dump); проверка python3 -m compileall core/scripts/db_dump.py web/routes/index.py web/routes/system.py."
  - when_utc: "2025-09-23T14:34:51Z"
    agent: "codex"
    role: "be"
    branch: "feature/release/bot-status-default-be"
    task: "TL-2025-09-21-paid-marker-removal"
    epic_scope: "Release / InfoSec follow-ups"
    files:
      - "bot/handlers/telegram.py"
    pr: null
    ac_link: "README.md#release-gating"
    ttl_minutes: 0
    status: "Review"
    note: "Бот переключён на enum ProductStatus (без строкового paid); проверка python3 -m compileall bot/handlers/telegram.py."
  - when_utc: "2025-09-20T23:55:00Z"
    agent: "codex"
    role: "tw"
    branch: "feature/E2/release-docs-tw"
    task: "TL-2025-09-20-release-docs"
    epic_scope: "E2/E3/E17 release prep"
    files:
      - "README.md"
      - "reports/2025-09-20-release-qa.md"
      - "reports/infosec/2025-09-20-e2-e3-e17.md"
      - "reports/runbooks/test-to-main.md"
      - "reports/2025-09-20-release-e2-e3-e17.md"
      - "reports/2025-09-20-gaterecord-e2-e3-e17-release.md"
    pr: null
    ac_link: "README.md#-workflow-playbook"
    ttl_minutes: 0
    status: "Done"
    note: "README обновлён, отчёты QA/InfoSec/Runbook/ GateRecord собраны; готово к Gate-6 TL."
  - when_utc: "2025-09-20T23:59:00Z"
    agent: "codex-cli::techwriter"
    role: "tw"
    branch: "cleanup/docs-removal"
    task: "TL-2025-09-20-docs-removal"
    epic_scope: "Ops / Documentation"
    files:
      - "README.md"
      - "AGENTS.md"
      - ".github/workflows/docs-guards.yml"
      - "scripts/sync-docs.sh"
      - "reports/**"
    pr: null
    ac_link: "reports/2025-09-20-gaterecord-docs-removal.md"
    ttl_minutes: 0
    status: "Done"
    note: "Удалён docs/, README/AGENTS синхронизированы, CI-гейты добавлены, sync script подготовлен."
  - when_utc: "2025-09-20T23:55:00Z"
    agent: "codex-cli::teamlead"
    role: "tl"
    branch: "main"
    task: "TL-2025-09-20-agents-sync"
    epic_scope: "Ops / Stage-Gate Playbook"
    files:
      - "AGENTS.md"
      - "scripts/sync-agents.sh"
    pr: null
    ac_link: "AGENTS.md#sync-policy-agentsmd-agent_syncyaml"
    ttl_minutes: 0
    status: "Done"
    note: "2025-09-20 23:55Z — Stage-Gate spec v1.2 синхронизирован во всех ветках"
  - when_utc: "2025-09-20T18:52:00Z"
    agent: "codex"
    role: "tl"
    branch: "feature/E10/notes-restore-frontend"
    task: "TL-2025-09-19-notes-restore"
    epic_scope: "E10 / Capture"
    files:
      - "web/app/notes/page.tsx"
      - "web/components/notes/*"
      - "reports/PR_feature_E10_notes_restore_frontend.txt"
    pr: null
    ac_link: "README.md#e10-capture-ботвеб-inbox"
    ttl_minutes: 0
    status: "Done"
    note: "2025-09-20 19:11Z — rebase на test, npm run lint/test/build"
  - when_utc: "2025-09-20T17:50:00Z"
    agent: "codex"
    role: "tl"
    branch: "test"
    task: "TL-2025-09-20-release-gate"
    epic_scope: "Release / test ветка"
    files:
      - "git (test)"
      - "pytest smoke"
    pr: null
    ac_link: "README.md#-workflow-playbook"
    ttl_minutes: 0
    status: "Done"
    note: "2025-09-20 17:52Z — merge feature/E2,E3,E17 -> test; pytest suites; push origin/test"
  - when_utc: "2025-09-20T17:44:00Z"
    agent: "codex"
    role: "fe"
    branch: "feature/E17/runtime-fix-codex"
    task: "TL-2025-09-20-navigation-cleanup"
    epic_scope: "E17 / Frontend runtime"
    files:
      - "web/components/AppShell.tsx"
      - "web/components/navigation/*"
      - "web/lib/navigation-helpers.ts"
      - "tests/test_navigation_api.py"
    pr: null
    ac_link: "README.md#e17-frontend-modernization"
    ttl_minutes: 0
    status: "завершено 2025-09-20 17:44 (ModuleTabs/FavoriteToggle; `npm run lint`, `npm test`, `npm run build`)"
  - when_utc: "2025-09-20T17:42:00Z"
    agent: "codex"
    role: "qa"
    branch: "feature/E3/calendar-alarms-tests-codex"
    task: "TL-2025-09-20-calendar-alarms-tests"
    epic_scope: "E3 / Calendar alarms API"
    files:
      - "tests/web/test_alarms_api.py"
    pr: null
    ac_link: "README.md#e3-api-calendar-calendaritems-calendaragenda-calendarfeedics-projectsidnotifications"
    ttl_minutes: 0
    status: "завершено 2025-09-20 17:42 (`pytest tests/web/test_alarms_api.py`)"
  - when_utc: "2025-09-20T17:41:00Z"
    agent: "codex"
    role: "be"
    branch: "feature/E3/calendar-feed-valarm-codex"
    task: "TL-2025-09-20-calendar-feed-valarm"
    epic_scope: "E3 / Calendar alarms API"
    files:
      - "web/routes/calendar.py"
      - "core/services/para_repository.py"
      - "tests/web/test_calendar_feed_ics.py"
    pr: null
    ac_link: "README.md#e3-api-calendar-calendaritems-calendaragenda-calendarfeedics-projectsidnotifications"
    ttl_minutes: 0
    status: "завершено 2025-09-20 17:41 (VALARM в feed.ics, `pytest tests/web/test_calendar_feed_ics.py`)"
  - when_utc: "2025-09-20T17:40:00Z"
    agent: "codex"
    role: "be"
    branch: "feature/E3/diagnostics-auth-cleanup-codex"
    task: "TL-2025-09-20-diagnostics-auth"
    epic_scope: "E3 / diagnostics API auth"
    files:
      - "web/routes/api/diagnostics.py"
      - "core/services/diagnostics_service.py"
      - "reports/guides/internal-handbook.md"
      - "tests/test_diagnostics_service.py"
    pr: null
    ac_link: "README.md#e3-api-calendar-calendaritems-calendaragenda-calendarfeedics-projectsidnotifications"
    ttl_minutes: 0
    status: "завершено 2025-09-20 17:40 (Basic Auth удалён, `pytest tests/test_diagnostics_service.py`)"
  - when_utc: "2025-09-20T17:34:00Z"
    agent: "codex"
    role: "be"
    branch: "feature/E2/check-para-invariant-codex"
    task: "TL-2025-09-20-check-para-invariant"
    epic_scope: "E2 / миграции БД и индексы"
    files:
      - "core/models.py"
      - "core/db/ddl/20250920_para_check.sql"
      - "core/db/SCHEMA.*"
      - "tests/test_para_invariants.py"
    pr: null
    ac_link: "README.md#e2-%D0%BC%D0%B8%D0%B3%D1%80%D0%B0%D1%86%D0%B8%D0%B8-%D0%B1%D0%B4-%D0%B8-%D0%B8%D0%BD%D0%B4%D0%B5%D0%BA%D1%81%D1%8B"
    ttl_minutes: 0
    status: "завершено 2025-09-20 17:34 (`python -m core.db.schema_export generate`, `pytest tests/test_para_invariants.py`)"
  - when_utc: "2025-09-20T06:31:00Z"
    agent: "codex"
    role: "devops"
    branch: "feature/E9/test-branch-deploy-codex"
    task: "TL-2025-09-19-test-secrets"
    epic_scope: "E9 / pytest: Postgres окружение + ветка test"
    files:
      - ".github/workflows/tests.yml"
      - ".github/workflows/deploy-test.yml"
      - ".env.example"
    pr: null
    ac_link: "README.md#e9-%D1%82%D0%B5%D1%81%D1%82%D1%8B-%D0%B8-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%86%D0%B8%D1%8F-%D1%84%D0%B8%D1%87%D1%8D%D1%84%D0%BB%D0%B0%D0%B3"
    ttl_minutes: 0
    status: "завершено 2025-09-20 06:39 (обновлены workflows/tests, deploy-test; merge feature -> test -> main локально)"
  - when_utc: "2025-09-20T06:31:00Z"
    agent: "codex"
    role: "tw"
    branch: "feature/E9/test-branch-deploy-codex"
    task: "TL-2025-09-19-test-runbook"
    epic_scope: "E9 / pytest: Postgres окружение + ветка test"
    files:
      - "README.md"
      - "reports/2025-09-19-env-split.md"
      - "reports/runbooks/test-to-main.md"
    pr: null
    ac_link: "README.md#e9-%D1%82%D0%B5%D1%81%D1%82%D1%8B-%D0%B8-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%86%D0%B8%D1%8F-%D1%84%D0%B8%D1%87%D1%8D%D1%84%D0%BB%D0%B0%D0%B3"
    ttl_minutes: 0
    status: "завершено 2025-09-20 06:37 (README Tasklist/Changelog обновлены, runbook подготовлен)"
  - when_utc: "2025-09-20T06:34:00Z"
    agent: "codex"
    role: "qa"
    branch: "feature/E9/test-branch-deploy-codex"
    task: "TL-2025-09-19-test-branch-deploy"
    epic_scope: "E9 / pytest: Postgres окружение + ветка test"
    files:
      - "pytest (part1/part2 splits)"
      - "postgres logs"
    pr: null
    ac_link: "README.md#e9-%D1%82%D0%B5%D1%81%D1%82%D1%8B-%D0%B8-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%86%D0%B8%D1%8F-%D1%84%D0%B8%D1%87%D0%B5%D1%84%D0%BB%D0%B0%D0%B3"
    ttl_minutes: 0
    status: "завершено 2025-09-20 06:36 (pytest part1/part2 локально, warnings задокументированы)"
  - when_utc: "2025-09-20T06:24:00Z"
    agent: "codex"
    role: "tl"
    branch: "feature/E9/test-branch-deploy-codex"
    task: "TL-2025-09-19-test-branch-deploy"
    epic_scope: "E9 / pytest: Postgres окружение + ветка test"
    files:
      - ".github/workflows/deploy.yml"
      - "reports/2025-09-19-env-split.md"
      - "README.md"
    pr: null
    ac_link: "README.md#e9-%D1%82%D0%B5%D1%81%D1%82%D1%8B-%D0%B8-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%86%D0%B8%D1%8F-%D1%84%D0%B8%D1%87%D0%B5%D1%84%D0%BB%D0%B0%D0%B3"
    ttl_minutes: 0
    status: "завершено 2025-09-20 06:29 (workflow `.github/workflows/deploy-test.yml`, README Tasklist/Changelog обновлены)"
  - when_utc: "2025-09-20T05:33:00Z"
    agent: "codex"
    role: "tl"
    branch: "feature/E9/test-postgres-env-codex"
    task: "TL-2025-09-19-pytest-postgres-env"
    epic_scope: "E9 / pytest: Postgres окружение + ветка test"
    files:
      - "README.md"
      - "reports/*"
      - "git (test/main)"
    pr: null
    ac_link: "README.md#e9-%D1%82%D0%B5%D1%81%D1%82%D1%8B-%D0%B8-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%86%D0%B8%D1%8F-%D1%84%D0%B8%D1%87%D0%B5%D1%84%D0%BB%D0%B0%D0%B3"
    ttl_minutes: 0
    status: "завершено 2025-09-20 05:38 (merge 4cefd9a -> test; GateRecord `reports/2025-09-20-gaterecord-e9-test-postgres.md`)"
  - when_utc: "2025-09-19T22:40:00Z"
    agent: "codex"
    role: "qa"
    branch: "feature/E9/test-postgres-env-codex"
    task: "TL-2025-09-19-pytest-postgres-qa"
    epic_scope: "E9 / pytest: Postgres окружение + ветка test"
    files:
      - "tests/**"
      - "reports/2025-09-20-pytest-postgres-qa.md"
    pr: null
    ac_link: "README.md#e9-%D1%82%D0%B5%D1%81%D1%82%D1%8B-%D0%B8-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%86%D0%B8%D1%8F-%D1%84%D0%B8%D1%87%D0%B5%D1%84%D0%BB%D0%B0%D0%B3"
    ttl_minutes: 0
    status: "завершено 2025-09-19 22:58 (весь набор зелёный партиями, полный `pytest -q` >10 мин - см. отчёт)"
  - when_utc: "2025-09-19T22:59:00Z"
    agent: "codex"
    role: "devops"
    branch: "feature/E9/test-postgres-env-codex"
    task: "TL-2025-09-19-ci-timeouts"
    epic_scope: "E9 / pytest: Postgres окружение + ветка test"
    files:
      - ".github/workflows/tests.yml"
      - "reports/2025-09-20-ci-timeouts-analysis.md"
    pr: null
    ac_link: "README.md#e9-%D1%82%D0%B5%D1%81%D1%82%D1%8B-%D0%B8-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%86%D0%B8%D1%8F-%D1%84%D0%B8%D1%87%D0%B5%D1%84%D0%BB%D0%B0%D0%B3"
    ttl_minutes: 0
    status: "завершено 2025-09-19 23:05 (workflow разбит на два шага, артефакты pytest)"
  - when_utc: "2025-09-19T20:42:00Z"
    agent: "codex"
    role: "fe"
    branch: "feature/E10/notes-restore-frontend"
    task: "TL-2025-09-19-notes-restore"
    epic_scope: "E10 / восстановление Next.js `/notes`"
    files:
      - "web/app/notes/page.tsx"
      - "web/components/notes/*"
      - "web/lib/types.ts"
      - "tests/web/test_notes_page.py"
    pr: null
    ac_link: "README.md#e10-capture-%D0%B1%D0%BE%D1%82%D0%B2%D0%B5%D0%B1-inbox"
    ttl_minutes: 60
    status: "Blocked"
    note: "reports/2025-09-19-notes-restore-wip.md"
  - when_utc: "2025-09-19T18:26:00Z"
    agent: "codex"
    role: "be"
    branch: "feature/E9/test-postgres-env-codex"
    task: "TL-2025-09-19-pytest-postgres-migration"
    epic_scope: "E9 / pytest: Postgres окружение + ветка test"
    files:
      - "tests/conftest.py"
      - "tests/web/*"
      - "web/routes/index.py"
      - "web/routes/settings.py"
    pr: null
    ac_link: "README.md#e9-%D1%82%D0%B5%D1%81%D1%82%D1%8B-%D0%B8-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%86%D0%B8%D1%8F-%D1%84%D0%B8%D1%87%D0%B5%D1%84%D0%BB%D0%B0%D0%B3"
    ttl_minutes: 0
    status: "завершено 2025-09-19 21:40 (диагностика и web на Postgres; полный `pytest -q` требует увеличения таймаута)"
  - when_utc: "2025-09-19T10:22:00Z"
    agent: "codex"
    role: "be"
    branch: "feature/E9/test-postgres-env-codex"
    task: "TL-2025-09-19-pytest-postgres-env"
    epic_scope: "E9 / pytest: Postgres окружение"
    files:
      - "tests/conftest.py"
      - ".env*"
      - "reports/**"
    pr: null
    ac_link: null
    ttl_minutes: 0
    status: "завершено 2025-09-19 10:33"
  - when_utc: "2025-09-19T08:43:00Z"
    agent: "codex"
    role: "ops"
    branch: "main"
    task: null
    epic_scope: "Ops / синхронизация main + рестарт сервисов"
    files:
      - "git (main)"
      - "systemctl"
      - "logs/*"
    pr: null
    ac_link: null
    ttl_minutes: 0
    status: "завершено 2025-09-19 08:47"
  - when_utc: "2025-09-19T07:55:00Z"
    agent: "codex"
    role: "be"
    branch: "feature/E3/notes-assign-detached-codex"
    task: "TL-2025-09-19-notes-assign-detached"
    epic_scope: "E3 / починка POST /api/v1/notes/{id}/assign (DetachedInstanceError)"
    files:
      - "core/services/notes.py"
      - "web/routes/notes.py"
      - "tests/test_notes_assign.py"
    pr: null
    ac_link: null
    ttl_minutes: 0
    status: "завершено 2025-09-19 08:09"
  - when_utc: "2025-09-19T07:48:00Z"
    agent: "codex"
    role: "fe"
    branch: "feature/E17/appshell-nav-tuning-codex"
    task: "TL-2025-09-19-appshell-nav-tuning"
    epic_scope: "E17 / модульная навигация AppShell - адаптация UX"
    files:
      - "web/components/AppShell.tsx"
      - "web/components/layout/PublicHeader.tsx"
      - "web/components/navigation/*"
      - "reports/**"
    pr: null
    ac_link: null
    ttl_minutes: 0
    status: "завершено 2025-09-19 08:28"
  - when_utc: "2025-09-19T00:32:00Z"
    agent: "codex"
    role: "arch"
    branch: "feature/E18/crm-skeleton-codex"
    task: "TL-2025-09-18-crm-blueprint"
    epic_scope: "E18 / CRM Knowledge Hub - исследование и каркас"
    files:
      - "reports/*crm*"
      - "reports/archive/vision.md"
      - "reports/archive/tasklist.md"
      - "web/app/crm/*"
      - "core/services/crm/*"
    pr: null
    ac_link: null
    ttl_minutes: 0
    status: "завершено 2025-09-19 01:00"
  - when_utc: "2025-09-18T23:05:00Z"
    agent: "codex"
    role: "fe"
    branch: "feature/E17/menu-grouping-codex"
    task: "TL-2025-09-18-nav-blueprint"
    epic_scope: "E17 / группировка меню AppShell"
    files:
      - "web/components/AppShell.tsx"
      - "web/lib/publicNav.ts"
      - "reports/**"
    pr: null
    ac_link: null
    ttl_minutes: 0
    status: "завершено 2025-09-20 18:42 (merge runtime-fix; ModuleTabs/FavoriteToggle; `npm run lint`, `npm test`, `npm run build`)"
  - when_utc: "2025-09-18T22:34:00Z"
    agent: "codex"
    role: "fe"
    branch: "feature/E17/mobile-responsive-ui-codex"
    task: "TL-2025-09-18-mobile-ui"
    epic_scope: "E17 / мобильная адаптация AppShell и обзора"
    files:
      - "web/components/AppShell.tsx"
      - "web/components/layout/PublicHeader.tsx"
      - "web/components/dashboard/OverviewDashboard.tsx"
    pr: null
    ac_link: null
    ttl_minutes: 0
    status: "завершено 2025-09-18 22:44"
  - when_utc: "2025-09-18T20:37:00Z"
    agent: "codex"
    role: "fe"
    branch: "feature/E17/legacy-migration-codex"
    task: "TL-2025-09-18-legacy-final"
    epic_scope: "E17 / миграция легаси-страниц на новый UI"
    files:
      - "web/app/*"
      - "web/templates/*"
      - "web/components/*"
      - "reports/**"
    pr: null
    ac_link: null
    ttl_minutes: 0
    status: "завершено 2025-09-18 21:03"
  - when_utc: "2025-09-18T19:30:00Z"
    agent: "codex"
    role: "fe"
    branch: "feature/E17/groups-products-ui-codex"
    task: "TL-2025-09-18-support"
    epic_scope: "E17 / тарифы, кнопки поддержки"
    files:
      - "web/components/marketing"
      - "web/components/AppShell.tsx"
      - "reports/**"
    pr: null
    ac_link: null
    ttl_minutes: 0
    status: "завершено 2025-09-18 19:46"
  - when_utc: "2025-09-18T18:44:00Z"
    agent: "codex"
    role: "fe"
    branch: "feature/E17/groups-products-ui-codex"
    task: "TL-2025-09-18-groups"
    epic_scope: "E17 / модернизация groups & products, тултипы терминов"
    files:
      - "web/app/groups"
      - "web/app/products"
      - "web/components"
      - "reports/**"
    pr: null
    ac_link: null
    ttl_minutes: 0
    status: "завершено 2025-09-18 19:18"
  - when_utc: "2025-09-18T17:45:00Z"
    agent: "codex"
    role: "fe"
    branch: "feature/E17/profile-widget-codex"
    task: "TL-2025-09-18-profile-widget"
    epic_scope: "E17 / виджет профиля, меню тарифов"
    files:
      - "web/app"
      - "web/components"
      - "reports/**"
    pr: null
    ac_link: null
    ttl_minutes: 0
    status: "завершено 2025-09-18 17:58"
  - when_utc: "2025-09-18T17:18:00Z"
    agent: "codex"
    role: "fe"
    branch: "feature/E17/bot-landing-codex"
    task: "TL-2025-09-18-bot"
    epic_scope: "E17 / фронт + веб-сервер"
    files:
      - "web/app"
      - "web/routes"
      - "reports/**"
    pr: null
    ac_link: null
    ttl_minutes: 0
    status: "завершено 2025-09-18 17:28"
```

Добавляйте новые записи в начало списка `agent_sync`, актуализируйте `ttl_minutes` при продлении брони и удаляйте запись сразу после handoff или merge.

Поля Role/Task/PR/AC обязательны. Role = tl|arch|be|fe|qa|tw|ops. Task = ID из Tasklist (формат `TL-YYYY-MM-DD-<slug>`).

## Documentation Workflow (idea -> vision -> conventions -> tasklist -> workflow)
- Разделы README.md «Idea Log», «Vision Deck», «Conventions Catalog», «Tasklist» и «Workflow Playbook» образуют единый конвейер документации. Обновляйте их по мере работы.
- Исследования и длинные отчёты складывайте в `reports/*` и добавляйте ссылки в соответствующие разделы README.
- Гайд для владельцев/людей по работе с codex-cli остаётся в `reports/guides/codex-cli-multisession.md`; при необходимости давайте на него ссылку в README.

## Strategic Plan (E1-E16) - как агенты выбирают и оформляют работу
- Любой MR должен ссылаться на эпик из README.md (секция «Roadmap & Epics») и соответствующие Acceptance Criteria.
- Для новых подзадач добавляйте элементы в секцию «Roadmap & Epics» README перед реализацией и синхронизируйте «Tasklist».
- Особое внимание: E1 (PARA), E12 (единый «Сегодня»), E13 (Tasks & Time), E16 (Habits).

## Project Structure & Module Organization
- `core/`: shared models, services, utils, logging. All logic reused by bot and web lives here.
- /core - директория для общего переиспользуемого кода приложения (основного бэкенда) к которому может обращаться как фронтенд (/web), так и Telegram-бот (/bot).
- `bot/`: Telegram bot (aiogram) handlers, FSM states, routers. Import business logic from `core`, do not duplicate it.
- /bot - директория (модуль) Telegram-бота независимый от логики фронтенда приложения, который можно запустить отдельно от фронтенда.
- `web/`: FastAPI app routes, templates, dependencies. Reuse `core` services.
- /web - директория (модуль) фронтенда приложений независимый от логики Telegram-бота, который можно запустить отдельно от Telegram-бота.
- `tests/`: end-to-end and unit tests across subsystems.
- /tests - Директория для тестов приложения без прямого влияния на функциональность приложения.
- `utils/` - единственная директория для вспомогательных утилит, которые не влияют на запуск рантайма (линтеры, проверки окружения, скрипты деплоя, дампы и т. п.). Удаление `utils/` не должно ломать приложение.
- Runtime boundaries (жёстко):
  - Всё, что обязательно для работы на рантайме, живёт в **/core** (модели, сервисы, валидаторы, резолверы, инициализация БД).
  - `utils/` - только опциональные скрипты (линтеры, проверки, дампы). Удаление `utils/` не должно ломать приложение. Директории `tools/` в проекте не используется.
  - `web/` и `bot/` импортируют бизнес-логику только из `core/services`.

### Frontend Guidelines
- Базовый стек: **Next.js + TypeScript + Tailwind**; допустимо **React + Vite**, если стандарт соблюдён.
- Код фронтенда размещается либо в `web/frontend/`, либо в отдельном `frontend/` (статика отдаётся через FastAPI).
- Используем компонентный подход, запросы к API через **React Query** или **RTK Query**; все пути согласованы с `/api/v1/*`.
- Интерфейсы обязательны к адаптивности; не допускаются дубликаты `<h1>`, заголовок задаётся через `MODULE_TITLE`.
- Заголовок страницы рендерится единственным `<h1>` по центру шапки AppShell; описание выводится только во всплывающем тултипе при наведении на заголовок и не дублируется в теле страницы.
- Стандарты: **ESLint**, **Prettier**, **Vitest/Jest**; перед PR выполняются `npm run build`, `npm run dev`, `npm run lint`, `npm run test`.
- Агент codex-cli автоматически запускает `npm run build` после любых изменений, требующих пересборки Node.js (фронтенд в `web/app`, `web/components`, `web/lib`, стили, конфиги, npm-зависимости), фиксируя запуск в отчёте; если выполнить сборку нельзя, агент обязан явно описать причину.
- Задачи по фронтенду согласуются с README.md (секция «E17: Frontend Modernization») как единой точкой истины.
- Обзор (`web/app/page.tsx`, `web/components/dashboard/OverviewDashboard.tsx`) работает на Next.js с адаптивной сеткой `repeat(auto-fit, minmax(320px, 1fr))`. Каждый виджет имеет `data-widget` для идентификации; порядок и видимость хранятся в `user_settings.dashboard_layout`.
- ЛК админа доступен по `/admin` (Next.js, `web/app/admin/page.tsx`, `web/components/admin`). Встраиваемая версия `/cup/admin-embed` рендерится той же Next.js страницей (`web/app/cup/admin-embed/page.tsx`) без использования Jinja.

## Инициализация БД (без Alembic)
- Источник правды по схеме: идемпотентные DDL в **`core/db/ddl/*.sql`** (только `CREATE/ALTER/INDEX IF NOT EXISTS`).
- Единый фасад: **`core/db/init_app.py:init_app_once(env)`** - вызывается и в `web`, и в `bot` до регистрации роутов/старта бота.
- Порядок внутри `init_app_once`: `run_bootstrap_sql()` -> `run_repair()` -> *(опционально)* `create_models_for_dev()` (только при `DEV_INIT_MODELS=1` и если не шёл bootstrap).
- Защита от гонок: PostgreSQL advisory-lock.
- ENV-флаги:
  ```
  DB_BOOTSTRAP=1        # прогон core/db/ddl/*.sql
  DB_REPAIR=1           # backfill/наследование/миграции данных
  DEV_INIT_MODELS=0     # только для локалки/тестов; не заменяет DDL
  ```

## PARA-first Invariants (Must Not Break)
- Любая сущность: `project_id` ИЛИ `area_id` (оба NULL - ошибка). При указании `project_id` - `area_id` наследуется.
- Alarm - часть `CalendarItem` (VALARM эквивалент).
- Время - UTC + `tzid`, повторы через `RRULE`, без материализации бесконечных рядов.
- Один активный таймер на пользователя (UNIQUE WHERE `stopped_at IS NULL`).
- Для `Habits/Dailies/Rewards` обязателен `area_id`; при `project_id` наследуем `area_id` проекта.
- Project обязан иметь **Area**.
- Task/Resource обязаны иметь **Project ИЛИ Area**; при наличии Project -> **area наследуется** от проекта.
- Любая сущность базы данных обязана иметь **Area**; во всех таблицах поле `area_id` обязательно (`NOT NULL`, по умолчанию системная область «Входящие»).
- Tasks = `CalendarItem(kind='task')`; **напоминания** живут внутри календаря (аналог `VALARM`); дублирующих напоминаний в задачах нет.
- Быстрый ввод: всё без контейнера падает в системную **Area «Входящие»**, потом можно перекинуть.
- **Area «Входящие»** создаётся при запуске приложения (если отсутствует) и не может быть удалена или отредактирована через UI/админку.
- **Subjective overrides**: персонифицированные привязки Project/Task/Resource к другой Area/Project для конкретного пользователя без дублирования сущностей.
- В тестах: запрет на runtime-импорты из `utils/*`; проверка, что entrypoints зовут только `init_app_once()`.

## Habits Module (Habitica-like) - правила реализации
- Модель: `habits`, `habit_logs`, `dailies`, `daily_logs`, `rewards`, `user_stats` (см. README.md, секция «E16: Habits»).
- Экономика: XP/Gold/HP/Level/KP; экспоненциальное затухание награды для частых «плюсов»; штрафы HP за «минусы»; idempotent cron по локальному дню.
- API: `/api/v1/habits*`, `/api/v1/dailies*`, `/api/v1/rewards*`. Dailies интегрируются в календарь **виртуально** (agenda/ICS), без дублей в `calendar_items`.
- UI `/habits`: 4 колонки (Привычки / Ежедневные / Задачи / Награды), фильтры Area/Project, HUD (HP/XP/Level/Gold/KP).
- Бот: команды `/habit` и `/daily`, недельный дайджест.

## User-Settings (кастомизация дашборда)
- Одна расширяемая таблица **`user_settings`** (K/V JSONB): ключи `dashboard_layout`, `favorites` и др. в будущем.
- Перенос `users_favorites` -> `user_settings` (`key='favorites'`) выполняется в **`core/db/repair.py`** (идемпотентно).
- API: `GET /api/v1/user/settings`, `GET/PUT /api/v1/user/settings/{key}`.
- UI: кнопка «Настроить дашборд» в Обзоре включает drag-n-drop (через DnD-kit) и скрытие/возврат виджетов. `layout.widgets` хранит порядок видимых карточек, `layout.hidden` - скрытые. Дефолт - все виджеты в порядке `web/components/dashboard/OverviewDashboard.tsx`.
- `theme_preferences` хранит персональный пресет темы (`mode`, `primary`, `accent`, `surface`, `gradient{from,to}`) и применяется через `theme-utils.js` (CSS-переменные). Пустой объект = используем глобальный пресет.
- Глобальный брендовый пресет (`theme.global.*`) живёт в `app_settings`; UI `/settings` синхронно обновляет его и показывает только администраторам.

## Build, Test, and Development Commands
- Create venv: `python -m venv venv && source ./venv/bin/activate`
- Install deps: `pip install --quiet -r requirements.txt`
- Run tests: `pytest -q` (requires local PostgreSQL on `127.0.0.1:5432`)
- Lint: `flake8` (if configured)
- Frontend changes (`web/`) require `npm run lint` and `npm test`
- Перед запуском сервисов вызывается `init_app_once(env)` в entrypoints `web` и `bot`.
- После изменения схемы обновляйте DDL-файлы (`core/db/ddl/*`) и прогоняйте тесты: `pytest -q`.

## Security & Configuration
- Use `.env` (see `.env.example`) and never commit secrets.
- Required vars: `TG_BOT_TOKEN`, `TG_BOT_USERNAME`, `PUBLIC_URL`, `SESSION_MAX_AGE`, `ADMIN_TELEGRAM_IDS`, DB settings, `DB_BOOTSTRAP`, `DB_REPAIR`, `DEV_INIT_MODELS`.
- Tests: create `.env.test` (ignored) and export vars, e.g.:
  ```bash
  cat > .env.test <<'EOF'
  DB_HOST=127.0.0.1
  DB_USER=postgres
  DB_PASSWORD=postgres
  DB_NAME=postgres
  EOF
  set -a; source .env.test; set +a
  ```
- Не использовать Alembic в текущей конфигурации; миграции выполняются через DDL + repair.

## Coding Style & Naming Conventions
- Python, async/await where used; prefer f-strings; add type hints.
- Keep shared logic in `core/services` and import in `bot`/`web`.
- Table names: prefix by module; user-related tables use `users_` (e.g., `users_tg`).
- Branding: use “Intelligent Data Pro” for product/headers; bot is “@intDataBot”. Default links to `https://intdata.pro/` and bot to `https://intdata.pro/bot`.
- Language: prioritize Russian-speaking users. All user-facing texts (bot/web) default to Russian; keep code identifiers/comments in English. Add i18n only when needed, with Russian as the primary locale.
- UI разрабатываем адаптивным: поддерживаем диапазон устройств от узких телефонов с соотношением 18:9 до широкоформатных мониторов 16:9, сохраняя единый отзывчивый layout без дублирования маркап.
- Page titles are rendered in the header via `MODULE_TITLE`; do not duplicate the module name with an extra `<h1>` inside pages.

## Testing Guidelines
- Framework: `pytest` with a running PostgreSQL.
- Test naming: `tests/test_*.py`; mirror module layout.
- Run locally: `pytest -q`. Fix failing tests before merging.

## UI Cards
- Используем React-компоненты из `web/components/ui` (`Card`, `Badge`, `Button`, `Toolbar`) и Tailwind-токены (`var(--surface-*)`, `shadow-soft`) вместо старых классов `.c-card`/`.cards-grid`.
- Для иконок используем SVG-символы и React-компоненты внутри Next.js (emoji, `svg` или `Image`); прямые инклуды `partials/icons.svg` больше не используются.
- Кнопки-иконки строим на `Button`/`IconButton` (варианты `ghost`/`secondary`) с `data-tooltip` для подсказок.
- Удаление подтверждаем через стандартные UI-диалоги (пока допускается `window.confirm`, но планируем вынести в общий компонент `ConfirmDialog`).
- Заметки обязаны иметь `area_id`; `project_id` опционален, по умолчанию используется Inbox.
- Цвет карточек заметок наследуется от `areas.color`; поле `notes.color` не используется при записи.

## Обязательное правило: схема БД (source of truth)

- Любые изменения `core/models.py` или Alembic-миграций **требуют** обновления схемы БД.
- Генерация:
```bash
  python -m core.db.schema_export generate
  git add core/db/SCHEMA.json core/db/SCHEMA.sql
  git commit -m "chore(db): update SCHEMA after model changes"
```
- CI проверяет актуальность командой `python -m core.db.schema_export check`. PR не пройдёт, если забыли обновить.

SCHEMA.json является единой «точкой истины» структуры БД (таблицы, поля, индексы, констрейнты, enum).

## Commit & Pull Request Guidelines
- Commits: clear, imperative summary (why + what). Update `requirements.txt` when adding deps; adjust `.env.example` и `README.md` when env/behavior changes.
- Типы коммитов: `feat(core/db|services)`, `feat(web|bot)`, `chore(core/db/ddl|env)`, `docs(readme|agents)`.
- PRs: concise description, linked issues, setup notes, screenshots for UI changes. Ensure CI/tests pass. В описании PR добавляйте ссылки на разделы README.md «Roadmap & Epics» и «Changelog».
- PR чек-лист: скриншоты UI при изменениях; ссылки на README.md («Roadmap & Epics», «Changelog»).

## Work Protocol for Agents
- К каждому изменению - ссылка на эпик и Acceptance Criteria в README.md (секция «Roadmap & Epics»); при необходимости актуализируй соответствующие записи и Tasklist.
- Бизнес-логика - только в `/core/services/*`. `/web` и `/bot` - тонкие слои.
- При любых изменениях в `/bot` обязательно актуализируй динамическую справку `/start`, чтобы она отражала доступные команды и уровни доступа.
- Миграции БД: idempotent DDL в `/core/db/ddl/*.sql` + `repair`; если в проекте уже используется другая технология, следуем действующей и фиксируем это здесь, НЕ меняя платформу миграций в рамках правки AGENTS.
- Экспорт схемы (`core.db.schema_export`) обновлять при изменении моделей.
- Все API - под `/api/v1/*`; обновить `/api/openapi.json`.
- Фичефлаги: `CALENDAR_V2_ENABLED`, `HABITS_V1_ENABLED`, `HABITS_RPG_ENABLED` (и `.env.example` при необходимости).
- Тесты (pytest): наследование PARA; один активный таймер; cron ежедневок (идемпотентность); `habits up/down`, `dailies done/undo`, виртуальные записи в agenda; срезы `/time/summary`.
- Коммиты/PR: императивный заголовок, почему+что; обновление `.env.example`, README.md (секции «Roadmap & Epics», «Changelog»); скриншоты UI.
- Work from repo root, activate venv, install deps, then implement.
- Keep changes minimal and aligned with existing style. Always finish with: `source ./venv/bin/activate && pip install --quiet -r requirements.txt && pytest -q`.
- Changes to note models or endpoints require updating `core/db/SCHEMA.*` via `python -m core.db.schema_export generate`; OpenAPI is served at `/api/openapi.json` and used in tests.

### Контуры Prod/Test
- Базовая ветка разработки - `test`; все фиче-ветки создаются от неё и мерджатся обратно через PR с зелёным `pytest -q` и фронтовыми проверками.
- Ветка `test` деплоится в изолированный контур (`test.intdata.pro`, бот `@intDataTestBot`, БД `intdatadb_test`). Автоудаление ветки после merge отключаем в GitHub.
- Ветка `main` принимает только fast-forward из `test` после ручной проверки тестового контура. Прямые PR в `main` запрещены.
- Secrets и `.env` для тестового контура используют префиксы `TEST_` (БД, URL, токены бота). Прод окружение держит значения без префикса.
- Любое изменение инфраструктуры должно обновлять оба контура (terraform/ansible роли, CI/CD jobs) и описываться в `reports/*` + README.md (раздел «Operations & Infrastructure»).

## Roles Charter & Auto-Switch (AGX/1.0)

**Общее правило.** Любая сессия codex-cli стартует в роли **Team Lead**. Тимлид читает контекст (README/AGENTS, Agent Sync, Tasklist), принимает задачу, дробит на подзадачи и выдаёт их ролям. Роли переключаются директивой:

```
<<ROLE: teamlead|architect|backend|frontend|qa|techwriter|devops>>
```

**Единый конверт задачи (обязателен):**

```yaml
# AGX/1.0 TaskCard
id: TL-YYYY-MM-DD-<slug>     # Task ID (из Tasklist)
epic: E<NN>                   # ссылка на эпик из README
scope: "<краткое описание>"
role: backend|frontend|qa|techwriter|architect|devops
branch: "feature/<epic>/<scope>-<role>"
files:
  - path/to/file.ext
  - ...
constraints:
  - краткий список ограничений (границы роли)
acceptance_criteria:
  - измеримые AC (ссылка на README Roadmap & Epics)
artifacts_expected:
  - что именно должно появиться (код/тесты/документация/DDL/OpenAPI)
handoff_to: teamlead|<role>|none   # кому передать после завершения
notes: |
  важные детали/риски
```

Правила автопереключения (TL-router):

- Если в задаче затронуты только `core/**`, `core/db/**`, `web/api/**` -> `<<ROLE: backend>>`.
- Если затронуты `web/app/**`, `web/components/**`, `web/lib/**`, `frontend/**` -> `<<ROLE: frontend>>`.
- Если меняются `tests/**` без модификации `core/**|web/**` -> `<<ROLE: qa>>`.
- Если меняются `reports/**`, `README.md`, `AGENTS.md`, `api/openapi.json` (export) без кода -> `<<ROLE: techwriter>>`.
- Если меняются `infra/**|utils/deploy/**|CI/**` -> `<<ROLE: devops>>`.
- Если затрагивается архитектура (схема БД, инварианты, границы модулей) -> `<<ROLE: architect>>`.
- Любая роль, упираясь в границу ответственности, обязана сделать `handoff_to: teamlead` с пояснением.

Ниже - системные промпты для каждой роли (используйте в codex-cli как системные/Developer prompts):

#### [ROLE=teamlead]
Mission: принять бизнес-задачу, нарезать работу на подзадачи, выдать TaskCard’ы, собрать результаты и смёржить по процессу test->main.
You MUST:
- читать README/AGENTS (Vision/Tasklist/Agent Sync) перед планированием
- формировать AGX/1.0 TaskCard с AC и файлами
- назначать role и ветки `feature/<epic>/<scope>-<role>`
- проверять чек-листы, линтеры, тесты и сборку (`npm run build` для фронта)
- мерджить только через PR в `test`, затем fast-forward `test->main`
You MUST NOT: писать код или тесты.
Handoffs: возвращайся к себе (TL) после любой роли; эскалируй к Architect при изменении инвариантов.
Exit: ссылки на PR, обновлённые Tasklist/Changelog, чистый Agent Sync.

#### [ROLE=architect]
Mission: держать архитектурный план и инварианты (PARA/Calendar/DB), давать решения без реализации.
Do: ADR/решения в `reports/*` + ссылки в README (Vision/Conventions). Схемы/DDL-планы.
Don't: код руками.
Exit: краткое ADR, список инвариантов, влияние на API/DDL.
Escalate: TL при коллизиях.

#### [ROLE=backend]
Mission: реализовать серверную логику в `core/**` и API `/api/v1/*`, соблюдая PARA-инварианты.
Do: код, миграции DDL (идемпотентно), SCHEMA экспорт, OpenAPI экспорт, юнит/интеграционные тесты.
Don't: фронтенд/деплой/документацию (кроме docstrings).
Boundaries: не изменяй `web/app/**` и `web/components/**`.
Exit: PR, зелёные `pytest -q`, обновлённые `core/db/SCHEMA.*` и `api/openapi.json` (экспорт), handoff TL.

#### [ROLE=frontend]
Mission: Next.js/TS/Tailwind UI без бизнес-логики.
Do: `web/app/**`, `web/components/**`, `web/lib/**`, React Query, `npm run build|lint|test`.
Don't: backend/DDL.
Boundaries: единый `<h1>` в AppShell, соответствие UI-правилам из AGENTS/README.
Exit: PR со скриншотами, зелёная сборка, handoff TL.

#### [ROLE=qa]
Mission: тестами доказать, что AC выполнены, иначе зафейлить.
Do: `tests/**`, фикстуры Postgres, OpenAPI snapshot, e2e сценарии.
Don't: менять приложение.
Exit: отчёт (пройдено/не пройдено), баг-тикеты (handoff TL/соответствующей роли).

#### [ROLE=techwriter]
Mission: привести документацию к текущей реальности; писать понятно и коротко.
Do: README/AGENTS, `reports/**`, Changelog, OpenAPI экспорт.
Don't: код, тесты, деплой.
Exit: PR с разделами, ссылки на эпики/AC, handoff TL.

#### [ROLE=devops]
Mission: CI/CD, окружения test/main, секреты, наблюдаемость.
Do: пайплайны, ранбуки, алерты, охрана секретов.
Don't: фичекод.
Exit: PR с пайплайнами/конфигами, обновлённый runbook, handoff TL.

### Multi-agent Coordination (codex-cli)
- Каждый экземпляр codex-cli работает в собственной рабочей копии: отдельный `git clone` или `git worktree add ../<agent-branch>`. Запрещено вести параллельную работу из одного каталога.
- Перед стартом сессии: `git fetch --all`, `git status`, убедись, что нет чужих незакоммиченных правок. При обнаружении - синхронизируйся с владельцем задачи.
- Для каждой задачи заводите ветку `feature/<epic>/<scope>-<role>` и коммитите туда. Дальнейший merge выполняет только Team Lead: сначала через PR в `test`, затем TL делает fast-forward `test->main` после прохождения gate.
- Резервируй задачи и файлы в [Agent Sync](#agent-sync): укажи позывной, дату/время (UTC), ветку и ключевые файлы. После merge/отмены работы снимай бронь.
- Если требуются правки в файлах, занятых другим агентом, договорись через Agent Sync о порядке работ; одновременное редактирование одного файла запрещено.
- Для крупных фич раскладывай изменения на подзадачи в README.md (секция «Roadmap & Epics») и, по возможности, включай фичефлаги, чтобы ограничить зону конфликта.
- Конфликты при `git rebase`/`merge` решает агент, начавший работу позже: обнови ветку, переиграй свои правки и только после этого пушь результат.

## Жёсткие архитектурные правила (не нарушать)
- Вся логика и зависимости, без которых бэкенд не стартует, живут в `core/`.
- Всё, что нужно только веб‑интерфейсу - в `web/` (тонкий слой UI и HTTP‑маршрутов, бизнес‑логика импортируется из `core/services`).
- Всё, что нужно только Telegram‑боту - в `bot/` (обработчики, FSM, роутеры, бизнес‑логика из `core/services`).
- Вспомогательные утилиты хранятся только в `utils/` и не используются рантаймом напрямую (никаких импортов из `utils/` внутри `core/`, `web/`, `bot/`).
- В `tests/` находятся только тесты; тесты не импортируют код из `utils/` на рантайме.
- В `reports/` - архивная документация, отчёты и гайды; актуальные правила и планы находятся в README.md.
- В `logs/` - только логи. Содержимое каталога не коммитим, каталог игнорируется в VCS.

## When updating API
- [ ] Измени код и тесты.
- [ ] Выполни `python -m web.openapi_export` для обновления `api/openapi.json`.
- [ ] Обнови раздел «Changelog» в README.md.

## Agent Self-Checklist (перед merge)
- [ ] Есть ссылка на эпик и AC из README.md (секция «Roadmap & Epics»)?
- [ ] Инварианты PARA соблюдены и покрыты тестами?
- [ ] Миграции/DDL идемпотентны; схема/SCHEMA.* обновлена?
- [ ] OpenAPI и фичефлаги в актуальном состоянии?
- [ ] UI соответствует стилю и отзывчивости; тексты на русском?
- [ ] README.md обновлён: Roadmap & Epics, Tasklist, Changelog?
- [ ] Локальные тесты зелёные (`pytest -q`)?

## Do Not Do
- Не удалять и не сокращать раздел «Stage-Gate Playbook (IntData)» и связанные инструкции.
- Не создавать дубли напоминаний вне календаря.
- Не материализовать ежедневки в `calendar_items` - только виртуальная интеграция (agenda/ICS).
- Не класть бизнес-логику в `/web` или `/bot`.
- Не ломать префикс `/api/v1/*` и совместимость.

# AGENTS: работа с едиными источниками

## Где хранится бэклог и стратегия
- Основной источник правды: README.md, секция «Roadmap & Epics» (включает Roadmap, эпики E1-E18, MR-план, Definition of Done, Appendix).
- Исторические записи в `reports/archive/BACKLOG.md` переведены в архивный режим; поддерживать актуальность нужно только в README.md.

## Где хранится история изменений
- Раздел «Changelog» в README.md ведём по формату *Keep a Changelog* и SemVer.
- После мержа PR добавляйте записи под `### [Unreleased]` с тегами `Added/Changed/Fixed/Removed` и ссылками на коммиты.
- При релизе переносите блок `Unreleased` под новую версию `X.Y.Z - YYYY-MM-DD` в README.md.

## README.md
- README теперь совмещает маркетинг, product vision, roadmap, tasklist, workflow и changelog.
- Ссылки на дополнительные материалы (`reports/*`, гайды) приводите из соответствующих разделов README.
- Поддерживайте актуальность оглавления README и внутренних якорей: агенты и владелец ориентируются именно по этому документу.
```
