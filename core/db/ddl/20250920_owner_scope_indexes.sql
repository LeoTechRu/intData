-- Owner scoped composite indexes for PARA filtering

CREATE INDEX IF NOT EXISTS idx_calendar_items_owner_project
    ON calendar_items(owner_id, project_id);
CREATE INDEX IF NOT EXISTS idx_calendar_items_owner_area
    ON calendar_items(owner_id, area_id);

CREATE INDEX IF NOT EXISTS idx_tasks_owner_project
    ON tasks(owner_id, project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_area
    ON tasks(owner_id, area_id);

CREATE INDEX IF NOT EXISTS idx_time_entries_owner_project
    ON time_entries(owner_id, project_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_owner_area
    ON time_entries(owner_id, area_id);

CREATE INDEX IF NOT EXISTS idx_notes_owner_project
    ON notes(owner_id, project_id);
CREATE INDEX IF NOT EXISTS idx_notes_owner_area
    ON notes(owner_id, area_id);

CREATE INDEX IF NOT EXISTS idx_habits_owner_project
    ON habits(owner_id, project_id);
CREATE INDEX IF NOT EXISTS idx_habits_owner_area
    ON habits(owner_id, area_id);

CREATE INDEX IF NOT EXISTS idx_dailies_owner_project
    ON dailies(owner_id, project_id);
CREATE INDEX IF NOT EXISTS idx_dailies_owner_area
    ON dailies(owner_id, area_id);

CREATE INDEX IF NOT EXISTS idx_rewards_owner_project
    ON rewards(owner_id, project_id);
CREATE INDEX IF NOT EXISTS idx_rewards_owner_area
    ON rewards(owner_id, area_id);
