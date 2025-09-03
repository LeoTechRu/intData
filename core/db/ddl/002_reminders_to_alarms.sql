-- Migrate legacy reminders into calendar_items and alarms.
-- Creates CalendarItem(kind='task') with an Alarm for each reminder.

DO $migrate_reminders$
DECLARE
  rn INT;
BEGIN
  -- если таблицы reminders нет — выходим
  PERFORM 1
    FROM information_schema.tables
    WHERE table_name = 'reminders' AND table_schema = 'public';
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- для каждого owner_id в reminders — обеспечим системную area «Входящие»
  INSERT INTO areas (id, owner_id, title, is_active, created_at)
  SELECT gen_random_uuid(), r.owner_id, 'Входящие', TRUE, now()
  FROM (SELECT DISTINCT owner_id FROM reminders) r
  WHERE NOT EXISTS (
    SELECT 1 FROM areas a
    WHERE a.owner_id = r.owner_id AND a.title IN ('Входящие','Unassigned','Default','Inbox')
  );

  -- создаём calendar_items и alarms
  WITH default_areas AS (
    SELECT a.owner_id, a.id AS area_id
    FROM areas a
    WHERE a.title IN ('Входящие','Unassigned','Default','Inbox')
  ),
  ins_items AS (
    INSERT INTO calendar_items (id, kind, title, area_id, due_at, created_at, updated_at)
    SELECT gen_random_uuid(), 'task', '(бывшее напоминание)', da.area_id, r.remind_at, now(), now()
    FROM reminders r
    JOIN default_areas da ON da.owner_id = r.owner_id
    RETURNING id, due_at
  )
  INSERT INTO alarms (id, item_id, trigger_at, action, payload, enabled, created_at)
  SELECT gen_random_uuid(), i.id, i.due_at, 'inapp', '{}'::jsonb, TRUE, now()
  FROM ins_items i;

END
$migrate_reminders$;
