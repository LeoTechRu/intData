#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

# 0) .env должен существовать и быть непустым
[ -s ".env" ] || { echo "ERROR: .env missing at $PROJECT_ROOT/.env"; exit 1; }

# 1) Подтягиваем только нужные переменные из .env (без экспорта «всего»)
#    ожидаем, что в .env определены LEONIDPRO_WORKDIR и LEONIDPRO_VENV
LEONIDPRO_WORKDIR=$(grep -E '^LEONIDPRO_WORKDIR=' .env | cut -d= -f2- | tr -d '"' | tr -d '\r')
LEONIDPRO_VENV=$(grep -E '^LEONIDPRO_VENV=' .env | cut -d= -f2- | tr -d '"' | tr -d '\r')
# expand nested refs like ${LEONIDPRO_WORKDIR}/venv
LEONIDPRO_WORKDIR=$(eval echo "$LEONIDPRO_WORKDIR")
LEONIDPRO_VENV=$(eval echo "$LEONIDPRO_VENV")
[ -n "$LEONIDPRO_WORKDIR" ] && [ -n "$LEONIDPRO_VENV" ] || { echo "ERROR: LEONIDPRO_WORKDIR/LEONIDPRO_VENV not set in .env"; exit 1; }

# 2) Подготовка venv и зависимости
mkdir -p "$LEONIDPRO_WORKDIR"
python3 -m venv "$LEONIDPRO_VENV" >/dev/null 2>&1 || true
"$LEONIDPRO_VENV/bin/pip" install --upgrade pip
"$LEONIDPRO_VENV/bin/pip" install -r requirements.txt

# 3) Установка unit-файлов (только если изменились)
install -m 0644 -D "$PROJECT_ROOT/deploy/systemd/leonidpro-bot.service" /etc/systemd/system/leonidpro-bot.service
install -m 0644 -D "$PROJECT_ROOT/deploy/systemd/leonidpro-web.service" /etc/systemd/system/leonidpro-web.service

# 4) Проверка синтаксиса и перезагрузка конфигурации systemd
systemd-analyze verify /etc/systemd/system/leonidpro-*.service
systemctl daemon-reload

# 5) Включаем, но НЕ рестартим здесь (перезапуск сделает GitHub job один раз)
systemctl enable leonidpro-bot.service leonidpro-web.service

echo "install_services: ok"
