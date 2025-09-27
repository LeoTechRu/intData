-- Migrate legacy reminders into calendar_items and alarms.
-- Creates CalendarItem(kind='task') with an Alarm for each reminder.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name='reminders' AND column_name='item_id'
    ) THEN
        WITH personal_areas AS (
            SELECT id, owner_id FROM areas WHERE type = 'PERSONAL'
        ),
        ins_items AS (
            INSERT INTO calendar_items (kind, title, due_at, area_id, created_at, updated_at)
            SELECT 'task', '(бывшее напоминание)', r.remind_at, pa.id, now(), now()
            FROM reminders r
            JOIN personal_areas pa ON pa.owner_id = r.owner_id
            RETURNING id, due_at
        )
        INSERT INTO alarms (item_id, trigger_at, created_at)
        SELECT id, due_at, now() FROM ins_items;
    END IF;
END
$$;
