#!/bin/bash
set -e

# Копируем unit-файлы в systemd
sudo cp deploy/systemd/leonidbot-bot.service /etc/systemd/system/
sudo cp deploy/systemd/leonidbot-web.service /etc/systemd/system/

# Перезапускаем systemd
sudo systemctl daemon-reload

# Включаем автозапуск
sudo systemctl enable leonidbot-bot.service
sudo systemctl enable leonidbot-web.service

# Перезапускаем службы
sudo systemctl restart leonidbot-bot.service
sudo systemctl restart leonidbot-web.service

echo "Установлено."
