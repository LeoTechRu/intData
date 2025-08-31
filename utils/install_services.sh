#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# 0) .env должен существовать и быть непустым
[ -s ".env" ] || { echo "ERROR: .env missing at $PROJECT_ROOT/.env"; exit 1; }

# 1) Подтягиваем только нужные переменные из .env (без экспорта «всего»)
#    ожидаем, что в .env определены PROJECT_DIR и PROJECT_VENV
PROJECT_DIR=$(grep -E '^PROJECT_DIR=' .env | cut -d= -f2- | tr -d '"' | tr -d '\r')
PROJECT_VENV=$(grep -E '^PROJECT_VENV=' .env | cut -d= -f2- | tr -d '"' | tr -d '\r')
# expand nested refs like ${PROJECT_DIR}/venv
PROJECT_DIR=$(eval echo "$PROJECT_DIR")
PROJECT_VENV=$(eval echo "$PROJECT_VENV")
[ -n "$PROJECT_DIR" ] && [ -n "$PROJECT_VENV" ] || { echo "ERROR: PROJECT_DIR/PROJECT_VENV not set in .env"; exit 1; }

# 2) Подготовка venv и зависимости
mkdir -p "$PROJECT_DIR"
python3 -m venv "$PROJECT_VENV" >/dev/null 2>&1 || true
"$PROJECT_VENV/bin/pip" install --upgrade pip
"$PROJECT_VENV/bin/pip" install -r requirements.txt

# 3) Установка unit-файлов (только если изменились)
#install -m 0644 -D "$PROJECT_ROOT/utils/systemd/intdata-bot.service" /etc/systemd/system/intdata-bot.service
#install -m 0644 -D "$PROJECT_ROOT/utils/systemd/intdata-web.service" /etc/systemd/system/intdata-web.service

# 4) Проверка синтаксиса и перезагрузка конфигурации systemd
systemd-analyze verify /etc/systemd/system/intdata-*.service
systemctl daemon-reload

# 5) Включаем, но НЕ рестартим здесь (перезапуск сделает GitHub job один раз)
systemctl enable intdata-bot.service intdata-web.service

echo "install_services: ok"
