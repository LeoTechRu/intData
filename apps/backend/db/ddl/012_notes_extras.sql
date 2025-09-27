ALTER TABLE notes
  ALTER COLUMN title TYPE TEXT,
  ADD COLUMN IF NOT EXISTS color VARCHAR(20),
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_notes_owner_area_pinned_order ON notes(owner_id, area_id, pinned DESC, order_index);
CREATE INDEX IF NOT EXISTS idx_notes_owner_archived ON notes(owner_id, archived_at);
