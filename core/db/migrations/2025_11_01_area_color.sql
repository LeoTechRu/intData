ALTER TABLE areas
  ADD COLUMN IF NOT EXISTS color VARCHAR(7) NOT NULL DEFAULT '#F1F5F9',
  ADD CONSTRAINT IF NOT EXISTS chk_areas_color_hex CHECK (color ~ '^#[0-9A-Fa-f]{6}$');

UPDATE areas
  SET color = '#FFF8B8'
  WHERE lower(coalesce(slug, '')) = 'inbox' OR lower(name) = 'входящие';
