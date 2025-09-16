-- areas (контейнер PARA)
CREATE TABLE IF NOT EXISTS areas(
  id          UUID PRIMARY KEY,
  owner_id    UUID NOT NULL,
  title       TEXT NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ix_areas_owner ON areas(owner_id);

-- projects (принадлежат Area)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS area_id INTEGER;
CREATE INDEX IF NOT EXISTS ix_projects_area_id ON projects(area_id);

-- calendar_items (универсальный календарный элемент, в т.ч. задачи)
ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS kind TEXT;              -- 'event'|'task'|...
ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS project_id INTEGER;
ALTER TABLE calendar_items ADD COLUMN IF NOT EXISTS area_id INTEGER;
CREATE INDEX IF NOT EXISTS ix_calendar_items_project ON calendar_items(project_id);
CREATE INDEX IF NOT EXISTS ix_calendar_items_area    ON calendar_items(area_id);

-- tasks (тонкая надстройка над calendar_items.id)
CREATE TABLE IF NOT EXISTS tasks(
  id          UUID PRIMARY KEY,   -- = calendar_items.id
  status      TEXT NOT NULL DEFAULT 'open',  -- open|in_progress|done|blocked|archived
  priority    INT,
  tags        TEXT[],
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- resources (знания/люди/файлы и т.п.), могут быть на проекте или в области
ALTER TABLE resources ADD COLUMN IF NOT EXISTS project_id     INTEGER;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS area_id        INTEGER;
ALTER TABLE resources ADD COLUMN IF NOT EXISTS type           TEXT;  -- 'note'|'file'|'link'|'human'...
ALTER TABLE resources ADD COLUMN IF NOT EXISTS human_user_id  INTEGER;  -- ссылка на users_web, если type='human'
CREATE INDEX IF NOT EXISTS ix_resources_project ON resources(project_id);
CREATE INDEX IF NOT EXISTS ix_resources_area    ON resources(area_id);
CREATE INDEX IF NOT EXISTS ix_resources_human   ON resources(human_user_id);

-- time_entries (тайм-лог)
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS task_id     INTEGER;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS project_id  INTEGER;
ALTER TABLE time_entries ADD COLUMN IF NOT EXISTS area_id     INTEGER;
-- один активный таймер на пользователя (entry без end_time считается активным)
CREATE UNIQUE INDEX IF NOT EXISTS ux_time_active_one_per_user
  ON time_entries(owner_id) WHERE end_time IS NULL;

-- para_overrides (субъективные привязки для viewer’а)
CREATE TABLE IF NOT EXISTS para_overrides(
  id                 UUID PRIMARY KEY,
  owner_user_id      UUID NOT NULL,          -- кто «смотрит»
  entity_type        TEXT NOT NULL,          -- 'project'|'task'|'resource'
  entity_id          UUID NOT NULL,
  override_project_id UUID,
  override_area_id    UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_overrides_owner_entity
  ON para_overrides(owner_user_id, entity_type, entity_id);
