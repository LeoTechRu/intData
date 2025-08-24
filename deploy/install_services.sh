#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

set -a
. "$PROJECT_ROOT/.env"
set +a

sudo cp "$PROJECT_ROOT/deploy/systemd/leonidbot-bot.service" /etc/systemd/system/
sudo cp "$PROJECT_ROOT/deploy/systemd/leonidbot-web.service" /etc/systemd/system/

sudo systemctl daemon-reload
sudo systemctl enable leonidbot-bot.service leonidbot-web.service
sudo systemctl restart leonidbot-bot.service leonidbot-web.service
