ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS area_id INTEGER NOT NULL,
  ADD COLUMN IF NOT EXISTS project_id INTEGER;

ALTER TABLE notes
  ADD CONSTRAINT IF NOT EXISTS fk_notes_area FOREIGN KEY (area_id) REFERENCES areas(id),
  ADD CONSTRAINT IF NOT EXISTS fk_notes_project FOREIGN KEY (project_id) REFERENCES projects(id);

CREATE INDEX IF NOT EXISTS idx_notes_owner_area ON notes(owner_id, area_id);
CREATE INDEX IF NOT EXISTS idx_notes_owner_project ON notes(owner_id, project_id);
