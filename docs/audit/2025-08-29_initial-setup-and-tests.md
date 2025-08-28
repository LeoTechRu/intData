# Аудит: подготовка окружения и прогон тестов (2025-08-29)

- Дата/время: 2025-08-29 (UTC)
- Каталог проекта: `/sd/leonidpro`
- Python: 3.13.3 (venv: `/sd/leonidpro/venv`)
- Пакеты: установлены по `requirements.txt` (pip 25.x)
- БД: порт `127.0.0.1:5432` доступен (PostgreSQL слушает)

## Выполненные шаги
- Активирован виртуальныйenv: `source ./venv/bin/activate`.
- Обновлены инструменты сборки: `pip install --upgrade pip wheel setuptools`.
- Установлены зависимости: `pip install -r requirements.txt`.
- Прогнан тестовый набор: `pytest -q`.

## Результаты `pytest -q`
- Пройдено: 48
- Падения (failures): 2
- Ошибки (errors): 9
- Предупреждения: 5 (в т.ч. депрекации валидаторов Pydantic V1)

### Ключевые проблемы
1) tests/web/test_auth.py — множ. случаев `AttributeError: property 'BOT_TOKEN' of 'Settings' object has no setter` при попытках тестов установить `S.BOT_TOKEN`.
2) web/routes/index.py — `TypeError: can't compare offset-naive and offset-aware datetimes` при агрегации дашборда (сравнение с `week_ago`).
3) tests/test_profile.py::test_profile_view_and_edit — `assert 2 == 1` (нужно уточнить бизнес-логику/фикстуры).
4) tests/web/test_dashboard_data.py::test_dashboard_displays_real_data — 1 падение (детали требуют уточнения при целевом прогоне).

### Наблюдения и гипотезы по исправлениям
- Конфиг `Settings`: тесты ожидают возможность переопределения `BOT_TOKEN` (через сеттер или тестовый конструктор). Варианты:
  - сделать поле обычным полем `BaseSettings` (settable) и обеспечить сброс;
  - предоставить фабрику/фикстуру для временной подмены конфигурации;
  - переключить тесты на установку значения через env (`monkeypatch.setenv`).
- Даты/часы: привести вычисления к TZ-aware (`datetime.now(timezone.utc)` и хранить `start_time/end_time` в UTC), либо локально нормализовать перед сравнением.
- Профиль/дашборд: перепроверить фикстуры и ожидаемые количества; возможно, дублируются записи или неверно очищается состояние между кейсами.

## Команды для воспроизведения
```
source ./venv/bin/activate && pip install --quiet -r requirements.txt && pytest -q
```

## Следующие шаги (предложение)
- Исправить конфиг для тестовой подмены `BOT_TOKEN` и добавить регрессионный тест на это поведение.
- Унифицировать TZ-логику в `web/routes/index.py` и/или моделях.
- Точечно прогнать упавшие тесты для детальной трассировки и фикса.

