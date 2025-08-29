-- Calendar and notification tables

-- areas
CREATE TABLE IF NOT EXISTS areas (
    id UUID PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE areas
    ADD COLUMN IF NOT EXISTS title TEXT,
    ALTER COLUMN title SET NOT NULL,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- projects
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY,
    area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS area_id UUID,
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
    ALTER COLUMN area_id SET NOT NULL,
    ALTER COLUMN title SET NOT NULL;

-- calendar_items
CREATE TABLE IF NOT EXISTS calendar_items (
    id UUID PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('event','task')),
    project_id UUID NULL REFERENCES projects(id) ON DELETE CASCADE,
    area_id UUID NULL REFERENCES areas(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    notes TEXT,
    tzid TEXT NOT NULL DEFAULT 'UTC',
    start_at TIMESTAMPTZ NULL,
    end_at TIMESTAMPTZ NULL,
    due_at TIMESTAMPTZ NULL,
    rrule TEXT NULL,
    priority INT NULL,
    status TEXT NULL,
    meta JSONB DEFAULT '{}'::jsonb,
    created_by UUID NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    CHECK ((project_id IS NOT NULL) OR (area_id IS NOT NULL))
);

ALTER TABLE calendar_items
    ADD COLUMN IF NOT EXISTS kind TEXT,
    ADD COLUMN IF NOT EXISTS project_id UUID,
    ADD COLUMN IF NOT EXISTS area_id UUID,
    ADD COLUMN IF NOT EXISTS title TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT,
    ADD COLUMN IF NOT EXISTS tzid TEXT DEFAULT 'UTC',
    ADD COLUMN IF NOT EXISTS start_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS end_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS due_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS rrule TEXT,
    ADD COLUMN IF NOT EXISTS priority INT,
    ADD COLUMN IF NOT EXISTS status TEXT,
    ADD COLUMN IF NOT EXISTS meta JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS created_by UUID,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
    ALTER COLUMN kind SET NOT NULL;

-- alarms
CREATE TABLE IF NOT EXISTS alarms (
    id UUID PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES calendar_items(id) ON DELETE CASCADE,
    trigger_at TIMESTAMPTZ NULL,
    offset_sec INT NULL,
    action TEXT NOT NULL CHECK (action IN ('inapp','email','tg','webpush','webhook')),
    channel_id UUID NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    enabled BOOL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE alarms
    ADD COLUMN IF NOT EXISTS item_id UUID,
    ADD COLUMN IF NOT EXISTS trigger_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS offset_sec INT,
    ADD COLUMN IF NOT EXISTS action TEXT,
    ADD COLUMN IF NOT EXISTS channel_id UUID,
    ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS enabled BOOL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
    ALTER COLUMN item_id SET NOT NULL,
    ALTER COLUMN action SET NOT NULL;

-- channels
CREATE TABLE IF NOT EXISTS channels (
    id UUID PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('telegram','email','webpush','webhook')),
    address JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE channels
    ADD COLUMN IF NOT EXISTS type TEXT,
    ADD COLUMN IF NOT EXISTS address JSONB,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
    ALTER COLUMN type SET NOT NULL,
    ALTER COLUMN address SET NOT NULL;

-- project_notifications
CREATE TABLE IF NOT EXISTS project_notifications (
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    rules JSONB NOT NULL,
    PRIMARY KEY (project_id, channel_id)
);

ALTER TABLE project_notifications
    ADD COLUMN IF NOT EXISTS project_id UUID,
    ADD COLUMN IF NOT EXISTS channel_id UUID,
    ADD COLUMN IF NOT EXISTS rules JSONB,
    ALTER COLUMN project_id SET NOT NULL,
    ALTER COLUMN channel_id SET NOT NULL,
    ALTER COLUMN rules SET NOT NULL;

-- gcal_links
CREATE TABLE IF NOT EXISTS gcal_links (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    google_calendar_id TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    scope TEXT NOT NULL,
    token_expiry TIMESTAMPTZ NOT NULL,
    sync_token TEXT NULL,
    resource_id TEXT NULL,
    channel_id TEXT NULL,
    channel_expiry TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE gcal_links
    ADD COLUMN IF NOT EXISTS user_id UUID,
    ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
    ADD COLUMN IF NOT EXISTS access_token TEXT,
    ADD COLUMN IF NOT EXISTS refresh_token TEXT,
    ADD COLUMN IF NOT EXISTS scope TEXT,
    ADD COLUMN IF NOT EXISTS token_expiry TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS sync_token TEXT,
    ADD COLUMN IF NOT EXISTS resource_id TEXT,
    ADD COLUMN IF NOT EXISTS channel_id TEXT,
    ADD COLUMN IF NOT EXISTS channel_expiry TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now(),
    ALTER COLUMN user_id SET NOT NULL,
    ALTER COLUMN google_calendar_id SET NOT NULL,
    ALTER COLUMN access_token SET NOT NULL,
    ALTER COLUMN refresh_token SET NOT NULL,
    ALTER COLUMN scope SET NOT NULL,
    ALTER COLUMN token_expiry SET NOT NULL;

-- indexes
CREATE INDEX IF NOT EXISTS idx_calendar_items_project_id ON calendar_items(project_id);
CREATE INDEX IF NOT EXISTS idx_calendar_items_area_id ON calendar_items(area_id);
CREATE INDEX IF NOT EXISTS idx_calendar_items_due_at ON calendar_items(due_at);
CREATE INDEX IF NOT EXISTS idx_calendar_items_start_at ON calendar_items(start_at);
CREATE INDEX IF NOT EXISTS idx_calendar_items_updated_at ON calendar_items(updated_at);

CREATE INDEX IF NOT EXISTS idx_alarms_item_id ON alarms(item_id);
CREATE INDEX IF NOT EXISTS idx_alarms_trigger_at ON alarms(trigger_at);
CREATE INDEX IF NOT EXISTS idx_project_notifications_project_id ON project_notifications(project_id);

CREATE INDEX IF NOT EXISTS idx_gcal_links_user_id ON gcal_links(user_id);
