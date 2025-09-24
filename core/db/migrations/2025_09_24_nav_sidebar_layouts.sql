CREATE TABLE IF NOT EXISTS nav_sidebar_layouts (
    id SERIAL PRIMARY KEY,
    scope VARCHAR(16) NOT NULL CHECK (scope IN ('user', 'global')),
    owner_id INTEGER,
    version INTEGER NOT NULL DEFAULT 1,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_nav_sidebar_layouts_scope_owner
    ON nav_sidebar_layouts (scope, owner_id);

CREATE INDEX IF NOT EXISTS ix_nav_sidebar_layouts_owner
    ON nav_sidebar_layouts (owner_id);

-- Legacy migration: lift existing layouts from app_settings/user_settings if present
INSERT INTO nav_sidebar_layouts (scope, owner_id, version, payload)
SELECT 'global' AS scope,
       NULL::INTEGER AS owner_id,
       1 AS version,
       value::jsonb AS payload
FROM app_settings
WHERE key = 'ui.nav.sidebar.layout'
  AND NOT EXISTS (
      SELECT 1 FROM nav_sidebar_layouts WHERE scope = 'global' AND owner_id IS NULL
  );

DELETE FROM app_settings WHERE key = 'ui.nav.sidebar.layout';
