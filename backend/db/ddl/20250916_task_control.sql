-- Task manager supervision & reminders
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'taskcontrolstatus') THEN
        CREATE TYPE taskcontrolstatus AS ENUM ('active','done','dropped');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'taskrefusereason') THEN
        CREATE TYPE taskrefusereason AS ENUM ('done','wont_do');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'taskwatcherstate') THEN
        CREATE TYPE taskwatcherstate AS ENUM ('active','left');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'taskwatcherleftreason') THEN
        CREATE TYPE taskwatcherleftreason AS ENUM ('done','wont_do','manual');
    END IF;
END $$;

ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS control_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS control_frequency INTEGER,
    ADD COLUMN IF NOT EXISTS control_status taskcontrolstatus NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS control_next_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS refused_reason taskrefusereason,
    ADD COLUMN IF NOT EXISTS remind_policy JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS is_watched BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS task_reminders (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    owner_id BIGINT NOT NULL REFERENCES users_tg(telegram_id),
    kind TEXT NOT NULL DEFAULT 'custom',
    trigger_at TIMESTAMPTZ NOT NULL,
    frequency_minutes INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_triggered_at TIMESTAMPTZ,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_task_reminders_active ON task_reminders(task_id, trigger_at);

CREATE TABLE IF NOT EXISTS task_watchers (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    watcher_id BIGINT NOT NULL REFERENCES users_tg(telegram_id),
    added_by BIGINT REFERENCES users_tg(telegram_id),
    state taskwatcherstate NOT NULL DEFAULT 'active',
    left_reason taskwatcherleftreason,
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_task_watchers_active
    ON task_watchers(task_id, watcher_id)
    WHERE state = 'active';
