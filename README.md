# Intelligent Data Pro — ваш цифровой «второй мозг»

> Единая система управления жизнью и знанием: задачи, календарь и напоминания, трекинг времени, заметки и граф знаний, привычки и ритуалы — в одном приложении. Интеграции с Google Календарём и Telegram, продуманная методология **PARA** (Projects / Areas / Resources / Archive) и база для будущих модулей аналитики (финансы, здоровье, must‑read/series и др.).

- Сайт: **https://intdata.pro/**
- Бот: **https://intdata.pro/bot**  → @intDataBot
- Технологии: **Python (FastAPI/Aiogram), React, PostgreSQL**

Документация: [Roadmap & Epics](#roadmap--epics), [Changelog](#changelog), [Idea Log](#idea-log), [Legacy NexusCore Balance](./docs/archive/nexuscore_balance.md). Подробности изменений ищите в Changelog.

## Как пользоваться README.md
- README — совместная точка синхронизации владельца и агентов. Здесь собраны видение, roadmap, tasklist, workflow и changelog.
- Операционные правила и Agent Sync находятся в [AGENTS.md](./AGENTS.md); перед началом сессии проверьте их.
- При обновлении разделов поддерживайте актуальность оглавления и внутренних якорей. Если возникает новый источник данных (исследование, отчёт), вынесите его в `docs/reports/*` и дайте ссылку из соответствующего раздела.
- Все ссылки на backlog/epics/tasklist/changelog внутри репозитория должны указывать на соответствующие секции этого README.

## Оглавление
- [🚀 Зачем это нужно](#-зачем-это-нужно)
- [🧠 Ключевые принципы](#-ключевые-принципы)
- [🧩 Модули системы](#-модули-системы)
- [🎛️ Кастомизация дашборда](#-кастомизация-дашборда)
- [🏗️ Архитектура (вкратце)](#-архитектура-вкратце)
- [🗂️ Idea Log](#-idea-log)
- [🎯 Vision Deck](#-vision-deck)
- [📐 Conventions Catalog](#-conventions-catalog)
- [🛠️ Workflow Playbook](#-workflow-playbook)
- [📝 Tasklist](#-tasklist)
- [🗺️ Roadmap & Epics](#-roadmap--epics)
- [📰 Changelog](#-changelog)
- [Reports & Archives](#reports--archives)

> **Важно:** функционал прежних отдельных проектов **HabitMinder** и **NexusCore Balance** полностью **интегрирован** в Intelligent Data Pro. Отдельные репозитории считаются устаревшими. Ничего не потеряно: трекинг привычек, когнитивные принципы, сетевые связи и лимиты — теперь часть ядра IDP.

---

## 🚀 Зачем это нужно

Intelligent Data Pro — это «операционная система продуктивности» для людей, которые хотят соединить личное счастье и рабочую эффективность. Здесь нет дилеммы «карьера или жизнь»: у вас один инструмент, где проекты, области жизни, события и привычки образуют цельную картину. Система помогает **планировать**, **делать** и **анализировать**, а не разбрасываться по разным приложениям.

---

## 🧠 Ключевые принципы

- **PARA‑first.** Проекты принадлежат **Областям**. Любая сущность (задача, ресурс, событие и т.д.) обязана иметь **Area** или **Project**; при наличии проекта область наследуется автоматически. Быстрый ввод без контейнера падает в системную область «Входящие» (создаётся при запуске и не подлежит удалению/редактированию). В БД все таблицы содержат обязательное поле `area_id` (по умолчанию — «Входящие»). Subjective overrides позволяют для конкретного пользователя привязать Project/Task/Resource к другой Area/Project без дублирования данных.
- **Один источник истины.** Напоминания — часть календаря (аналог `VALARM`), задачи — это `CalendarItem(kind='task')`. Без дублирования логики.
- **Время как ресурс.** Встроенный тайм‑трекер, один активный таймер на пользователя, аналитика трудозатрат.
- **Гибрид «личное ↔ командное».** Роль **single** — личный менеджер. Роль **multiplayer** и выше — командная платформа, проекты с Telegram‑уведомлениями.
- **Интеграции без боли.** Google Calendar (двухсторонняя синхронизация через `syncToken` и `watch`‑каналы), Telegram‑бот для групп/личных уведомлений.

---

## 🧩 Модули системы

### 1) PARA: Второй мозг
- **Areas / Projects / Resources / Archive**, Inbox для быстрого захвата.
- Бэклинки, поиск, граф связей (эволюционирует на основе подходов Zettelkasten).
- Иерархические Areas (деревья без ограничений глубины).

### 2) Calendar & Reminders (единый календарь)
- События и задачи в одном представлении, **напоминания** встроены (без отдельного сервис‑двойника).
- Представления: Календарь (Month/Week/Day), Повестка, Список.
- Экспорт **ICS‑фида** (VEVENT/VTODO + VALARM), фичефлаг `CALENDAR_V2_ENABLED`.
- **Google Calendar**: OAuth, initial/incremental sync (`syncToken`), push (`channels.watch`), `extendedProperties.private` для устойчивого маппинга.
- Переключатель в UI: **«Показывать задачи»** и **«Только запланированные»** — чтобы календарь не «заспамливался».

### 3) Tasks & Time (PARA‑first)
- **Task = CalendarItem(kind='task')**: даты `start_at`/`end_at`/`due_at`, повторы `rrule`, напоминания через календарь.
- **Таймеры**: запуск/стоп из карточки задачи или отдельно. Если таймер запущен без задачи — создаётся «быстрая» задача в **Области «Входящие»** (без дат), чтобы «таймер не висел в воздухе».
- **Аналитика времени**: срезы по проектам/областям/дням/пользователям, burn‑up по проектам, отчёты «фокус‑часы».
- **Статусы**: `open → in_progress (старт таймера) → done`, поддержка `blocked/archived`.
- **Telegram‑уведомления по проектам**: создание/сдвиги сроков, пред‑дедлайновые напоминания, недельные дайджесты.

### 4) Notes & Habits (интеграция HabitMinder)
- Заметки/ресурсы привязываются к Areas/Projects, умеют бэклинки.
- **Привычки**: ежедневные/еженедельные, streaks, прогресс; встроены в дашборд «Сегодня».
- Рутины и ритуалы можно связать с задачами/событиями календаря.

### 5) Уведомления и интеграции
- **Telegram**: групповые каналы привязываются к проектам, бот @intDataBot.
- **Email/WebPush/Webhook** (по каналам): канал доставки задаётся на уровне напоминаний/правил.

## 🎛️ Кастомизация дашборда
Теперь дашборд настраивается: пользователь сам выбирает виджеты и их расположение.

Настройки хранятся в **`user_settings`**:
- `dashboard_layout` — раскладка (JSON).
- `favorites` — избранное меню (перенесено из users_favorites).

Мини-API для интеграций:
```
GET  /api/v1/user/settings?keys=dashboard_layout,favorites
GET  /api/v1/user/settings/{key}
PUT  /api/v1/user/settings/{key}   # body: { "value": { ... } }
```

Если настроек нет — используется дефолтная раскладка (фолбэк).

---

## 🏗️ Архитектура (вкратце)

- Монорепо с разделением ответственности: `core/` (модели, сервисы), `web/` (FastAPI + шаблоны), `bot/` (Aiogram‑бот).
- Данные: PostgreSQL, схема через идемпотентные DDL + `repair` (без Alembic), время — **UTC + tzid**, повторы — `RRULE` без материализации бесконечных рядов.
- Google Calendar: OAuth + `events.list` по `syncToken`, push‑каналы `watch` (учёт `resource_id/channel_id/expiration`).
- Напоминания: `Alarm` внутри `CalendarItem` (эквивалент `VALARM`), каналы — Telegram/email/webpush/webhook.
- PARA‑инвариант: у `CalendarItem/Task/TimeEntry` всегда указан `project_id` **или** `area_id`; у задач с проектом `area_id` наследуется.

### Инициализация БД (без Alembic)
При старте `web` и `bot` вызывается единая функция **`core/db/init_app.init_app_once()`** (в коде вызывается с `await`), которая:
1) применяет idempotent DDL из `core/db/ddl/*.sql`,
2) выполняет `repair` (перенос favorites, дефолтные Areas и т.д.),
3) при локальной разработке (флаг `DEV_INIT_MODELS=1`) может вызвать `create_all()` — это только фолбэк.

```dotenv
DB_BOOTSTRAP=1
DB_REPAIR=1
DEV_INIT_MODELS=0
```

---

## 📦 Структура репозитория

```
core/             # модели, сервисы, логирование, интеграции
core/db/migrations/ # SQL-миграции
web/              # FastAPI-роуты, HTML-шаблоны, статические файлы
bot/              # Telegram-бот (aiogram), хендлеры, FSM
docs/             # документация, бэклоги, инструкции
utils/            # утилиты (проверки БД/зависимостей и т.п.)
```

**Правила разработки**
- Новую бизнес‑логику выносить в `core/` (переиспользуемо для `web` и `bot`).
- `web/` — только HTTP/UI; `bot/` — только Telegram‑слой.
- Все JSON‑эндпойнты под префиксом **`/api/v1/*`**. Короткие пути → только UI.

---

## 🔗 Интеграции

### Подписка на календарь (ICS)
Приватный iCalendar‑фид:
```
https://<HOST>/calendar/feed.ics?scope=all&token=<TOKEN>
```
**Google Calendar**
1) «Другие календари» → «Добавить по URL» → вставьте ссылку.  
**Microsoft Outlook**
1) «Добавить календарь» → «Из интернета» → вставьте ссылку.  
**Apple Calendar**
1) «Файл» → «Новая подписка на календарь…» → вставьте ссылку.

### Telegram
- Лэндинг бота: **/bot**. Инструкция по `chat_id`: `docs/telegram_chat_id.md`.
- Для проектных уведомлений добавьте бота в группу и выдайте необходимые права.

---

## ⚙️ Настройка окружения

Добавьте файл `.env` в корень:

```dotenv
# Брендинг
BRAND_NAME="Intelligent Data Pro"
PUBLIC_URL="https://intdata.pro"
TG_BOT_USERNAME="intDataBot"
BOT_LANDING_URL="https://intdata.pro/bot"

# Приложение
API_BASE="/api/v1"
API_URL="http://localhost:5800"
APP_MODE="single"                    # single|multiplayer|moderator|admin
CALENDAR_V2_ENABLED=true

# Безопасность и сессии
SESSION_MAX_AGE=86400

# БД
DATABASE_URL="postgresql://user:pass@host:5432/intdata"

# Интеграции
TG_BOT_TOKEN="123:ABC"
GOOGLE_CLIENT_ID="...apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="..."
GCAL_WEBHOOK_URL="https://<HOST>/integrations/google/webhook"

# Планировщик (уведомления/дайджесты)
ENABLE_SCHEDULER=1
```

---

## ▶️ Быстрый старт

```bash
pip install -r requirements.txt

# миграции БД
python -m core.db.migrate

# запуск приложения
uvicorn main:app --host 0.0.0.0 --port 5800
# или (если точка входа web/app отличается)
uvicorn web:app --host 0.0.0.0 --port 5800
```

При старте `bot` и `web` модулей выполняется `await core.db.init_app.init_app_once(env)`:
при `DB_BOOTSTRAP=1` применяются DDL из `core/db/ddl`, затем ремонт `run_repair`.

Навигация по UI:
- `/` → редирект на `/auth`
- `/auth` → регистрация/вход (опционально — Telegram Login Widget)
- `/dashboard` → дашборд «Сегодня» (задачи/события/напоминания/привычки)
- `/tasks`, `/calendar`, `/notes`, `/time`

Swagger UI: **`/api`**, спецификация: **`/api/openapi.json`**.  
Все серверные API — только под **`/api/v1/*`**.

---

## 🧭 Persona‑тексты (шапка, без ролей в UI)

Персональные тексты берутся из `app_settings`:
```
ui.persona.single.label.ru = Второй мозг
ui.persona.single.tooltip_md.ru = Ваш второй мозг — внешний контур памяти и обдумывания.
ui.persona.single.slogan.ru = Работайте во «втором мозге».
```
В UI видны только `label`, `tooltip_md` и `slogan`.

---


## 🧰 Траблшутинг

- **«Bot domain invalid»** — проверьте `/setdomain` в @BotFather и `TG_BOT_USERNAME` **без** `@`.
- **В календаре «слишком много задач»** — отключите «Показывать задачи» или включите «Только запланированные».
- **Дубли напоминаний** — напоминания создавайте только через календарь; в задачах нет отдельного дублирующего механизма.
- **Активный таймер уже запущен** — в системе разрешён только один активный таймер на пользователя (остановите текущий перед стартом нового).

---

## 🤝 Вклад и лицензия

Pull/MR с тестами приветствуются. Смотрите [Changelog](#-changelog), [Roadmap & Epics](#-roadmap--epics) и [AGENTS.md](./AGENTS.md).
Лицензия проекта — см. файл **LICENSE** (если отсутствует — действует стандартная лицензия репозитория).

---

### Примечание о миграции HabitMinder и NexusCore Balance

Функции «трекинга привычек», «когнитивных принципов», «графа связей», «энергетических ограничений» и проч. **не удалены** — они интегрированы в ядро Intelligent Data Pro (Notes/Habits/Analytics). Используйте текущие разделы приложения: привычки и прогресс — в дашборде, сетевые связи и бэклинки — в модуле Resources/Notes, ограничения и контекст — в PARA/Tasks & Time.

---

## 🗂️ Idea Log
Этот раздел фиксирует сырые продуктовые и инженерные идеи до формализации. Используйте его как журнал гипотез и наблюдений.

### Формат записи
- **Дата (UTC)** — когда идея зафиксирована.
- **Автор / сессия** — кто предложил (псевдоним агента или человек).
- **Краткое описание** — одна-две строки сути.
- **Контекст / предпосылки** — почему идея возникла.
- **Связанные материалы** — ссылки на чаты, коммиты, исследования.
- **Следующие шаги** — что нужно проверить, чтобы перейти к проработке (может быть пустым).

### Текущий backlog идей
- **2025-09-18 — codex — CRM Knowledge Hub (PARA × Zettelkasten)**
  - **Краткое описание**: Собрать собственную CRM как узел знаний: сделки и участники привязаны к PARA, карточки включают заметки и связи в стиле Zettelkasten.
  - **Контекст / предпосылки**: Bitrix24 демонстрирует, как контакт-центр, автоматизация и аналитика работают в единой системе; amoCRM показывает удобные цифровые воронки и виджетные карточки; PARA/Zettelkasten задают каркас организации знаний.
  - **Связанные материалы**: Bitrix24 CRM обзор 2025; amoCRM 2025 overview; Forte Labs PARA; Taskade Zettelkasten.
  - **Следующие шаги**: Описать целевое решение в разделе [Vision Deck](#-vision-deck), добавить эпик в [Roadmap & Epics](#-roadmap--epics) (E18), оценить схему данных и автоматизации.
- **2025-09-18 — codex — Модульная навигация AppShell**
  - **Краткое описание**: Ввести одноуровневые секции и избранное в левом меню, а также верхние вкладки модулей для снижения перегрузки навигации.
  - **Контекст / предпосылки**: Пользователи жалуются на длинный список страниц; исследование от 2025-09-18 показало удачные паттерны Bitrix24, ClickUp, Notion, monday.com и Atlassian. Владельцу важно, чтобы всё левое меню считалось избранными страницами без дублей.
  - **Связанные материалы**: docs/reports/2025-09-18-modular-navigation-research.md.
  - **Следующие шаги**: Детализировать решение в [Vision Deck](#-vision-deck), обновить правила в [Conventions Catalog](#-conventions-catalog) и задачи в [Tasklist](#-tasklist).

## 🎯 Vision Deck
Этот раздел агрегирует проработанные идеи из [Idea Log](#-idea-log) и описывает целевые решения на уровне концепций. Здесь фиксируется «как должно работать» до детализации задач.

### Структура
- **Инициатива / кодовое имя** — отсылка к записи в [Idea Log](#-idea-log) или эпикам из [Roadmap & Epics](#-roadmap--epics).
- **Цель** — какую пользовательскую или операционную проблему решаем.
- **Ключевые сценарии** — пользовательские флоу, которые должны поддерживаться.
- **Технический подход** — основные решения по архитектуре, данным, API, UI.
- **Ограничения и риски** — технические, продуктовые, организационные.
- **Критерии успеха** — метрики, инварианты, признаки завершённости.

### Активные инициативы

#### Modular Navigation (E17)
- **Цель** — сократить когнитивную нагрузку от длинного списка страниц и ускорить доступ к связанным инструментам.
- **Ключевые сценарии**
  1. Пользователь группирует страницы в одноуровневые секции и скрывает второстепенные пункты, не теряя возможность восстановить их через редактор.
  2. Внутри выбранного модуля пользователь переключается между связанными страницами через верхние вкладки, не покидая контекста.
  3. На любой странице пользователь отмечает её звёздочкой, чтобы добавить в персональное избранное и мгновенно добраться до неё из левого меню.
- **Технический подход**
  - Расширить `NAV_BLUEPRINT` полями `module`, `section_order`, `category`, обновить `build_navigation_payload` и API `/api/v1/navigation/sidebar*`.
  - Перестроить `AppShell` и `SidebarEditor`: секции с заголовками, collapsible, drag-n-drop внутри секции; левое меню — единый список избранных страниц, которые можно скрывать или раскрывать без дублирования; состояние хранится в `user_settings.nav_sidebar`.
  - Добавить компонент `FavoriteToggle` в AppShell header, синхронизирующийся с `user_settings.nav_sidebar` без отдельного списка избранного.
  - Верхнее меню модулей — новый компонент `ModuleTabs`, получает конфигурацию из `NAV_BLUEPRINT` и данных страницы.
  - Тесты: модульные (navigation_service), UI-снепшоты SidebarEditor/AppShell, e2e-проверка добавления избранного.
- **Ограничения и риски**
  - Необходимо сохранить обратную совместимость для пользователей без новых настроек (fallback к плоскому списку).
  - Усложнение состояния навигации требует аккуратной синхронизации между глобальными и пользовательскими пресетами.
  - Требуется сохранить поведение «один пункт — одна страница»: звёздочка только управляет видимостью, без создания копий в меню.
- **Критерии успеха**
  - Пользователь может создать кастомную секцию, скрыть пункт и восстановить его из редактора без перезагрузки.
  - Звёздочка на странице включает/выключает видимость пункта в левом меню и отображается заполненной при активном состоянии.
  - Верхние вкладки модулей корректно отображаются на мобильных устройствах (<= 400 px) и десктопах (>= 1440 px).
  - Документация в разделах [Conventions Catalog](#-conventions-catalog), [Tasklist](#-tasklist), [Changelog](#-changelog) обновлена, тесты проходят.

#### CRM Knowledge Hub (E18)
- **Цель** — построить собственную CRM, в которой сделки и участники жёстко связаны с PARA-контекстом и дополнены знаниями по клиенту.
- **Ключевые сценарии**
  1. Продакт и Customer Success видят сделки, статусы оплат и историю коммуникаций в одной карточке, без дублирования данных.
  2. Операторы контакт-центра обрабатывают входящие сообщения и звонки с подсказками AI и могут менять статус сделки.
  3. Менеджеры видят funnel-дэшборд: конверсию по этапам, лидборды активности, статус автоматизаций.
  4. Аккаунт-менеджер может менять тариф (upgrade/downgrade), фиксируя причину и последствия (авто-сообщения, счета, задачи).
- **Технический подход**
  - Добавить таблицы `crm_products`, `crm_product_versions`, `crm_product_tariffs`, `crm_accounts`, `crm_deals`, `crm_touchpoints`, `crm_subscriptions`, `crm_subscription_events` с жёсткими PARA-инвариантами (каждая запись содержит `area_id` или `project_id`).
  - Сервис `CRMService` отвечает за CRUD и автоматизации (upgrade/downgrade, паузы, возобновления).
  - Веб-интерфейс `/crm` на Next.js App Router: листинг продуктов + тарифов, канбан сделок, карточка аккаунта, аналитика.
  - Телеграм-бот переиспользует CRMService для создания лидов и управления подписками.
  - Контакт-центр интегрируется через очередь заданий и `intbridge` (смежный репозиторий).
- **Ограничения и риски**
  - Нужно сохранить совместимость с текущей моделью подписок (модули HabitMinder/NexusCore).
  - Требуется обеспечить идемпотентность автоматизаций (особенно при ретраях задач очереди).
  - Необходимо разделить доступы: роли CRM не должны автоматически получать доступ ко всем данным PARA.
- **Критерии успеха**
  - Создание продукта/тарифа в CRM автоматически обновляет `/crm/products` и доступно в API.
  - Upgrade/downgrade сохраняет событие, пересчитывает биллинг и генерирует уведомления/задачи.
  - Контакт-центр отображает timeline коммуникаций и активирует подсказки AI.
  - Документация обновлена: [Conventions Catalog](#-conventions-catalog), [Tasklist](#-tasklist), [Changelog](#-changelog).

## 📐 Conventions Catalog
Здесь фиксируются правила разработки и документирования, которые выводятся из разделов [Vision Deck](#-vision-deck), исторических решений и lessons learned. Раздел служит единой точкой правды для стайлгайдов всего репозитория.

### Как пользоваться
1. Перед началом задачи прочитайте соответствующий подраздел.
2. Если в ходе работы возникает необходимость обновить правила — обсудите изменения в [Vision Deck](#-vision-deck), затем зафиксируйте обновление здесь, приложив ссылку на решение в [Roadmap & Epics](#-roadmap--epics) или [Changelog](#-changelog).
3. При код-ревью и автоматических проверках ссылайтесь на конкретные пункты этого раздела.

### Разделы (шаблон)
- **Git & ветки** — формат веток, коммитов, PR.
- **Документация** — как вести Idea/Vision/Tasklist/Workflow.
- **Фронтенд** — стайлгайд Next.js, React, Tailwind.
- **Бэкенд** — Python, FastAPI, SQL.
- **Тесты** — уровни, инструменты, naming.
- **Инфраструктура** — деплой, конфигурации, observability.

*(Наполняем разделы по мере утверждения правил.)*

### Фронтенд
- Используем компонент `TermHint` для пояснения непонятных терминов (slug, Telegram ID, CRM-метрики и др.). Любой новый UI обязан добавлять тултип, если термин не очевиден основной аудитории.
- Кнопки связи с техподдержкой и разработчиком отображаем только при наличии соответствующего тарифа (см. `AppShell`: флаги `hasPaidSupport` и `hasDeveloperContact`).
- Плашку с ролью пользователя в `AppShell` показываем только на ширинах `lg` и шире, чтобы мобильная шапка не ломалась; на узких экранах оставляем аватар и имя.
- Редактор дашборда (перетаскивание и палитра виджетов) доступен только на десктопе (`min-width: 768px`); на мобильных отображаем статичную сетку без управляющих кнопок.
- Боковая навигация AppShell строится по секциям (Пульт, Календарь, Задачи, Знания, Команда, Администрирование) с одноуровневыми списками. Секции могут сворачиваться, но скрытые пункты остаются в редакторе; источником правды служит `NAV_BLUEPRINT` (см. [Vision Deck](#-vision-deck), инициатива «Modular Navigation»).
- Всё левое меню — избранные страницы пользователя: каждый пункт присутствует в единственном экземпляре и может быть только показан или скрыт. Звёздочка в заголовке управляет видимостью пункта и синхронизируется с редактором навигации.
- Для модулей с несколькими страницами добавляем верхние вкладки `ModuleTabs`, которые адаптируются под ширины 360–1440 px и позволяют переходить между связанным функционалом без изменения контекста.
- Модуль `/crm` строится на Next.js App Router: корень редиректит на `/crm/products`, страницы `/crm/deals`, `/crm/accounts`, `/crm/analytics` подключают отдельные модули из `web/components/crm`. Продукты, тарифы и потоки визуализируются внутри одного layout с drag-free карточками и формой переходов.
- Страница `/products` стала прокси на `/crm/products`; любые новые настройки для каталога добавляем в CRM-модуль, а не в legacy-каталог.
- Поле входа в форме авторизации автоматически определяет режим (`username`/`email`/`phone`) по вводу: используем единый `<input>` с обработчиком и подсказкой «автоопределение по вводу». Placeholders и `autoComplete` переключаются синхронно.

### Бэкенд
- Контакт в CRM создаём в `users_web`: имя пользователя опциональное, но email или телефон обязателен. В БД действует чек `users_web_contact_present` (username OR email OR phone).
- Новые таблицы CRM (`crm_products`, `crm_product_versions`, `crm_product_tariffs`, `crm_accounts`, `crm_deals`, `crm_touchpoints`, `crm_subscriptions`, `crm_subscription_events`) обязательно сохраняют PARA-контекст (`project_id` или `area_id`), поле `config/context` хранит доп. метаданные в формате JSONB.
- Сервис `CRMService` — фасад для CRUD по продуктам, тарифам, потокам, аккаунтам, сделкам и подпискам. Любые новые операции (upgrade/downgrade, события таймлайна) реализуем через него, чтобы Telegram-бот и веб использовали единый слой.
- API `/api/v1/crm/products` возвращает продукты с тарифами и потоками; запросы пишем через React Query. Переходы между тарифами выполняются POST `/api/v1/crm/subscriptions/transition` c `transition_type` (`free|upgrade|downgrade`).

## 🛠️ Workflow Playbook
Этот раздел описывает, как агенты codex-cli преобразуют [Tasklist](#-tasklist) в выполненную работу, следуя [Vision Deck](#-vision-deck) и [Conventions Catalog](#-conventions-catalog).

### Базовый цикл
1. **Синхронизация** — свериться с [Agent Sync](./AGENTS.md#agent-sync) и статусами в [Tasklist](#-tasklist).
2. **Анализ** — прочитать соответствующие записи в [Vision Deck](#-vision-deck) и [Conventions Catalog](#-conventions-catalog).
3. **План** — составить план (используя `update_plan`), сославшись на связанную задачу.
4. **Исполнение** — работать строго в рамках забронированных файлов, регулярно обновляя бронь в Agent Sync.
5. **Документация** — при изменении правил обновлять [Conventions Catalog](#-conventions-catalog), этот раздел и профильные гайды; исследования складывать в `docs/reports/*`.
6. **Завершение** — push в свою ветку, обновление Agent Sync, фиксация результатов в [Tasklist](#-tasklist) и [Changelog](#-changelog).

### Правила для нескольких сессий
- Никогда не модифицируйте файл, который заблокирован другой сессией в Agent Sync или lock-файле.
- Если требуется общий файл, инициируйте синхронизацию (комментарий в Agent Sync + ожидание ответа).
- Все временные решения фиксируйте в [Idea Log](#-idea-log) или [Vision Deck](#-vision-deck), а не в комментариях коммитов.

### Эскалация
- При конфликте в репозитории — остановите работу и задокументируйте ситуацию в разделе «Инциденты» ниже.
- После урегулирования переложите lessons learned в [Conventions Catalog](#-conventions-catalog).

### Инциденты
- *(пока пусто)*

## 📝 Tasklist
Раздел отражает конкретные задачи, вытекающие из текущего [Vision Deck](#-vision-deck). Это «оперативный» список для планирования.

### Формат записи
```
## <Инициатива / эпик>
- [ ] <ID задачи> — краткое описание (ответственный, ожидания, ссылки)
```

### Правила ведения
1. Задача появляется в Tasklist только после того, как идея описана в [Vision Deck](#-vision-deck).
2. В каждой задаче делайте ссылки на эпик из [Roadmap & Epics](#-roadmap--epics) и, при необходимости, на конкретные разделы Vision/Conventions.
3. После завершения ставьте отметку `[x]` и добавляйте ссылку на PR/коммит.
4. Если задача разбивается — создайте подпункты или новую секцию и синхронизируйте с Roadmap & Epics.

### Текущий список

#### E3: API / Calendar & Notes
- [x] TL-2025-09-19-notes-assign-detached — Исправить DetachedInstanceError при `POST /api/v1/notes/{id}/assign`, убедиться что ответ содержит `area`/`project` без ленивых загрузок (owner: codex, ветка `feature/E3/notes-assign-detached-codex`, PR [#102](https://github.com/LeoTechRu/intData/pull/102), см. [E3](#e3-api-calendar-calendaritems-calendaragenda-calendarfeedics-projectsidnotifications)).

#### E9: Тесты и документация
- [ ] TL-2025-09-19-pytest-postgres-env — Настроить pytest на PostgreSQL через `TEST_DATABASE_URL`/`TEST_DB_*` в `.env`, чтобы тестовая база не конфликтовала с рантаймом (owner: codex, ветка `feature/E9/test-postgres-env-codex`, см. [E9](#e9-%D1%82%D0%B5%D1%81%D1%82%D1%8B-%D0%B8-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%86%D0%B8%D1%8F-%D1%84%D0%B8%D1%87%D0%B5%D1%84%D0%BB%D0%B0%D0%B3)).
- [ ] TL-2025-09-19-test-branch-deploy — Настроить ветку `test` с автоматическим деплоем в тестовый контур и запретом автоудаления (owner: TBD, см. [E9](#e9-%D1%82%D0%B5%D1%81%D1%82%D1%8B-%D0%B8-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%86%D0%B8%D1%8F-%D1%84%D0%B8%D1%87%D0%B5%D1%84%D0%BB%D0%B0%D0%B3)).
- [ ] TL-2025-09-19-test-secrets — Вынести секреты `TEST_*` (БД, URL, бот) и подготовить токен `@intDataTestBot` для тестового контура (owner: TBD, см. [E9](#e9-%D1%82%D0%B5%D1%81%D1%82%D1%8B-%D0%B8-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%86%D0%B8%D1%8F-%D1%84%D0%B8%D1%87%D0%B5%D1%84%D0%BB%D0%B0%D0%B3)).
- [ ] TL-2025-09-19-test-runbook — Описать release-runbook `test → main` и smoke-чеклист (owner: TBD, см. [E9](#e9-%D1%82%D0%B5%D1%81%D1%82%D1%8B-%D0%B8-%D0%B4%D0%BE%D0%BA%D1%83%D0%BC%D0%B5%D0%BD%D1%82%D0%B0%D1%86%D0%B8%D1%8F-%D1%84%D0%B8%D1%87%D0%B5%D1%84%D0%BB%D0%B0%D0%B3)).
- [ ] TL-2025-09-19-pytest-postgres-migration — Заменить sqlite-фикстуры на PostgreSQL во всех тестах (`tests/**`), устранить FK-конфликты seed-данных (owner: codex, ветка `feature/E9/test-postgres-env-codex`; сделано: Postgres-фикстуры, `ensure_user_stats`, перенос ключевых web/API тестов; осталось: добить зависание `tests/test_habit_service.py` и полный `pytest -q`).

#### E17: Frontend Modernization
- [ ] TL-2025-09-18-nav-blueprint — Расширить NAV_BLUEPRINT и API `/api/v1/navigation/sidebar*` полями модулей и секций (owner: codex, ветка `feature/E17/menu-grouping-codex`, см. [E17](#e17-frontend-modernization)).
- [ ] TL-2025-09-18-appshell-modules — Перестроить AppShell и SidebarEditor: секции + collapsible, единый список избранных страниц без дублей (owner: codex, ветка `feature/E17/menu-grouping-codex`).
- [ ] TL-2025-09-18-module-tabs — Добавить верхние вкладки модулей и компонент FavoriteToggle, управляющий видимостью страниц в меню (owner: codex, ветка `feature/E17/menu-grouping-codex`).
- [ ] TL-2025-09-19-appshell-nav-tuning — AppShell: компактный header на мобайле, независимый скролл, вкладки модулей справа от сайдбара и сворачиваемые секции меню с управлением страницами (owner: codex, ветка `feature/E17/appshell-nav-tuning-codex`).
- [x] TL-2025-09-18-bot — Восстановить публичный лендинг `/bot` на Next.js (agent: codex, ветка `feature/E17/bot-landing-codex`).
- [x] TL-2025-09-18-groups — Перенести `/groups`, `/groups/manage/{id}` и `/products` на Next.js, добавить тултипы `TermHint`, удалить legacy-шаблоны и `ui_router` (agent: codex, ветка `feature/E17/groups-products-ui-codex`).
- [x] TL-2025-09-18-support — Обновить лендинг `/tariffs` (кликабельное сообщество, упоминания поддержки) и добавить условные кнопки поддержки в AppShell (agent: codex, ветка `feature/E17/groups-products-ui-codex`).
- [x] TL-2025-09-18-legacy-final — Завершить перенос legacy-страниц: включить `/products` и `/groups` в AppShell, перевести `/ban` и `/cup/admin-embed` на Next.js, удалить Jinja-шаблоны и статические JS/CSS (agent: codex, ветка `feature/E17/legacy-migration-codex`).
- [x] TL-2025-09-18-mobile-ui — Подточить мобильную адаптивность AppShell и дашборда (`/`): убрать чип роли на узких экранах, перестроить сетку шапки, скрыть редактор дашборда (agent: codex, ветка `feature/E17/mobile-responsive-ui-codex`).

#### E18: CRM Knowledge Hub
- [x] TL-2025-09-18-crm-blueprint — Подготовить архитектурный план CRM (PARA × Zettelkasten), описать автоматизации и данные в [Vision Deck](#-vision-deck) (owner: codex, epic E18).
- [x] TL-2025-09-19-crm-ddl — Добавить DDL для продуктов, тарифов, версий, сделок, подписок и коммуникаций (`core/db/ddl`, SCHEMA, repair); обеспечить наследование PARA и отсутствие новой таблицы для клиента (owner: codex).
- [x] TL-2025-09-19-crm-services — Реализовать `core/services/crm` (products, deals, accounts, subscriptions, automations) с поддержкой upgrade/downgrade потоков (owner: codex).
- [x] TL-2025-09-19-crm-ui — Собрать модуль `/crm` (deals канбан, accounts, products с тарифами/потоками, analytics), перенести legacy `/products` и добавить knowledge panel (owner: codex).
- [x] TL-2025-09-19-auth-multichannel — Обновить авторизацию (username/email/телефон) и UI-автодетект режима, синхронизировать API/бот (owner: codex).


## 🗺️ Roadmap & Epics

## Оглавление
- [Roadmap & Milestones](#roadmap--milestones)
- [Решения по архитектуре (ПРОЧНО)](#решения-по-архитектуре-прочно)
- [Эпики](#эпики)
  - [E1: PARA-first доменная модель (Areas/Projects/CalendarItem/Alarm)](#e1-para-first-доменная-модель-areasprojectscalendaritemalarm)
    - [E1a: Иерархические Areas](#e1a-иерархические-areas)
  - [E2: Миграции БД и индексы](#e2-миграции-бд-и-индексы)
  - [E3: API (Calendar: /calendar/items, /calendar/agenda, /calendar/feed.ics, /projects/{id}/notifications)](#e3-api-calendar-calendaritems-calendaragenda-calendarfeedics-projectsidnotifications)
  - [E4: Синхронизация с Google Calendar](#e4-синхронизация-с-google-calendar)
  - [E5: Telegram-уведомления](#e5-telegram-уведомления)
  - [E6: ICS-фиды](#e6-ics-фиды)
  - [E7: Роли и режимы (single/multiplayer)](#e7-роли-и-режимы-singlemultiplayer)
  - [E8: Совместимость с /Alarms](#e8-совместимость-с-alarms)
  - [E9: Тесты и документация, фичефлаг](#e9-тесты-и-документация-фичефлаг)
  - [E10: Capture (бот/веб, Inbox)](#e10-capture-ботвеб-inbox)
  - [E11: Search & Retrieval (поиск, бэклинки, wikilinks, граф)](#e11-search--retrieval-поиск-бэклинки-wikilinks-граф)
  - [E12: Calendar/Alarms Fusion («Сегодня» — общий список)](#e12-calendaralarms-fusion-сегодня--общий-список)
  - [E13: Tasks & Time (PARA-first)](#e13-tasks--time-para-first)
  - [E14: Insights & Reports (ревью Areas, фокус-часы)](#e14-insights--reports-ревью-areas-фокус-часы)
  - [E15: User-configurable dashboard (user_settings)](#e15-user-configurable-dashboard-user_settings)
  - [E16: Habits](#e16-habits)
  - [E17: Frontend Modernization](#e17-frontend-modernization)
  - [E18: CRM Knowledge Hub (PARA × Zettelkasten)](#e18-crm-knowledge-hub-para--zettelkasten)
- [MR-план](#mr-план)
- [Definition of Done](#definition-of-done)
- [Appendix: Notes from merge](#appendix-notes-from-merge)

## Roadmap & Milestones
- M1 Foundations — P0•L — базовая схема PARA, миграции, модели.
- M2 Capture — P0•M — быстрые заметки (бот/веб/API), Inbox.
- M3 Organize & Search — P0•M — присвоение контейнеров, бэклинки, поиск.
- M4 Automations — P1•L — правила, клиппер, интеграции.
- M5 Insights — P2•M — ревью Areas, отчёты по времени.
- M6 Habits — P0•M — модуль привычек (клон логики Habitica) с PARA-инвариантами.

## Agent Sync
> Операционная таблица броней хранится в [AGENTS.md](./AGENTS.md#agent-sync) и обновляется агентами codex-cli. Этот раздел README фиксирует только стратегический контекст.


## Решения по архитектуре (ПРОЧНО)
- **PARA-инвариант**: `project_id` OR `area_id` обязателен для каждого `CalendarItem`, `Task`, `TimeEntry`, `Habit`, `Daily`, `Reward`; всё без контейнера — в системную Area «Входящие».
- **Alarm** — часть `CalendarItem` (эквивалент `VALARM`).
- **Время**: UTC + `tzid`, поддержка `RRULE` без материализации бесконечных рядов.
- **Google Sync**: `syncToken`, `channels.watch` (`resource_id`, `channel_id`, `expiration`), `extendedProperties.private`.
- **Telegram**: уведомления по проектным каналам (`chat_id < 0`), правила `on_create`, `on_change_time`, `pre_due`, `digest_weekly`.
- **Tasks** наследует `area_id` проекта; дефолтная Area «Входящие» (per user/workspace, создаётся автоматически и не удаляется).
- **Habits**: у `Habit/Daily/Reward` обязателен `area_id`; при наличии `project_id` — `area_id` наследуется от проекта. Dailies интегрируются в календарь **виртуально** (agenda/ICS), без дублирования данных.
- **RPG-экономика**: `XP/Gold/HP/Level/KP` — отдельное состояние пользователя (простые формулы; идемпотентный cron по локальной дате пользователя).
- **Subjective overrides**: `para_overrides(owner, entity_type, entity_id, override_project_id?, override_area_id?)`.
- **Таймер**: один активный на пользователя (`UNIQUE` индекс `WHERE stopped_at IS NULL`).

## Эпики

### E1: PARA-first доменная модель (Areas/Projects/CalendarItem/Alarm)
**User Stories**
1. Как пользователь, я создаю **Area** «Маркетинг» и привязываю к ней **Projects**, чтобы группировать работу по PARA.
2. Как пользователь, я добавляю `CalendarItem` «Release v2` со временем начала/окончания и `Alarm`.
3. Как пользователь, я связываю каждый `CalendarItem` с Project или Area, чтобы не терять контекст.

**Tasks**
- P0•S — Модели: enums `ContainerType/ProjectStatus/ActivityType/TimeSource`; поля `archived_at`.
- P0•S — Сервисы: `ParaService` (CRUD Areas/Projects/Resources, assign_note, archive).
- P0•S — Обновить `TaskService/TimeService` (наследование Area/Project).

**Acceptance Criteria**
- Создание Project с `area_id=1` и именем «Landing» успешно и отображается в Area «Маркетинг».
- Создание элемента «Release v2» со стартом `2025-05-01T09:00Z` и `alarm=15m` планирует уведомление за 15 минут.
- Попытка сохранить элемент без `project_id` и `area_id` отклоняется ошибкой инварианта PARA.

#### E1a: Иерархические Areas
- P0•M — Миграция `20250830_01_areas_tree`: `areas.parent_id`, `mp_path TEXT NOT NULL DEFAULT ''`, `depth INT NOT NULL DEFAULT 0`, `slug TEXT NOT NULL`, индексы: `UNIQUE(owner_id, slug)`, `areas_mp_path_like ON areas(mp_path text_pattern_ops)`; бэкфилл: `slugify(name)`, `mp_path=slug||'.'`, `depth=0`, `parent_id=NULL`.
- P0•S — Миграция `20250830_02_projects_require_leaf_area`: у проектов гарантировать `area_id` (создать `Default Area` на владельца при NULL), листовость проверять на уровне сервиса.
- P0•S — Миграция `20250830_03_tasks_time_inherit_area`: индексы на `tasks`/`time_entries` (owner+area/project, started_at).
- P0•M — Сервис `AreaService`: `create_area(owner_id, name, parent_id?)`, `move_area(area_id, new_parent_id)`, `is_leaf(area_id)`, `list_subtree(area_id)`, `mp_path(area_id)`.
- P0•M — Валидации: при создании/редактировании `Project`/`Task` — `area_id` должен быть листом (если нет `project_id`).
- P0•S — API: `GET /api/v1/tasks|/api/v1/projects|/api/v1/time|/api/v1/notes` принимают `include_sub=0|1` (+ `area_id`, `container_type=area`), фильтрация по поддереву через `mp_path LIKE prefix%`.
- P0•S — API: `/api/v1/areas/{id}/move`, `/api/v1/areas/{id}/rename`, `/api/v1/areas/{id}/archive` (soft delete).
- P1•S — UI: иерархический `<select>` с отступом; чекбокс «Включая подкатегории» в фильтрах.
- P1•S — Админка Areas: создание/переименование/перемещение/архивирование.
- P0•S — Тесты: `AreaService` (create/move/list_subtree), валидации Project/Task, наследование TimeService, API `include_sub` на `/api/v1/tasks`.

**Acceptance Criteria**
- Можно создать дерево «Здоровье → Фитнес → Силовые», «Здоровье → Сон».
- Проект нельзя привязать к «Здоровье» (родитель), но можно к «Силовые» (лист).
- Фильтр задач/времени по «Здоровью» с `include_sub=1` показывает элементы из обеих веток.
- Перемещение «Фитнес» под другой корень обновляет `mp_path/depth` у всех детей.
- UI объясняет, что такое Area, и позволяет выбирать листья.

### E2: Миграции БД и индексы
**User Stories**
1. Как разработчик, я поддерживаю идемпотентные DDL-модули для таблиц: `areas`, `projects`, `calendar_items`, `alarms`, `notes`, `time_entries`, `habits/*`.
2. Как разработчик, я обеспечиваю CHECK‑инвариант PARA и необходимые индексы.

**Tasks**
- [x] P0•S — Машиночитаемая схема БД и автопроверка (`python -m core.db.schema_export`, CI‑check).
- [x] P0•M — Перевод миграций на простой раннер `core/db/migrate.py` + DDL `core/db/ddl/*.sql` (без Alembic).
- [x] P0•S — `projects.area_id` сделать `NOT NULL` и проиндексировать.
- [ ] P0•M — CHECK‑инвариант: у сущностей (`calendar_items`, `tasks`, `time_entries`, `habits/dailies/rewards`) должен быть ровно один из `project_id`/`area_id`.
- [ ] P0•S — Индексы `(owner_id, project_id)` и `(owner_id, area_id)` на основные таблицы для фильтрации и include_sub.
- [ ] P0•M — Подготовить baseline (pg_dump) и инициализировать Alembic, зафиксировать стартовую ревизию.
- [ ] P0•L — Вынести диагностические таблицы/колонки в Alembic и описать сценарий отката.
- [ ] P0•L — Решить стратегию идентификаторов (INTEGER ↔ UUID) и подготовить детальный план миграции.
- [ ] P1•M — Триггеры наследования `area_id` от `project_id` для `tasks` и `resources`.
- [ ] P2•S — Таблица `para_overrides` для субъективных привязок (owner, entity_type, entity_id, override_project_id?, override_area_id?).
- [ ] P2•S — Линтер `utils/para_lint.py` и запуск в CI.

**Acceptance Criteria**
- `python -m core.db.migrate` создаёт таблицы с внешними ключами и индексами по `(project_id, area_id, start_ts)`.
- Вставка `calendar_item` с обоими NULL (`project_id` и `area_id`) завершается ошибкой CHECK.
- В таблицах `notes/projects/areas/resources/tasks/time_entries` присутствуют требуемые поля и индексы, инварианты PARA соблюдаются.

### E3: API (Calendar: /calendar/items, /calendar/agenda, /calendar/feed.ics, /projects/{id}/notifications)
**User Stories**
1. Как пользователь, я получаю список и создаю элементы через `/calendar/items`.
2. Как пользователь, я просматриваю повестку по диапазону через `/calendar/agenda`.
3. Как пользователь, я подписываюсь на ICS через `/calendar/feed.ics`.
4. Как участник проекта, я вижу настройки уведомлений на `/projects/{id}/notifications`.
5. Как пользователь, я управляю Areas/Projects/Resources через `/api/v1/areas|projects|resources` и соответствующий UI.
6. Как пользователь, я присваиваю заметку контейнеру через `POST /api/v1/notes/{id}/assign`.

**Acceptance Criteria**
- `POST /calendar/items` с валидным JSON возвращает созданный объект с `id`.
- `GET /calendar/agenda?from=2025-05-01&to=2025-05-07` отдаёт элементы в диапазонe.
- Открытие `/calendar/feed.ics` во внешнем календаре показывает VEVENT с VALARM.
- `GET /projects/42/notifications` отдаёт список каналов.
- `GET/POST /api/v1/areas|projects|resources` создаёт и возвращает сущности.
- `POST /api/v1/notes/{id}/assign` переносит заметку и убирает её из Inbox.
- P1•M — Авто-предложение проекта по контексту (минимум: последний использованный).
- P1•S — Правила архивации (stale → Archive).

### E4: Синхронизация с Google Calendar
**User Stories**
1. Как пользователь, я подключаю Google через OAuth и импортирую события при начальной синхронизации.
2. Как пользователь, я делаю инкрементальную синхронизацию по `syncToken`.
3. Как разработчик, я обрабатываю push-уведомления через `channels.watch`.
4. Как разработчик, я храню `extendedProperties.private`.

**Acceptance Criteria**
- OAuth сохраняет `refresh_token`, первая синхронизация подтягивает события.
- Использование сохранённого `syncToken` возвращает только изменённые события.
- Push `POST` с известным `resource_id` инициирует повторную синхронизацию.
- `extendedProperties.private` содержит `{app_item_id:123, app_kind:'calendar', app_project_id:7, checksum:'abc'}`.

### E5: Telegram-уведомления
**User Stories**
1. Как админ проекта, я регистрирую групповой чат (`chat_id < 0`) для уведомлений.
2. Как участник, я получаю сообщение при создании элемента (`on_create`).
3. Как участник, я получаю напоминание до дедлайна (`pre_due`) и еженедельный дайджест.

**Tasks**
- [x] P0•S — Восстановить кнопку входа через Telegram на странице авторизации.
- [x] P0•S — Скрывать кнопку входа через Telegram при `TG_LOGIN_ENABLED=0`.

**Acceptance Criteria**
- `POST /projects/42/notifications` с `chat_id=-1001` привязывает канал.
- Создание элемента отправляет в Telegram `sendMessage` в канал.
- Элемент со стартом `2025-05-01T09:00Z` и `pre_due=30m` шлёт сообщение в `08:30Z`.

#### E5b: Управление Telegram-группами как CRM
**User Stories**
1. Как администратор обучения, я подключаю учебную группу к CRM, чтобы видеть статистику активности участников и быстро находить «тихих» слушателей.
2. Как менеджер продаж, я отмечаю в карточке участника, какие продукты он приобрёл, чтобы отслеживать статус оплаты.
3. Как куратор чата, я фильтрую и массово удаляю из группы пользователей, которые не купили нужный продукт к концу пробного периода.

**Tasks**
- [ ] P0•M — Сохранять статистику активности (сообщения, реакции) для участников групп и выводить лидборд за настраиваемый период.
- [ ] P0•M — Добавить сущности «Product» и «UserProduct» с указанием источника покупки и даты, редактируемые через бот и веб.
- [ ] P0•S — Реализовать `/group audit` в боте: список участников с оплатами, фильтры «нет покупки» и кнопка выгрузки в `/web`.
- [ ] P0•S — На веб-странице «Группы» показать статистику, карточку участника (статусы продуктов) и действие «Удалить из Telegram» с подтверждением.
- [ ] P0•S — Обеспечить массовое удаление по фильтру «не купили продукт X» и журнал действий (кто/когда удалил).
- [x] P0•S — Разделить сервисы CRM (продукты) и модерации групп, чтобы CRM работала независимо от интеграции с группами.
- [x] P0•S — Добавить сводку модерации групп (активность, тихие, оплаты) в ЦУП и админский сектор.

**Acceptance Criteria**
- `/group audit` в административной группе выводит топ-5 активных участников и количество сообщений за выбранный период.
- API `/api/v1/groups/{id}` возвращает участников, покупки и агрегированную активность.
- На странице `/groups/{id}` можно выбрать продукт и запустить удаление всех, кто не числится в покупателях; бот подтверждает удаление в чате.
- Для каждого удаления фиксируется запись журнала с телеграм-ID, продуктом и временем операции.

### E6: ICS-фиды
**User Stories**
1. Как пользователь, я экспортирую элементы и задачи в стандартный ICS.
2. Как пользователь, я вижу `VALARM` для элементов с напоминанием.

**Tasks**
- [ ] P0•S — Генерировать `VALARM` в `feed.ics` на основе связанных `alarms`.

**Acceptance Criteria**
- Скачанный фид содержит VEVENT для событий и VTODO для задач.
- Каждое событие с напоминанием включает компонент VALARM.

### E7: Роли и режимы (single/multiplayer)
**User Stories**
1. Как индивидуальный пользователь, я работаю в режиме **single**.
2. Как команда, мы переключаемся в режим **multiplayer** для общих Projects.

**Acceptance Criteria**
- Пользователь без команды видит только личные данные в single-режиме.
- В multiplayer-режиме участники проекта могут видеть и редактировать общие элементы.

#### E7a: Гибкая авторизация и роли
**User Stories**
1. Как владелец рабочей области, я настраиваю роли с заранее заданными правами, чтобы быстро подключать новых участников.
2. Как администратор, я назначаю права по областям и проектам, чтобы ограничить доступ к чувствительным данным (минимально необходимыми привилегиями).
3. Как архитектор платформы, я расширяю справочник прав без миграций по коду, чтобы поддерживать новые модули.

**Acceptance Criteria**
- В системе есть неизменяемая роль `admin` с полным доступом ко всем функциональностям.
- Роли описываются битовой маской прав (`BIGINT`), справочник прав задаёт уникальные коды и позиции (64 бита, расширяемо).
- При назначении роли можно указать `scope` (`global` | `area` | `project`), фактические права вычисляются с учётом наследования областей/проектов.
- Проверки доступа на веб/API используют `core.authz` сервис с методом `require(permission, scope)`; прямые обращения к `UserRole` в HTTP-слое устранены.
- Справочник и пресеты ролей (single, multiplayer, moderator, admin) инициализируются через `core/db/ddl` и могут обновляться через `core/services/access_control.seed_presets()`.
- Все операции назначения/снятия прав логируются в `core/services/audit_log` (минимум: кто, кого, какие права, когда).

**Tasks**
- [ ] P0•M — Спроектировать словарь прав (`auth_permissions`), назначить битовые позиции и описания (CRUD, настройка интеграций, управление участниками, просмотр аналитики, управление финансами, системный доступ).
- [ ] P0•L — Реализовать `core/services/access_control.py` с API: `grant_role`, `revoke_role`, `list_effective_permissions(user, scope)` и кешированием.
- [ ] P0•M — Добавить поддержку `scope_type`+`scope_id` в таблице назначений ролей, обеспечить наследование `project -> area -> global` (учесть PARA-инварианты).
- [ ] P0•S — Заменить `web/dependencies.role_required` на проверки через новый сервис и разрешить проверку как по ролям, так и по отдельному праву.
- [ ] P0•S — Покрыть unit-тестами расчёт масок и наследование прав (`tests/core/auth/test_access_control.py`).
- [ ] P0•S — Обновить `/README.md (секция «Changelog»)` и `/api/openapi.json` после внедрения новых эндпоинтов/ответов.
- [ ] P1•M — Добавить UI-редактор ролей (CRUD пресетов, назначение участникам) с отдельным разрешением `permissions.manage_roles`.

#### E7b: Каталоги профилей (Users/Groups/Projects/Areas/Resources/Products)
**User Stories**
1. Как участник рабочей области, я просматриваю каталог людей и могу быстро перейти в профиль коллеги, если имею разрешение.
2. Как пользователь, я управляю видимостью своего профиля (для конкретных людей, групп, проектов или публично) и контролирую, какие секции видят разные аудитории.
3. Как владелец группы или проекта, я публикую страницу профиля с описанием, метриками и ссылками, чтобы делиться контекстом с разрешёнными участниками.
4. Как куратор Areas, я предоставляю карточку области с ключевыми инициативами и контактами для заинтересованных участников.

**Tasks**
- [ ] P0•L — Создать унифицированную модель `entity_profiles` + `entity_profile_grants` с поддержкой типов (`user`, `group`, `project`, `area`, `resource`, `product`) и аудитории (`public`, `authenticated`, `user`, `group`, `project`).
- [ ] P0•M — Реализовать сервис профилей (`core/services/profile_service.py`) с CRUD, вычислением доступности, кешированием и аудитом изменений.
- [ ] P0•S — Обновить веб-роуты: перенести `/profile` → `/users`, добавить каталог пользователей с фильтрами и карточками, страницы `/users/{slug}` с табами «Обзор», «Активность», «Связи».
- [ ] P0•S — Добавить UI профиля для групп `/groups/{slug}`, проектов `/projects/{slug}`, ресурсов `/resources/{slug}` и продуктов `/products/{slug}`, отразить статусы приватности и CTA «Запросить доступ».
- [ ] P0•S — Реализовать каталоги Areas `/areas` и профиль `/areas/{slug}` с кратким описанием, метриками и привязками к проектам/группам.
- [ ] P0•S — Обновить API `/api/v1/*` для выдачи профиля и каталога с учётом прав доступа; включить флаги видимости и аудитории.
- [ ] P0•S — Обеспечить управление разрешениями на профили через веб-форму (выбор аудиторий, выдача грантов конкретным пользователям/группам/проектам) и соответствующие API.
- [ ] P0•S — Добавить тесты `tests/web/test_profiles_catalog.py`, `tests/core/test_profile_service.py`, покрывающие приватность, каталоги и выдачу доступа.

**Acceptance Criteria**
- `/users` отображает каталог доступных профилей (листинг карточек) с пагинацией и фильтрами по Areas/проектам.
- `/users/{username}` возвращает 200 только если текущий пользователь (или группа/проект, к которому он принадлежит) фигурирует в `entity_profile_grants`, иначе 403.
- `/groups/{slug}` , `/projects/{slug}` и `/resources/{slug}` отдают профиль, соответствующий настройкам видимости, включая секцию «Контакты» и метрики (участники/прогресс).
- `/areas/{slug}` отображает карточку области с ключевыми проектами и владельцем; при отсутствии разрешения — CTA «Запросить доступ»; `/products/{slug}` отображает карточку продукта с атрибутами CRM.`
- API `/api/v1/profiles/{entity_type}/{slug}` возвращает JSON с секциями профиля, а список `/api/v1/profiles/{entity_type}` фильтрует по доступности и принимает query `audience=me|group|project`.

### E8: Совместимость с /Alarms
**User Stories**
1. Как пользователь, я вижу старые напоминания в новом календаре.
2. Как разработчик, я мигрирую «сиротские» напоминания в `CalendarItem+Alarm`.

**Acceptance Criteria**
- Переход на `/reminders` отображает новый календарный UI.
- Скрипт миграции преобразует напоминание с `due=2024-12-31` в `calendar_item` с `alarm`.

### E9: Тесты и документация, фичефлаг
**User Stories**
1. Как разработчик, я включаю модуль через фичефлаг.
2. Как разработчик, я имею тесты и документацию для поддержки качества.

**Acceptance Criteria**
- `.env.example` содержит `CALENDAR_V2_ENABLED=true`, `HABITS_V1_ENABLED=true`, `HABITS_RPG_ENABLED=true`.
- CI запускает тесты на синхронизацию, API и уведомления.

**Tasks**
- P0•S — Загружать переменные окружения из `ENV_FILE` (по умолчанию `${PROJECT_DIR}/.env`).
- P0•S — Настроить pytest на PostgreSQL через `TEST_DATABASE_URL`/`TEST_DB_*` в `.env`, чтобы тестовая БД не пересекалась с runtime.
- P0•S — Публичный лендинг `/docs` с описанием PARA, Zettelkasten и тарифов, доступный без авторизации.
- P0•M — Ветка `test`: обязательный PR-флоу (feature → test → main), автоматический деплой в тестовый контур и запрет автоудаления.
- P0•M — Настроить секцию секретов `TEST_*` (БД, URL, бот) и отдельный бот `@intDataTestBot` для тестового контура.
- P1•S — Подготовить release-runbook `test → main` и автоматизировать smoke-проверки перед промоутом.
- P0•M — Перевести все pytest-фикстуры с `sqlite` на PostgreSQL (`tests/*`), убрать дублирующие локальные сессии и обеспечить pre-seed `users_tg`/`users_web` без конфликтов.

### E10: Capture (бот/веб, Inbox)
**User Stories**
1. Как пользователь, я создаю быструю заметку из чата бота `/note` и она попадает в Inbox.
2. Как пользователь, я использую кнопку «Быстрая заметка» на веб-UI.
3. Как пользователь, я сохраняю ссылку через веб-клиппер.
4. Как пользователь, я просматриваю Inbox через `/api/v1/inbox/notes` или страницу `/inbox`.

**Acceptance Criteria**
- `/note` в боте создаёт заметку без контейнера.
- Кнопка на UI создаёт заметку и отображает её в Inbox.
- `GET /api/v1/inbox/notes` возвращает все входящие и неархивные заметки.
- `POST /api/v1/notes/{id}/assign {container_type, container_id}` переносит заметку в Project/Area/Resource.
- P2•S — Веб-клиппер через bookmarklet.
- Страница `/notes` отображает цветные карточки одного размера (цвет из области) в стиле Google Keep с чипами Areas/Projects, всплывающим просмотром полной заметки и расширяемой формой добавления с закреплением.
- P2•S — Прокрасить все сущности системы по `areas.color` (использовать `getAreaColor`).
- P2•M — Сделать `area_id` обязательным для `notes` и обеспечить backfill.
- Команда `/help` в боте выводит список доступных команд и их описание.

### E11: Search & Retrieval (поиск, бэклинки, wikilinks, граф)
**User Stories**
1. Как пользователь, я ищу заметки по заголовку и содержимому.
2. Как пользователь, я вижу бэклинки к заметке.
3. Как пользователь, я создаю wikilinks `[[...]]` и получаю граф связей.

**Acceptance Criteria**
- `GET /api/v1/notes/search?q=text` возвращает найденные заметки.
- `GET /api/v1/notes/{id}/backlinks` отдаёт минимальный контракт.
- Бэклинки из `[[...]]` создают записи `Link(reference)`.
- Граф ранжирует узлы по свежести и ссылочности.

### E12: Calendar/Alarms Fusion («Сегодня» — общий список)
**User Stories**
1. Как пользователь, я вижу единый список задач, напоминаний и событий на сегодня.

**Acceptance Criteria**
- Экран «Сегодня» агрегирует `CalendarItem`, `Task`, `Alarm`, а также due-ежедневки (виртуально).

### E13: Tasks & Time (PARA-first)
Единый модуль задач и времени. `Task = CalendarItem(kind='task')`; даты start/end/due и напоминания — через календарь.

**Модель/DDL**
- `tasks(id=calendar_items.id, project_id?, area_id?, status, priority, tags[]; CHECK(project_id OR area_id); триггер наследования area_id из projects)`
- `para_overrides` учитываются при определении `effective_area_id(viewer, entity)`.
- `time_entries(id, task_id, user_id, started_at, stopped_at, duration_sec STORED, note, source, billable; UNIQUE(active timer per user) WHERE stopped_at IS NULL)`

**API**
- `/tasks` CRUD (+ `/tasks/quick`)
- `/tasks/{id}/alarms` → прокси в `/calendar/items/{id}/alarms`
- `/time/start` (если нет `task_id` — создать задачу в «Входящие» и запустить таймер)
- `/time/stop`, `/time/edit`, `/time/entries`, `/time/summary?group_by=(day|project|area|user)`
- `/calendar/agenda?include_tasks=bool&only_scheduled=bool`

**Бизнес-правила**
- Статусная машина: `open → in_progress (на старте таймера) → done`; `blocked/archived`.
- Дедлайны/повторы/напоминания — только через календарный модуль.
- Один активный таймер на пользователя; авто-стоп по правилам.

**Миграции/совместимость**
- Конвертировать старые `/time` в `time_entries`, «висячие» логи — в задачи «Входящие».
- Мягкий редирект старых `/tasks` и `/time` на новые.

**Acceptance Criteria**
- [x] старт «голого» таймера создаёт задачу в «Входящие».
- [x] задача требует `project_id` или `area_id`; при указании проекта наследует `area_id`.
- [ ] напоминания к задаче через `/calendar/items/{id}/alarms`.
- [ ] флажок календаря `include_tasks/only_scheduled` работает.
- [x] `/time/summary` даёт срезы по `project/area/day/user`.
- [x] Таймер поддерживает паузу/возобновление без создания новой записи; API предоставляет `/api/v1/time/{id}/pause|resume`.
- [ ] не более одного активного таймера на пользователя.

#### E13a: Telegram Task Manager (бот)
**User Stories**
1. Как пользователь, я создаю и переименовываю задачи через бота, чтобы управлять списком дел без веб-интерфейса.
2. Как пользователь, я устанавливаю дедлайн и расписание напоминаний через бота и получаю уведомления в нужное время.
3. Как пользователь, я отмечаю задачу как контролируемую, чтобы получать регулярные напоминания до и после срока и явно фиксировать исход («выполнена» или «не будет выполнена»).
4. Как пользователь, я просматриваю статистику завершённых, актуальных и отклонённых задач по запросу, чтобы понимать прогресс.
5. Как пользователь, я добавляю наблюдателей к задаче, чтобы они получали уведомления и могли отказаться от наблюдения.

**Tasks**
- [x] P0•M — Расширить модель задач и DDL (`tasks`, `task_checkpoints` и др.) полями контроля: `control_enabled`, `control_frequency`, `control_status{'active','done','dropped'}`, `control_next_at`, `is_watched`, `refused_reason{'done','wont_do'}`, `remind_policy` и вынести расписание напоминаний в отдельную таблицу `task_reminders`.
- [x] P0•M — Добавить таблицу `task_watchers(task_id, watcher_id, added_by, state{'active','left'}, left_reason{'done','wont_do','manual'})` и API в `core/services/task_service` для управления наблюдателями.
- [x] P0•M — Реализовать в боте FSM-команды `/task_add`, `/task_rename`, `/task_due`, `/task_remind`, `/task_control`, `/task_forget` c подтверждением выбора причины «выполнена» или «не будет выполнена» при отказе от контроля.
- [x] P0•M — Настроить планировщик (cron/worker) на базе `project_notification_worker` для отправки напоминаний и уведомлений наблюдателям (добавление, выполнение, отмена), используя `core/services/telegram_bot`.
- [x] P0•S — Добавить команды `/task_stats`, `/task_stats_active`, `/task_stats_dropped` в боте и REST `GET /api/v1/tasks/stats` для подсчёта завершённых, актуальных, отказанных задач.
- [x] P0•S — Обновить `/start` справку и документацию бота, описав новые команды и сценарии контроля.

**Acceptance Criteria**
- Команды `/task_add` и `/task_rename` создают задачу и меняют название с подтверждением результата, изменения видны в `/tasks` и API.
- При настройке дедлайна и расписания командами бота создаются записи `task_reminders`, а бот отправляет уведомления в заданные времена.
- При включении контроля бот спрашивает периодичность напоминаний, фиксирует её в `control_frequency`, присылает повторные напоминания до/после срока и требует выбор исхода («выполнена» или «не будет выполнена») при отказе.
- Команда `/task_stats` возвращает количество `done`, `active` и `dropped` задач по пользователю; отдельные команды выдают соответствующие значения.
- При добавлении наблюдателя бот уведомляет его, при `done`/`won't_do` отправляет событие, а наблюдатель может отказаться командой `/task_unwatch`.
- `/start` отражает все новые команды и права доступа.

### E14: Insights & Reports (ревью Areas, фокус-часы)
**User Stories**
1. Как пользователь, я вижу виджет «Areas due for review».
2. Как пользователь, я анализирую фокус-часы по Areas/Projects.
3. Как пользователь, я просматриваю связность графа.

**Acceptance Criteria**
- Виджет «Areas due for review» учитывает `review_interval_days`.
- Отчёт по фокус-часам агрегирует `TimeEntry` по Project/Area.
- Отчёт по графу показывает коэффициент связности.

### E15: User-configurable dashboard (user_settings)
**Tasks**
- [x] P0•M — Ребрендинг главного экрана в «ЦУП» с расшифровкой «Центр Управления Полётами» и единым копирайтингом.
- [x] P0•M — Встроить админские утилиты в ЦУП (видны только роли admin) с отдельным подзаголовком и якорем для навигации из меню.
- [x] P0•M — Перенести управление Areas из `/areas` в `/settings` с иерархической панелью и доступом по ролям.
- [x] P0•S — Санитизировать избранные ссылки (удалить устаревший `/admin`, поддержать якорь `/settings#areas`).
**Acceptance Criteria**
- Настройки пользователя хранятся в таблице `user_settings` (ключ/значение JSONB).
- Избранное перенесено в `user_settings(key='favorites')` и доступно через меню.
- Раскладка дашборда сохраняется в `user_settings(key='dashboard_layout')`.
- ЦУП предоставляет режим настройки: виджеты можно перетаскивать и скрывать/возвращать, состояние синхронизировано с `dashboard_layout`.
- API `/api/v1/user/settings` позволяет читать и обновлять отдельные ключи.
- UI страница `/settings` позволяет включать и скрывать виджеты дашборда.
- На странице `/settings` можно включать или отключать пункты избранного меню с учётом роли пользователя.
- Админский сектор доступен внутри ЦУПа (iframe `/cup/admin-embed`), прямой маршрут `/admin` отсутствует.
- Страница `/settings` содержит персональные пресеты темы (режим, основной/акцентный цвет, градиент) с предпросмотром и админский блок глобальной темы, сохраняемый в `app_settings`.

### E16: Habits
**User Stories**
1. Как пользователь, я отмечаю «плюс/минус» по привычкам и получаю мгновенную награду (XP/Gold), штраф по HP — за «минус».
2. Как пользователь, я веду **Ежедневные** по `RRULE` (например, Пн–Пт) с сериями и «заморозкой».
3. Как пользователь, я вижу **Награды** и трачу заработанное золото.
4. Как пользователь, я фильтрую всё по **Area/Project**; привычка, добавленная в проект, наследует его область.
5. Как пользователь, я вижу мини-HUD `HP/XP/Level/Gold/KP` и суммарную карму (KP).
6. Как пользователь, я отмечаю привычки/ежедневки из Telegram-бота.

**Модель/DDL (суть)**
- `habits(id, owner_id, area_id NOT NULL, project_id?, title, note, type{'positive'|'negative'|'both'}, difficulty{'trivial'|'easy'|'medium'|'hard'}, up_enabled, down_enabled, val FLOAT, tags[], archived_at, created_at)`
- `habit_logs(id, habit_id, owner_id, at, delta {-1|+1}, reward_xp, reward_gold, penalty_hp)`
- `dailies(id, owner_id, area_id NOT NULL, project_id?, title, note, rrule TEXT, difficulty, streak, frozen, archived_at, created_at)`
- `daily_logs(id, daily_id, owner_id, date, done BOOL, reward_xp, reward_gold, penalty_hp, UNIQUE(daily_id, date))`
- `rewards(id, owner_id, title, cost_gold, area_id NOT NULL, project_id?, archived_at, created_at)`
- `user_stats(owner_id PK, level, xp, gold, hp, kp, last_cron DATE)`

**API**
```
GET  /api/v1/habits/stats
POST /api/v1/habits/cron/run

GET  /api/v1/habits?area_id=&project_id=&include_sub=0|1
POST /api/v1/habits
PUT  /api/v1/habits/{id}
DEL  /api/v1/habits/{id}
POST /api/v1/habits/{id}/up
POST /api/v1/habits/{id}/down

GET  /api/v1/dailies?area_id=&project_id=
POST /api/v1/dailies
PUT  /api/v1/dailies/{id}
POST /api/v1/dailies/{id}/done   {date?}
POST /api/v1/dailies/{id}/undo   {date?}

GET  /api/v1/rewards?area_id=&project_id=
POST /api/v1/rewards
POST /api/v1/rewards/{id}/buy
```

**Экономика (дефолт, конфигурируемо)**
- `XP_BASE: trivial=3, easy=10, medium=15, hard=25`
- `GOLD_BASE: trivial=1, easy=3, medium=5, hard=8`
- `HP_BASE: trivial=1, easy=5, medium=8, hard=12`
- Затухание наград привычки: `reward_factor = exp(-k*max(0,val))` при «плюсе», усиление штрафа — при «минусе»; `val` сдвигается на `±0.1`.
- Level-up: `LEVEL_XP(lvl) = 100 + (lvl-1)*50`; `hp` подхиливается при апе.
- `KP` — накапливаемая сумма положительных XP (не обнуляется).

**Cron (идемпотентный)**
- На первом запросе дня или в фоновом джобе: проставляет `done=false` для due-ежедневок без отметки и применяет штрафы; `user_stats.last_cron = today_local`.

**Интеграция с календарём**
- `/calendar/agenda?include_habits=1` — добавляет **виртуальные** due-ежедневки (без записи в `calendar_items`).
- ICS-фид — `VTODO` с `RRULE` для ежедневок (read-only).

**UI `/habits`**
- Четыре колонки: Привычки / Ежедневные / Задачи (из `/tasks`) / Награды.
- Фильтры: Area (иерархический), Project, «Включая подкатегории».
- Мини-HUD: `HP/XP/Level/Gold/KP`; горячие клавиши `+`, `-`, `Space`.

**Бот**
- `/habit + <название>` — клик «плюс» по ближайшему совпадению; ответ: `+XP/+Gold, HP: x/y`.
- `/daily done <фраза|ID>` — отметка «сегодня выполнено».
- Недельный дайджест в проект: топ-стрики, топ-KP.
-
**Tasks**
- [x] P0•S — /habits: страница доступна по веб-сессии, write-действия требуют TG (403 `tg_link_required`).
- [x] P0•S — Кулдаун привычки отображается как 429 с заголовком `Retry-After`.
- [x] P0•S — Снимок OpenAPI синхронизирован и описывает ошибки `tg_link_required` и `cooldown`.
- [x] P0•S — Тесты на доступ, TG-требование и кулдаун.

**Acceptance Criteria**
- Создание привычки без `area_id` отклоняется; при `project_id` — `area_id` наследуется от проекта.
- Клик «+» увеличивает XP/Gold, меняет `val`; «−» снижает HP согласно сложности.
- Cron единожды штрафует пропуски за текущую локальную дату пользователя.
- `/calendar/agenda?include_habits=1` возвращает due-ежедневки; ICS содержит `VTODO` с `RRULE`.
- `/rewards/{id}/buy` списывает Gold и возвращает баланс.
- В `/habits` действия мгновенно отражаются в HUD.
- [x] `/habits` доступен по веб-сессии; write без TG возвращают 403 `tg_link_required`.
- [x] Повторный `up` в кулдауне возвращает 429 с заголовком `Retry-After` и полем `retry_after`.
- [x] `api/openapi.json` совпадает с `/api/openapi.json` и содержит модели ошибок `tg_link_required` и `cooldown`.
- [x] pytest -q подтверждает сценарии доступа без TG и кулдауна.


### E17: Frontend Modernization
Reference: см. архивный отчёт `docs/archive/report_frontend_modernization.md`.

**Tasks**
- [x] P1•M — Выбран стек **Next.js** (TypeScript + Tailwind), решение задокументировано.
- [x] P1•S — Настроен базовый layout и провайдер React Query.
- [x] P1•L — Страница `/inbox` перенесена на новый стек и покрыта тестами.
- [x] P1•M — Внедрить UI-kit (кнопки, формы, карточки) с токенами темы для Next.js страниц.
- P2•S — Удалять legacy‑шаблоны и скрипты после миграции, чистить `web/static` и пути в конфиге Tailwind.
  - [x] `/habits` перенесена на Next.js; шаблон `templates/habits.html` и `static/js/habits_v1.js` удалены.
  - [x] `/auth` обслуживается на Next.js; шаблон `templates/auth.html` и `static/js/auth_extra.js` удалены.
  - [x] `/notes` работает на Next.js; удалены `templates/notes.html`, `static/js/notes.js`, `static/css/notes.css`.
  - [x] Очистить оставшиеся legacy-ассеты (calendar) и обновить пути Tailwind.
  - [x] Завершить уборку Jinja-шаблонов (`ban`, `admin/embed`) и legacy-скриптов (`web/static/js|css|ts|ui`), перенести `/ban` и `/cup/admin-embed` на Next.js страницы.
- [x] P1•M — Перенести страницу `/time` на Next.js: активный таймер, аналитика, удаление legacy-шаблонов.
- [x] P2•M — Внедрить AppShell-лейаут Next.js с дизайн-токенами, адаптивной навигацией и современными UI паттернами для перенесённых страниц.
- [x] P2•S — Страница `/habits` работает на Next.js, использует React Query и HUD с XP/Gold/KP.
- [x] P1•M — Перенести страницу `/settings` на Next.js, добавить пункт меню «Настройки» и удалить legacy-шаблон.
- [ ] P2•M — Расширить `/habits` карточками Dailies/Rewards и фильтрами проектов после обновления API (связка с E16).
- [x] P0•M — Перенести ЦУП (`/`) на Next.js «Обзор» с современными виджетами, drag'n'drop макетом и настройками из `user_settings.dashboard_layout`.
- [x] P0•M — Перенести страницы `/groups` и `/groups/manage/{id}` на Next.js, реализовать CRM-инструменты и удалить Jinja-шаблоны `web/templates/groups/*` вместе с FastAPI `ui_router`.
- [x] P0•M — Перенести каталог `/products` и профили `/products/{slug}` на Next.js, убрать Jinja-шаблоны `web/templates/products/*` и `ui_router` модуля `web/routes/products`.
- [x] P1•S — Добавить компонент `TermHint` с тултипами для непонятных терминов (slug, Telegram ID, CRM) и использовать его на страницах Next.js.
- [x] P1•S — Обновить лендинг `/tariffs`: сделать ссылку на сообщество кликабельной, убрать прямые контакты техподдержки и разработчика из текста.
- [x] P1•S — Добавить в AppShell условные кнопки «Техподдержка» и «Связь с разработчиком» в зависимости от тарифа пользователя.
- [x] P1•S — Обеспечить адаптивность AppShell и обзора (`/`): перестроить шапку под мобильную сетку, скрывать второстепенные элементы (роль) на узких экранах и отключать редактор дашборда на мобайле.
- [x] P1•M — Перестроить AppShell: компактная мобильная шапка, вкладки модулей справа от сайдбара на десктопе, независимый скролл контента и сворачиваемые секции меню с быстрым управлением страницами.
- [x] P0•S — Вынести админский сектор в страницу «ЛК Админа» нового UI, доступную только роли `admin`, с полным набором действий.
- [x] P0•S — Маркетинговый лендинг `/tariffs`: планы Solo/Team/Pro/Enterprise, переключатель биллинга, сравнительная таблица, ROI-кейсы и FAQ; основные CTA ведут в `CONTACT_URL`.
- [x] P0•S — FastAPI-роут `/tariffs` и раздел `web/components/marketing/TariffsLanding.tsx` выступают единой SSoT по тарифам, запрещено удалять страницу при дальнейшей миграции.
- [x] P0•S — `/pricing` перенаправляет на `/tariffs`; пункт «Тарифы» убран из AppShell, CTA для апгрейда доступен на странице `/settings`.
- [x] P0•S — Публичный лендинг `/bot` на Next.js с CTA на @intDataBot, сценариями автоматизации и ссылками на тарифы/документацию.
- [x] P0•S — FastAPI-роут `/bot` отдаёт статическую Next.js страницу и остаётся в списке публичных маршрутов без редиректа на `/auth`.
- [x] P1•S — Завершить аудит оставшихся legacy-шаблонов и зафиксировать план миграции после переноса ЦУП/админки.
- [x] P1•M — Левая панель нового UI поддерживает drag-n-drop редактор меню: порядок и видимость пунктов сохраняются в `user_settings.nav_sidebar` и глобальном пресете.

**User Stories**
1. Как разработчик, я хочу единый современный фронтенд‑стек, чтобы страницы собирались одним тулчейном.
2. Как пользователь, я хочу более быстрые и консистентные страницы после миграции.

**Acceptance Criteria**
- В репозитории зафиксировано решение (Next.js или Vite), `npm run dev` стартует без ошибок.
- TypeScript и Tailwind собираются, базовый layout рендерится через новый стек.
- Страница `/inbox` работает на новом стеке, покрыта тестами и отражена в `README.md (секция «Changelog»)`.
- Удалены шаблоны и статические файлы для перенесённых страниц, конфиг Tailwind смотрит на актуальные пути, `npm run build` проходит.
- Шапка AppShell всегда центрирует единственный `<h1>` и показывает описание страницы только во всплывающем тултипе, без дублирования названия в теле страницы.
- `/tariffs` остаётся обязательным лендингом с актуальной тарифной матрицей и CTA; изменения фиксируются в `web/components/marketing/TariffsLanding.tsx` и этом backlog.

### E18: CRM Knowledge Hub (PARA × Zettelkasten)
Reference: Bitrix24 CRM (модули продаж, контакт-центр, автоматизация) и amoCRM (цифровые воронки, виджетные карточки сделок); методологии PARA/Zettelkasten как каркас знаний.

**User Stories**
1. Как руководитель продаж, я вижу статусы сделок, автоматизирую триггеры и мгновенно отвечаю клиентам в любом канале.
2. Как куратор учебных групп, я связываю участников, покупки и активность с контекстом PARA, чтобы понимать, где нужна поддержка.
3. Как аналитик знаний, я получаю связанные заметки, решения и ретроспективы (Zettelkasten) рядом с карточкой сделки и принимаю решения быстрее.

-**Tasks**
- [x] P0•L — Спроектировать CRM-сущности (`crm_products`, `crm_product_versions`, `crm_product_tariffs`, `crm_deals`, `crm_accounts`, `crm_touchpoints`, `crm_subscriptions`) с обязательной привязкой к PARA (`area_id`/`project_id`), описать DDL и обновить `core/db/SCHEMA.*`.
- [x] P0•M — Перенести существующую страницу `/products` в модуль `/crm/products`, добавить тарифы и потоки/версии, обеспечить upgrade/downgrade (платный/бесплатный) для пользователей.
- [ ] P0•M — Реализовать цифровую воронку `/crm/deals` (канбан + sales tunnels) со стадиями, автоматизациями и метриками а-ля amoCRM/Bitrix24; предусмотреть панель знаний и действия по продукту.
- [ ] P0•M — Собрать контакт-центр `/crm/accounts/{id}`: единый таймлайн коммуникаций (почта, чат, звонки, Telegram), AI-сводки, статусы операторов.
- [x] P0•M — Обновить авторизацию: единый ввод username/email/телефона, автодетект на фронтенде, унификация на бекенде; поддержать добавление клиентов в `users_web` без пароля.
- [ ] P1•M — Интегрировать Zettelkasten-принципы: атомарные заметки, бэклинки, knowledge coverage, связь сделок/контактов с `notes`.
- [ ] P1•S — Документировать CRM-архитектуру и автоматизации в `README.md (секция «Vision Deck»)`, `README.md (секция «Conventions Catalog»)` и подготовить матрицу роботов.

-**Acceptance Criteria**
- Каждая сущность CRM (продукты, версии, тарифы, сделки, аккаунты, подписки, коммуникации) хранит `area_id`/`project_id`; сделки и подписки наследуют PARA и отображаются в соответствующих обзорах и отчётах.
- Перенесённая страница `/crm/products` показывает тарифы и активные/предстоящие потоки; пользователи могут переключаться между тарифами/потоками, при этом логируется upgrade/downgrade и запускаются нужные автоматизации.
- Карточка сделки объединяет канбан-стадию, панель знаний (заметки, решения, бэклинки) и блок потоков/тарифов с возможностью переводить клиента между версиями.
- Контакт-центр объединяет входящие сообщения, звонки и ответы операторов, показывает AI-сводки; доступен виджет «ответить из CRM».
- Авторизация по username/email/телефону работает единой формой; добавление клиента без пароля (email или телефон) приводит к объединению при последующей регистрации.
- Документация (vision, conventions) содержит правила данных, автоматизации и UX CRM; `README.md (секция «Changelog»)` фиксирует релизы.

## MR-план
1. MR-1 Foundations (миграции/модели) — DoD: миграции применяются; приложение поднимается; тесты не падают.
2. MR-2 Services (ядро PARA) — DoD: assign/move/archive работают; корректная наследственность Area/Project в задачах и тайм-логах.
3. MR-3 API (контракты) — DoD: `GET/POST /api/v1/areas|projects|resources`, `/api/v1/inbox/notes`, `POST /api/v1/notes/{id}/assign`, `GET /api/v1/notes/{id}/backlinks`, `GET /api/v1/tasks?area_id=&project_id=`, `GET /api/v1/time/running`, `POST /api/v1/time/{id}/assign_task`.
4. MR-4 UI (каркас) — DoD: страницы `/inbox`, `/areas`, `/projects`, `/resources` открываются; базовый список/форма создаёт сущности и показывает данные.
5. MR-5 Bot (захват/присвоение) — DoD: `/note` создаёт заметку; `/assign` присваивает контейнер.
6. MR-6 Search (wikilinks/backlinks) — DoD: при сохранении заметки с `[[...]]` появляются `backlinks`.
7. MR-7 Reports — DoD: сервис `ReviewService` + виджет «Areas due for review»; `GET /api/v1/areas/{id}/review_due` и счётчик на дашборде.
8. **MR-8 Habits Foundations** — DDL (`habits/*`, `user_stats`), сервисы, фичефлаги `HABITS_V1_ENABLED`, `HABITS_RPG_ENABLED`, базовые тесты.
9. **MR-9 Habits API+UI** — `/api/v1/habits|dailies|rewards`, страница `/habits` (4 колонки), HUD, интеграция с `/tasks`.
10. **MR-10 Habits Calendar & Bot** — виртуальные daily в `/calendar/agenda` и ICS, команды бота, недельный дайджест, анти-фарм (мягкие лимиты).

## Definition of Done
- Inbox работает: входящие заметки видны в `/inbox` и через `GET /api/v1/inbox/notes`.
- `POST /api/v1/notes/{id}/assign` переносит заметку в Project/Area/Resource (исчезает из Inbox).
- Project требует `area_id`; Task с `project_id` автоматически наследует `area_id`.
- Тайм-лог из задачи автоматически содержит `project_id/area_id`.
- UI: `/areas`, `/projects`, `/resources`, `/inbox` доступны.
- Бот: `/note` и `/assign` работают.
- Habits: CRUD/клики/cron/награды работают; `/habits` отражает изменения в HUD; due-ежедневки видны в agenda/ICS.

## Appendix: Notes from merge
- Починена вёрстка меню избранного и отображение звёздочки на страницах.
- Виджеты дашборда скрываются согласно пользовательским настройкам, список избранного расширен и включён по умолчанию.
- Добавлены фичефлаги `HABITS_V1_ENABLED`, `HABITS_RPG_ENABLED`; дефолтные коэффициенты экономики вынесены в конфиг.
- Dailies интегрированы в календарный стек через «виртуальные» элементы (agenda/ICS), не нарушая принцип «один источник истины».

### notes
- notes: Realtime-совместная правка (OT/CRDT/locking).
- notes: История версий заметки.
- notes: Full-text search по title/content.
- notes: Страница «Архив» с батч-разархивом.
- notes: Массовые операции (bulk pin/unpin, recolor).
- notes: Горячие клавиши.
- notes: DnD-анимации/инерция (необязательно).
- notes: Drag-and-drop сортировка карточек на странице `/notes` с сохранением порядка через `POST /api/v1/notes/reorder`.
- notes: Поповер-селекторы для смены области/проекта и выбор цвета карточки.



## 📰 Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> Примечание: записи до 2025-09-19 могут ссылаться на legacy-документы в `docs/*`. Исторические ссылки сохранены для полноты контекста.

## [Unreleased]
### Added
- CRM Knowledge Hub исследование: `docs/reports/2025-09-19-crm-competitive-research.md` (Bitrix24, Kommo, HubSpot, monday.com, Salesforce, Pipedrive) и обновлённый раздел vision E18.
- Бэкенд CRM foundation: DDL `20250919_crm_foundation.sql`, новые модели SQLAlchemy, сервисные методы и API `/api/v1/crm/products`, `/api/v1/crm/subscriptions/transition` с поддержкой upgrade/downgrade потоков.
- Next.js-модуль `/crm` (страницы `/crm/products`, `/crm/deals`, `/crm/accounts`, `/crm/analytics`) с новым UI каталога продуктов, тарифов, потоков и формой переходов между тарифами.
- Автоопределение идентификатора в форме авторизации: единое поле переключается между логином, email и телефоном, синхронно обновляя placeholder и `autoComplete`.
- AppShell: модульные секции бокового меню, вкладки модуля и звёздочка «закрепить» для управления видимостью страниц без дублирования пунктов.
- Next.js-панель `/groups` и `/groups/manage/{id}` с CRM-дашбордом: цифровая воронка, участники, массовые операции, React Query; удалены Jinja-шаблоны и FastAPI `ui_router`.
- Next.js-каталог `/products` и профили `/products/{slug}` с карточками продуктов, поиском и загрузкой данных через `/api/v1/profiles/products`.
- Компонент `TermHint` для тултипов по непонятным терминам (slug, Telegram ID, CRM-метрики) и его внедрение на страницах Next.js.
- Документационный конвейер (`docs/idea.md`, `docs/vision.md`, `docs/conventions.md`, `docs/tasklist.md`, `docs/workflow.md`) и гайд `docs/guides/codex-cli-multisession.md` для согласованной работы нескольких сессий codex-cli.
- Публичный лендинг `/docs` с описанием PARA, Zettelkasten, геймификации привычек, ссылками на исследования и CTA к тарифам.
- API эндпоинты `/api/v1/time/{entry_id}/pause` и `/api/v1/time/{entry_id}/resume`, позволяющие ставить таймер на паузу и возобновлять без создания новых записей.
- Next.js-дэшборд «Обзор» (`/`) с drag-and-drop виджетами, настройками видимости и данными из нового API `/api/v1/dashboard/overview`.
- Роль-гейтед страница «ЛК Админа» (`/admin`) на Next.js, использующая `/api/v1/admin/overview` и существующие администртивные эндпоинты; legacy-встраивание `/cup/admin-embed` сохранено.
- Next.js-страница `/auth` с лендингом продукта, Telegram SSO, reCAPTCHA и магическими ссылками (вместо Jinja-шаблонов).
- Next.js-страница `/notes` с карточками, фильтрами, drag-n-drop сортировкой и модальным редактированием.
- Маркетинговый лендинг `/tariffs` (Solo/Team/Pro/Enterprise) с переключателем биллинга, сравнительной таблицей, ROI-кейсами и FAQ; FastAPI-роут `/tariffs` возвращает страницу без 404.
- API `/api/v1/auth/options` публикует конфигурацию и диагностику для страницы авторизации.
- API `/api/v1/admin/overview` и обновлённые React-компоненты для управления web/TG-пользователями, группами, брендингом и рестартами сервисов.
- Страница `/habits` на Next.js: HUD с XP/Gold/KP, фильтр по областям и управление привычками через React Query.
- API `GET /api/v1/profiles/users/@me` для получения краткого профиля текущего пользователя (аватар, роль, slug) в шапке Next.js.
- Admin API endpoint `/api/v1/admin/audit/logs` для просмотра журнала выдачи прав (миграция из NexusCore Balance).
- Модуль совместимости `core.db.legacy` c `DBConfig`, `validate_config` и `get_raw_connection` для сценариев старого Flask-приложения.
- Документ `docs/archive/nexuscore_balance.md` со сводкой переноса функционала NexusCore.
- Бэкенд задач: таблицы `task_reminders`, `task_watchers`, новые поля контроля (`control_enabled`, `control_frequency`, `control_status`, `control_next_at`, `remind_policy`, `is_watched`) и методы `TaskService` для напоминаний, наблюдателей и статистики бота.
- Telegram-команды `/task_add`, `/task_rename`, `/task_due`, `/task_remind`, `/task_control`, `/task_forget`, `/task_watch`, `/task_unwatch`, `/task_stats*` с обновлённой справкой `/start`.
- TaskReminderWorker (`core/services/task_reminder_worker.py`) и TaskNotificationService для доставки напоминаний и оповещений наблюдателям.
- Tasks (Next.js): статистика по статусам, колонки контроля/наблюдения, обновлённые таблицы и интеграция с новым API `/tasks/stats`.
- Поддержка профилей продуктов (`/products/{slug}`) с каталогом и контролем доступа.
- Режим настройки ЦУПа с drag-n-drop, скрытием и панелью скрытых виджетов.
- Личные и глобальные пресеты темы: выбор режима, палитры и градиента через расширенный color picker на странице `/settings`.
- Обзор модерации Telegram-групп в ЦУП и админском секторе: активные участники, тихие пользователи и задолженности по оплатам.
- pre-commit configuration with ruff, black, isort and basic hooks.
- developer Makefile and type checking via mypy.
- structured JSON logging with request correlation.
- `/metrics`, `/healthz` and `/readyz` endpoints.
- security headers, rate limiting and request body size guard.
- UI kit skeleton with reusable components.
- Shared Next.js UI primitives (Button, Card, Field, Input, Select, Textarea, Badge, Checkbox, Toolbar) powered by clsx/tailwind-merge для консистентного фронтенд-стайлинга.
- Time summary endpoint `/api/v1/time/summary` for aggregating durations by day, project, area or user.
- comprehensive test suite covering DB idempotency, PARA repair, OpenAPI snapshot parity and core habits/today/tasks/time flows.
- Epic E17 "Frontend Modernization" зафиксирован в README.md (секция «Roadmap & Epics») — включает выбор Next.js/Vite, TS+Tailwind, перенос страниц и очистку legacy.
- Машиночитаемая схема БД (`core/db/SCHEMA.*`) и утилита `tools.schema_export` с проверкой в CI.
- user_settings table for extensible per-user preferences.
- API `/api/v1/user/settings` to read and write settings.
- Repair step to migrate legacy favorites into user_settings.
- Возможность управлять избранными пунктами меню на странице `/settings`.
- Редактор левого меню нового UI: drag-n-drop порядок и скрытие пунктов с персональными и глобальными пресетами (`GET/PUT /api/v1/navigation/sidebar*`).
- Панель «Области жизни» на странице `/settings` с деревом PARA, быстрым созданием, переименованием и перемещением областей.
- Простые SQL-миграции и раннер `core/db/migrate.py` с таблицами календаря и уведомлений.
- Асинхронный бэкенд на aiogram + SQLAlchemy с подключением к PostgreSQL.
- Модели пользователей, групп, каналов и настроек логирования.
- `UserService` для работы с пользователями, группами и логированием.
- Команды бота: `/start`, `/cancel`, `/birthday`, `/contact`.
- Команды бота: `/setfullname`, `/setemail`, `/setphone`, `/setbirthday`; редактирование описаний групп.
- Команда бота `/help` со списком доступных команд.
- Команда `/group` и проверка членства (декоратор).
- Команды `/group audit`, `/group mark`, `/group note` с регистрацией активности и покупок прямо из чата.
- CRM для групп: продукты, дневная статистика, журнал удаления и middleware сбора активности.
- Веб-интерфейс `/groups` с API массового удаления «непокупателей» и карточками участников (продукты, теги, заметки).
- Web: ESLint, Prettier и Vitest конфигурации.
- Пример компонента React и тест на Testing Library демонстрируют рабочий стек.
- Логирование: middleware, пересылка неизвестных сообщений в группу логов, ответы админа, команды `/setloglevel` и `/getloglevel`.
- Декоратор `role_required` для проверки ролей.
- Заготовки FSM для обновления контактов и описания групп.
- Каркас веб‑приложения на FastAPI (webhook).
- Каркас таск‑системы: модель `Task`, `TaskService` и статусы задач.
- Тайм‑трекер: модель `TimeEntry`, `TimeService`, веб‑API `/time`, страница UI, команды бота `/time_start`, `/time_stop`, `/time_list`.
- Каркас календаря: модель `CalendarEvent`, `CalendarService`.
- Базовые эндпоинты календаря `/api/v1/calendar/items` и генерация `feed.ics` (заглушки).
- Административные утилиты перенесены на главную страницу «ЦУП» (доступны только роли admin) с якорем `#cup-admin-tools`.
- Таблицы `calendar_items`, `alarms`, `notification_channels`, `project_notifications`,
  `notification_triggers` и `notifications`.
- API `/api/v1/calendar/agenda` и `/api/v1/calendar/items/{item_id}/alarms`.
- Уведомления в Telegram по расписанию через проектный канал.
- REST-эндпоинты `/api/v1/app-settings` и загрузка динамических персон UI через `app_settings`.
- Персонализированная шапка с названием системы и подсказкой в зависимости от роли.
- Форма добавления напоминаний в веб-интерфейсе календаря.
- Кнопка «Добавить напоминание» для событий календаря и проверка времени напоминаний.
- Простейший DDL-раннер `core/scripts/db_bootstrap.py` и файлы `core/db/ddl/*`.
- Утилита резервного копирования БД `core/scripts/db_dump.py` (pg_dump), путь и префикс настраиваются через `.env`.
- Notes now require `area_id` and optional `project_id`; API `/api/v1/notes` returns area/project data.
- Страница `/notes` отображает адаптивные карточки с быстрым созданием и редактированием.
- Визуал заметок в стиле Google Keep с цветными карточками и закреплением.
- Цвет заметок, закрепление, архив и сортировка drag-and-drop.
- Эндпоинты `/api/v1/notes/{id}/archive`, `/api/v1/notes/{id}/unarchive`, `/api/v1/notes/reorder`.
- Привычки требуют `area_id` (проект опционален); `/api/v1/habits` возвращает данные области и проекта, по умолчанию используется «Входящие».
- Страница `/habits` с простым интерфейсом для управления привычками.
- Колонка `areas.color` с HEX-значением и дефолтом `#F1F5F9`; миграция с бэкфиллом.
- Утилита `getAreaColor` в фронтенде для кеширования цветов областей.
- AGENTS.md aligned with BACKLOG (E1–E16, Habits module, PARA invariants, agent protocol, checklist).
- Habitica-like module foundations: DDL for habits/habit_logs/dailies/daily_logs/rewards/user_stats.
- Core services: HabitsService, DailiesService, HabitsCronService, UserStatsService.
- Public API for habits, dailies, rewards, stats and cron under `/api/v1/*`.
- /habits page (4 columns), HUD, keyboard shortcuts; Telegram commands (/habit, /daily).
- Next.js frontend scaffold with React Query and Tailwind; migrated `/inbox` page.
- Feature flags HABITS_V1_ENABLED, HABITS_RPG_ENABLED in .env.example.
- Anti-farm mechanics: cooldown per habit, soft daily limit, exponential reward decay; daily_xp/daily_gold counters.
- Notes API supports `include_sub=1` for listing notes in subareas.
- Тест покрытия для `/api/v1/habits` проверки доступа без привязки Telegram и заголовка `Retry-After` при кулдауне.
- Bare timers auto-create tasks in Inbox.

### Changed
- Pytest использует переменные `TEST_DATABASE_URL`/`TEST_DB_*` из `.env`, поэтому тесты подключаются к отдельной PostgreSQL-базе без затрагивания runtime.
- AGENTS.md закрепил ветку `test`, отдельный деплой тестового контура и требования к секретам `TEST_*`.
- AppShell: мобильная шапка стала компактнее, вкладки модулей располагаются справа от сайдбара на десктопе, а левое меню получило независимый скролл и сворачиваемые секции с быстрым добавлением/удалением страниц.
- Виджет профиля на дашборде «Обзор» показывает бейдж с креативным названием роли и тултипом из persona-бандла вместо статичной подписи.
- Плашка про повышение тарифов на странице `/settings` стала компактной и ведёт на лендинг `/tariffs`; fallback-навигация AppShell больше не отображает пункт «Тарифы».
- Публичная страница `/docs` получила расширенный лендинг с исследованиями, sticky-навигацией и картой методологий по тарифам.
- Внутренние страницы Next.js больше не дублируют заголовок модуля внутри контента: `PageLayout` скрывает второй `<h1>`, а «Обзор» и профиль пользователя получили уникальные шапки.
- Лендинги `/tariffs`, `/docs` и `/bot` показывают ссылки на открытое сообщество, индивидуальную поддержку и прямой контакт с разработчиком.
- Лендниг `/tariffs` теперь делает ссылку на сообщество кликабельной и оставляет упоминания поддержки/разработчика без прямых контактов; в AppShell добавлены условные кнопки «Техподдержка» и «Связь с разработчиком» для соответствующих тарифов.
- Мини-таймер в AppShell и страница `/time` получили компактные кнопки управления (пауза, возобновление, завершение) и работают на новом контракте с накопленными секундами.
- FastAPI теперь раздаёт `_next/static` и `_next/data`, чтобы Next.js-ресурсы отдавались с корректным MIME-типом после деплоя.
- Навигация в AppShell показывает все разделы (включая `/calendar`, `/pricing`, `/products`, `/groups`), что упрощает доступ к старому и новому UI.
- Сервис учёта времени автоматически создаёт недостающие столбцы (`active_seconds`, `last_started_at`, `paused_at`) и индекс, если база ещё не обновлена DDL.
- Главная страница `/` теперь рендерит виджеты дашборда «Обзор» на Next.js с drag-n-drop, скрытием карточек и моментальным сохранением настроек пользователя.
- AGENTS.md и README.md (секция «Roadmap & Epics») дополнены правилами параллельной работы codex-cli: отдельные рабочие копии, обособленные ветки, обязательная бронь задач в таблице Agent Sync и самостоятельное разрешение конфликтов перед merge.
- Next.js frontend теперь обслуживает страницы `/areas`, `/projects`, `/resources` и `/tasks`: новые формы CRUD работают через React Query, дерево PARA редактируется через современный UI, каталог ресурсов получил поиск и современную форму, а legacy-шаблоны FastAPI удалены.
- Страница `/calendar` перенесена на Next.js: список событий и PARA-элементы управляются через React Query, а Jinja-шаблон `web/templates/calendar.html` удалён.
- Страница `/inbox` переработана под новый Next.js UI: карточка-фокус с прогрессом, агрегированные счётчики заметок/задач/событий/ресурсов и поток назначения заметок в Areas/Projects.
- Профильные страницы областей/проектов/ресурсов перенесены на Next.js: карточки отображают обложку, метаданные, теги и секции через `/api/v1/profiles/*` без Jinja-шаблонов.
- Каталог пользователей и профили `/users` теперь построены на Next.js (поиск, карточки, просмотр через профильный API); серверные шаблоны и роуты FastAPI удалены.
- Боковая навигация AppShell включает раздел «Команда» для быстрого перехода к каталогу пользователей.
- NAV_BLUEPRINT и статическое меню синхронизированы: возвращены пункты «Заметки», «Время» и «Настройки», поэтому левое меню вновь охватывает все страницы.
- Маршрут `/pricing` теперь возвращает 308-редирект на публичный лендинг `/tariffs`; страница тарифов рендерится без AppShell, пункт «Тарифы» убран из навигации, а в `/settings` добавлена плашка с апгрейдом.
- Next.js frontend получил AppShell-лейаут с дизайн-токенами, адаптивной навигацией и обновлённым опытом для страниц `/` и `/inbox` (поиск, skeleton, error-state).
- Избранное в меню профиля автоматически очищается от устаревших ссылок (`https://intdata.pro/admin`) и использует относительные пути, включая якорь `/settings#areas`.
- Сброс глобальной темы через `/settings` очищает значения `theme.global.*` и возвращает дефолтную палитру без ручного редактирования БД.
- Админский сектор теперь рендерится маршрутом `/cup/admin-embed` и подключается в ЦУП через iframe.
- Страницы `/products`, `/groups`, `/ban` и `/cup/admin-embed` обслуживаются через Next.js: FastAPI использует `render_next_page`, каталог продуктов доступен без авторизации, а разделы «Продукты» и «Группы» видимы в AppShell по умолчанию.
- Административные настройки объединены на `/settings`: бренд, Telegram-интеграции и глобальная тема доступны только администраторам.
- Команда `/group` теперь выполняет инвентаризацию Telegram-группы и сразу выводит отчёт `/group audit`; бот индексирует участников при добавлении в чат (E5b).
- Переработан модуль авторизации: битовые права, гибкие пресеты ролей, назначение прав по scope (global/area/project) и аудит операций доступа; обновлены веб-зависимости `role_required`/`permission_required` и настройки избранного.
- CRM по продуктам выделена в отдельный сервис, управление модерацией групп использует самостоятельный модуль и сводки.
- developer docs with observability and security guidelines.
- unified test fixtures and factories; OpenAPI snapshot test now enforces SSoT.
- Унифицирована работа с паролями через обёртку `core.db.bcrypt` и `WebUserService`.
- API обслуживается под `/api/v1` с заголовком `X-API-Version`; старые пути `/api/*` редиректятся (308) на новую схему, Swagger доступен по `/api`.
- `LogLevel` переведён на числовой `IntEnum` для корректных сравнений.
- Обновлены шаблоны и хэндлеры под текущее API FastAPI/Starlette; переход на lifespan‑события.
- API жёстко переведён на `/api/v1` без редиректов и хвостовых слэшей; старые `/api/*` возвращают `404`.
- Карточки задач, событий и заметок на дашборде стали кликабельными вместо кнопок перехода.
- Верхняя панель AppShell получила брендированный логотип, компактную ссылку на профиль и современный тултип роли без потери адаптивности.
- AppShell показывает описание страницы только в тултипе заголовка, а ЛК Админа больше не дублирует название в контенте.
- Каталог `/users` больше не дублирует заголовок внутри карточки: основной заголовок выводится только в шапке.
- Объединён бэклог из `docs/backlog/second_brain_backlog.md` в `BACKLOG.md`; добавлен эпик E13 Tasks & Time.
- Улучшен веб-интерфейс календаря: добавление событий и напоминаний внутри таблицы, отображение существующих напоминаний.
- Логика миграций и модуль базы данных перенесены в `core/db` для общего использования.
- Настройки дашборда перенесены на страницу `/settings`.
- Страница `/admin` приведена к единому стилю карточек и таблиц.
- Переименована дефолтная область «Нераспределённое» в системную «Входящие»; все сущности обязаны иметь область, при отсутствии используется «Входящие».
- Страница `/settings` стала адаптивной: убрано повтор заголовка и добавлена сетка блоков настроек.
- Страница `/notes` обновлена: заголовок выводится только в шапке, форма быстрой заметки центрирована и чип области позволяет менять область.
- Task creation requires `project_id` or `area_id`; area inherits from project.
- Страница `/notes` доработана: карточки фиксированного размера с цветом области, всплывающее окно для просмотра и новая форма быстрого ввода.
- Цвет заметок наследуется от области; поле `notes.color` устарело и не используется.
- В UI заметок удалён выбор цвета, карточки и чипы окрашиваются через CSS-переменные и авто-контраст.
- /calendar/agenda теперь поддерживает `include_habits=1` (виртуальные ежедневки).
- ICS feed экспортирует VTODO с RRULE для ежедневок (только чтение).
- `/api/v1/habits/stats` now includes `{daily_xp, daily_gold}`.
- API авторизации унифицировано через `get_current_owner`; OpenAPI описывает новые ошибки.
- Unified OpenAPI SSoT at `/api/openapi.json`; exporter produces `api/openapi.json`.
- OpenAPI snapshot documents `tg_link_required` and `cooldown` errors.
- Tailwind config ограничен директориями Next.js (app/components/lib), подчистили legacy-шаблоны из сканирования и обновили дизайн-токены (success/warning/danger, border-strong).
- Страницы `/tasks`, `/projects`, `/resources`, `/users` переведены на новый UI kit: унифицированные формы, карточки, тулбары и улучшенная доступность; React Query тесты обновлены под новый интерфейс.
- Загрузка переменных окружения теперь производится из файла, указанного в `ENV_FILE` (по умолчанию `${PROJECT_DIR}/.env`).
- Логируется путь загруженного `.env` и выводится предупреждение, если файл находится вне корня проекта.
- Главный экран переименован в «ЦУП» с подсказкой «Центр Управления Полётами», поправлены пункты меню и тултипы.

### Fixed
- Исправлен `DetachedInstanceError` при вызове `POST /api/v1/notes/{id}/assign`: ответ снова включает связанные `area` и `project` без повторных запросов (эпик [E3](#e3-api-calendar-calendaritems-calendaragenda-calendarfeedics-projectsidnotifications)).
- Восстановлен публичный лендинг `/bot` на Next.js: страница снова доступна без авторизации и содержит CTA на @intDataBot.
- FastAPI-обёртка для Next.js считает `index.html` валидным алиасом корневой страницы, поэтому `/admin` и «Обзор» перестали требовать повторный `npm run build` после миграции на Next.js 15.
- `/users/{slug}` снова открываются даже для профилей без записей: страница автоматически инициирует приватный профиль владельца и уважает гранты доступа.
- Каталог `/users` и страницы профилей уважают приватность: выдаются только публичные профили или записи с явными грантами.
- Страница `/users` больше не падает из-за CSP: inline-скрипты Next.js автоматически разрешены через SHA256-хеши в `script-src`.
- Backend автоматически запускает `npm ci` (если нет `node_modules`) и `npm run build`, поэтому `/users` и `/_next/static` восстанавливаются даже на "чистых" развёртываниях.
- Подключён API `/api/v1/profiles/*` в FastAPI, поэтому каталог и профили пользователей снова загружаются без ошибок 404.
- Content Security Policy по умолчанию разрешает загрузку Telegram Login (скрипт `telegram.org` и iframe `oauth.telegram.org`), поэтому кнопка входа снова видна на `/auth`.
- Кнопка входа через Telegram снова отображается над формой входа на странице авторизации.
- Страница авторизации скрывает виджет Telegram при `TG_LOGIN_ENABLED=0`, предотвращая ошибки.
- Эндпоинты входа через Telegram возвращают 503 при `TG_LOGIN_ENABLED=0`.
- reduced test flakiness via deterministic time handling and confirmed cooldown paths mapping to 429.
- Страница `/inbox` запрашивает заметки у API через `NEXT_PUBLIC_API_BASE`.
- FastAPI UI-маршрут `/inbox` снова зарегистрирован, поэтому страница открывается без ошибки 404 и отдаётся из Next.js.
- FastAPI UI-маршрут `/areas` снова зарегистрирован, поэтому страница открывается без ошибки 404 и отдаётся из Next.js.
- FastAPI UI-маршрут `/projects` снова зарегистрирован, поэтому страница открывается без ошибки 404 и отдаётся из Next.js.
- Восстановлены вспомогательные модули `web/lib/settings` и `web/lib/theme`, поэтому `npm run build` успешно собирает Next.js.
- FastAPI UI-маршруты `/resources` и `/tasks` снова зарегистрированы, поэтому страницы открываются без ошибки 404 и отдаются из Next.js.
- Страница `/time` перенесена на Next.js: добавлены активный таймер, аналитика по дням и областям, карточки командной синхронизации и блок интеграций.
- Пункт «Настройки» вернулся в левое меню и дружит с персональными пресетами, мини-виджет таймера закреплён под навигацией и стартует от 00:00 (UTC-нормализация вместо +3 ч).
- Фронтенд использует `/api/v1` по умолчанию при отсутствии `window.API_BASE`.

- Автоматическое создание таблицы `app_settings`, исключающей ошибки при её отсутствии.
- Создание таблицы `user_settings` в repair-скрипте, что предотвращает падения при чтении настроек.
- Страница `/habits` корректно использует активную веб-сессию и больше не требует повторной авторизации Telegram.
- `/habits` корректно использует активную веб-сессию: страница доступна без TG, write-действия требуют привязку (403 `tg_link_required`).
- Habit endpoints маппят `cooldown` в 429 (с `Retry-After`), исключая 500.
- Приведена к асинхронной `init_app_once`, что устраняет ошибку MissingGreenlet при подключении через `asyncpg`.
- Исправлено отключение виджетов дашборда через пользовательские настройки.
- Скрытие виджетов на дашборде теперь учитывает состояние чекбоксов в настройках.
- Список избранного по умолчанию включает все доступные страницы, если пользователь ещё не сохранял настройки.
- Дашборд показывает только виджеты, выбранные пользователем; при отсутствии настроек отображаются все.
- Добавлены meta viewport и основной регион `<main>` для базовой мобильной адаптивности и доступности.
- Исправлено создание системной области «Входящие» при быстром добавлении заметки.
- Добавлена миграция столбцов `area_id` и `project_id` для таблицы `habits`.
- Кнопки заметок (редактирование, закрепление, удаление) стали кликабельными и работают по назначению.
- PARA inheritance for newly created habits/dailies/rewards enforced in services and repair.
- Habit ORM exposes `.area` and `.project`; `/habits` no longer responds 500 when listing habits.
- Repair backfills `area_id` from project and warns when both `area_id` and `project_id` are NULL.
- Habit creation via `/api/v1/habits` no longer fails when area is missing; defaults to Inbox and accepts `name` payload.
- Создание заметки больше не падает при отсутствии цвета у области.
- Бот снова пересылает все входящие сообщения в логирующую группу и позволяет администраторам отвечать на них.

### Security
- baseline HTTP headers and optional rate limiting.
- Access control on owner_id for habits/dailies/rewards and logs.
- Нулевые права на write-действия без TG-привязки; одинаковое owner-scoping для всех эндпоинтов.
- Unified owner scoping via `get_current_owner`.

### Removed
- Удалены финальные Jinja-шаблоны (`web/templates/*`) и легаси-статические ассеты (`web/static/js`, `web/static/css`, `web/static/ts`, `web/static/ui`).
- Legacy-шаблон главной страницы `web/templates/start.html` и привязанные статические элементы после переноса дашборда на Next.js.
- Legacy-шаблон `web/templates/habits.html` и скрипт `web/static/js/habits_v1.js` после миграции на Next.js.
- Legacy-шаблон авторизации `web/templates/auth.html` и скрипт `web/static/js/auth_extra.js` удалены после переноса /auth на Next.js.
- Страница заметок переведена на Next.js; удалены `web/templates/notes.html`, `web/static/js/notes.js`, `web/static/css/notes.css`.
- Удалён устаревший каталог `NexusCore/`; весь функционал перенесён в `intdata/`.
- Удалён HTML-маршрут `/admin`; админские инструменты доступны только из ЦУПа.
- Удалён устаревший API напоминаний и связанные сервисы.
- Исправлены сравнения уровней логирования после перехода на `IntEnum`.
- Исправлена авторизация через Telegram (создание `TgUser`, проверка `WebUser`, куки) и тесты.
- В тестах исправлены параметры редиректов (`follow_redirects`).
- Исправлена ошибка отсутствующего столбца `projects.status` в базе данных.
- Удалена страница `/settings/dashboard`.
- Переведены валидаторы конфигурации на синтаксис `field_validator` Pydantic v2, устранены предупреждения устаревания.
- Swagger UI снова доступен на `/api`, статические файлы не редиректятся на `/api/v1`.
- `GET /auth/logout` корректно завершает сессию; браузеры получают favicon по `/favicon.ico`.
- Убраны редиректы при обращении к `POST /api/v1/user/favorites`.
- Исправлено добавление и удаление избранного в веб-интерфейсе.
- Починена вёрстка меню избранного и отображение звёздочки на страницах.
- Удалён скриншот страницы `/settings` из документации.
- Duplicate OpenAPI/Swagger files.

### Removed
 - Упоминания роли из пользовательского интерфейса.
 - Убраны фиксированные ссылки (Дашборд, Задачи и др.) из меню профиля; оставлены только «Профиль», «Настройки», избранное и «Выход».
 - Alembic-миграции заменены на простой SQL-раннер `core/db/migrate.py`.
- Удалены legacy‑маршруты и UI модуля напоминаний; функционал перенесён в календарь.
- Удалены устаревшие директория `migrations/` и конфигурация `alembic.ini`.
- Jinja-шаблон и маршрут FastAPI для `/inbox`.

### Changed
- Усилены инварианты PARA на уровне БД: `projects.area_id` теперь `NOT NULL`; добавлены индексы на `project_id/area_id` для основных таблиц.
- Унифицированы публичные страницы `/auth`, `/tariffs`, `/bot`, `/docs`: общий PublicLayout с единым хедером/футером, CTA «Начать бесплатно» и согласованные ссылки.

### Fixed
- Исправлена TZ-логика на дашборде: устранены сравнения «naive vs aware», все вычисления нормализованы в UTC.


## [0.1.0] - YYYY-MM-DD
### Added
- Инициализация проекта.


## Reports & Archives
- Исследования, постмортемы и отчёты размещаются в `docs/reports/*`; на ключевые материалы даём ссылки из соответствующих разделов (Vision, Roadmap, Changelog).
- Исторические документы и артефакты (например, Legacy NexusCore Balance) живут в `docs/archive/*`.
- Гайды по инструментам (включая `codex-cli`) лежат в `docs/guides/*`; поддерживайте их в актуальном состоянии при изменении процессов.
