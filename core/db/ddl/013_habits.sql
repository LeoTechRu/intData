CREATE TABLE IF NOT EXISTS habits (
    id SERIAL PRIMARY KEY,
    owner_id BIGINT REFERENCES users_tg(telegram_id),
    area_id INTEGER NOT NULL REFERENCES areas(id),
    project_id INTEGER REFERENCES projects(id),
    name VARCHAR(255) NOT NULL,
    description VARCHAR(500),
    schedule JSON,
    metrics JSON,
    frequency VARCHAR(20),
    progress JSON,
    start_date TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

ALTER TABLE habits
  ADD COLUMN IF NOT EXISTS area_id INTEGER NOT NULL,
  ADD COLUMN IF NOT EXISTS project_id INTEGER;

ALTER TABLE habits
  ADD CONSTRAINT IF NOT EXISTS fk_habits_area FOREIGN KEY (area_id) REFERENCES areas(id),
  ADD CONSTRAINT IF NOT EXISTS fk_habits_project FOREIGN KEY (project_id) REFERENCES projects(id);

CREATE INDEX IF NOT EXISTS idx_habits_owner_area ON habits(owner_id, area_id);
CREATE INDEX IF NOT EXISTS idx_habits_owner_project ON habits(owner_id, project_id);
