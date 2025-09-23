-- Ensure exactly one container (project or area) is assigned to PARA entities

ALTER TABLE calendar_items
    DROP CONSTRAINT IF EXISTS ck_calendar_items_single_container,
    ADD CONSTRAINT ck_calendar_items_single_container
        CHECK ((project_id IS NOT NULL) <> (area_id IS NOT NULL));

ALTER TABLE tasks
    DROP CONSTRAINT IF EXISTS ck_tasks_single_container,
    ADD CONSTRAINT ck_tasks_single_container
        CHECK ((project_id IS NOT NULL) <> (area_id IS NOT NULL));

ALTER TABLE time_entries
    DROP CONSTRAINT IF EXISTS ck_time_entries_single_container,
    ADD CONSTRAINT ck_time_entries_single_container
        CHECK ((project_id IS NOT NULL) <> (area_id IS NOT NULL));

ALTER TABLE notes
    DROP CONSTRAINT IF EXISTS ck_notes_single_container,
    ADD CONSTRAINT ck_notes_single_container
        CHECK ((project_id IS NOT NULL) <> (area_id IS NOT NULL));

ALTER TABLE habits
    DROP CONSTRAINT IF EXISTS ck_habits_single_container,
    ADD CONSTRAINT ck_habits_single_container
        CHECK ((project_id IS NOT NULL) OR (area_id IS NOT NULL));

ALTER TABLE dailies
    DROP CONSTRAINT IF EXISTS ck_dailies_single_container,
    ADD CONSTRAINT ck_dailies_single_container
        CHECK ((project_id IS NOT NULL) OR (area_id IS NOT NULL));

ALTER TABLE rewards
    DROP CONSTRAINT IF EXISTS ck_rewards_single_container,
    ADD CONSTRAINT ck_rewards_single_container
        CHECK ((project_id IS NOT NULL) OR (area_id IS NOT NULL));
