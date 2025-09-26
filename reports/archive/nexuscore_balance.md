# NexusCore Balance → Intelligent Data Pro

Эта заметка фиксирует, какие модули из устаревшего репозитория **NexusCore Balance**
вошли в ядро Intelligent Data Pro и где искать их аналоги.

## Перенесённые компоненты
- **Модели данных**: все сущности (Areas, Projects, Tasks, Habits, Resources,
  OKR, Links, Limits, Roles и др.) перенесены и живут в `backend/models.py`. Поля
  вроде `cognitive_cost`, `neural_priority`, `repeat_config`, `custom_properties`
  и контрольные точки задач сохранены.
- **Сервисы**: логика доступа, PARA и расширенные CRUD операции перенесены в
  `backend/services/` (`access_control.py`, `para_service.py`, `nexus_service.py`,
  `habit_service.py` и др.).
- **Аудит безопасности**: логи прав доступа ведутся через
  `backend/services/audit_log.py` и доступны по API `/api/v1/admin/audit/logs`.
- **Сырой доступ к БД**: совместимый с NexusCore хелпер теперь находится в
  `backend/db/legacy.py` (класс `DBConfig`, `validate_config`, `get_raw_connection`).
- **Философия и методы**: когнитивные принципы, PARA-подход и ограничения задач
  отражены в `README.md` и бэклоге (`reports/archive/BACKLOG.md`, эпики E12/E13/E16/E17).

## Что удалено и почему
- Flask-приложение, Blueprints и Alembic-миграции заменены на FastAPI +
  асинхронную архитектуру с простыми SQL миграциями (`backend/db/migrate.py`).
- Сценарий `utils/Recovery.py` сохранил идею восстановления схемы, но теперь
  функциональность покрывает `backend/db/schema_export.py` и `backend/db/repair.py`.

## Как запускать привычные операции
- Проверка конфигурации БД: `python -c "from core.db import validate_config; print(validate_config())"`.
- Получение сырых соединений: `from core.db import get_raw_connection`.
- Инициализация ролей и прав: `python -m core.services.access_control` (см. `seed_presets`).
- Просмотр аудита: `curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/admin/audit/logs`.

## Дополнительные материалы
- Основной README проекта: `README.md`.
- История изменений: `reports/archive/CHANGELOG.md`.
- Архив оригинальной информации NexusCore (когнитивные принципы) — см. раздел
  "🧠 Философия системы" в `README.md`.

> Исторический репозиторий `Nexusbackend/` удалён из рабочего дерева. Последующие
> доработки выполняйте в `intdata/`.
