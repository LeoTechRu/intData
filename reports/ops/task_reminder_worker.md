# Task Reminder Worker (Telegram)

Фоновый воркер `TaskReminderWorker` отвечает за доставку напоминаний по задачам
(`task_reminders`) и уведомления наблюдателей. Он использует `TG_BOT_TOKEN`,
подключается к базе через `core.env` и каждые N секунд опрашивает таблицу
напоминаний.

## Что делает воркер
- отправляет владельцу и активным наблюдателям напоминания о задачах,
- переносит `trigger_at` вперёд с учётом `frequency_minutes`,
- выключает неактуальные напоминания и чистит висящие записи.

## Как запустить на сервере (systemd)
1. Убедитесь, что на сервере установлен Python и создан виртуальный
   environment проекта (`/srv/intdata/venv`, например).
2. Проверьте `.env` — там должны быть `TG_BOT_TOKEN`, `DB_*` и остальные
   переменные для подключения к БД.
3. Добавьте unit-файл `/etc/systemd/system/intdata-task-reminder.service`:
   ```ini
   [Unit]
   Description=IntData Task Reminder Worker
   After=network.target

   [Service]
   Type=simple
   WorkingDirectory=/srv/intdata
   Environment="PYTHONPATH=/srv/intdata"
   EnvironmentFile=/srv/intdata/.env
   ExecStart=/srv/intdata/venv/bin/python utils/run_task_reminder_worker.py
   Restart=always
   RestartSec=5

   [Install]
   WantedBy=multi-user.target
   ```
   При необходимости отредактируйте пути. Переменная окружения
   `TASK_REMINDER_INTERVAL` (в секундах) задаёт интервал опроса, по умолчанию
   60 секунд — можно дописать её в блок `[Service]`.
4. Активируйте сервис: `sudo systemctl daemon-reload && sudo systemctl enable --now intdata-task-reminder.service`.
5. Проверьте логи: `journalctl -u intdata-task-reminder.service -f`.

## Альтернатива: cron (нежелательно, но возможно)
Если systemd недоступен, можно добавить cron-задание, запускающее воркер в
режиме одиночного цикла:
```cron
* * * * * cd /srv/intdata && source venv/bin/activate && ENABLE_SCHEDULER=0 TASK_REMINDER_INTERVAL=60 python utils/run_task_reminder_worker.py >> /var/log/intdata-task-reminder.log 2>&1
```
Cron будет каждые 60 секунд стартовать воркер. Такой вариант менее надёжен,
поэтому рекомендуем использовать systemd.

## Мониторинг
- Анализируйте `task_reminders` на предмет просроченных `trigger_at`. При
  устойчивом росте пересмотрите интервал.
- `TaskNotificationService` использует Telegram API; убедитесь, что у бота
  достаточно прав, и настроены уведомления об ошибках (см. `LoggerMiddleware`).
