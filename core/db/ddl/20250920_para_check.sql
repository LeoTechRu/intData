-- Ensure exactly one container (project or area) is assigned to PARA entities

ALTER TABLE calendar_items
    ADD CONSTRAINT IF NOT EXISTS ck_calendar_items_single_container
    CHECK ((project_id IS NOT NULL) <> (area_id IS NOT NULL));

ALTER TABLE tasks
    ADD CONSTRAINT IF NOT EXISTS ck_tasks_single_container
    CHECK ((project_id IS NOT NULL) <> (area_id IS NOT NULL));

ALTER TABLE time_entries
    ADD CONSTRAINT IF NOT EXISTS ck_time_entries_single_container
    CHECK ((project_id IS NOT NULL) <> (area_id IS NOT NULL));

ALTER TABLE notes
    ADD CONSTRAINT IF NOT EXISTS ck_notes_single_container
    CHECK ((project_id IS NOT NULL) <> (area_id IS NOT NULL));

ALTER TABLE habits
    ADD CONSTRAINT IF NOT EXISTS ck_habits_single_container
    CHECK ((project_id IS NOT NULL) <> (area_id IS NOT NULL));

ALTER TABLE dailies
    ADD CONSTRAINT IF NOT EXISTS ck_dailies_single_container
    CHECK ((project_id IS NOT NULL) <> (area_id IS NOT NULL));

ALTER TABLE rewards
    ADD CONSTRAINT IF NOT EXISTS ck_rewards_single_container
    CHECK ((project_id IS NOT NULL) <> (area_id IS NOT NULL));
