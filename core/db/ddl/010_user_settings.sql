-- user_settings: K/V JSONB на пользователя
CREATE TABLE IF NOT EXISTS user_settings (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT NOT NULL REFERENCES users_web(id) ON DELETE CASCADE,
  key         VARCHAR(64) NOT NULL,
  value       JSONB NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);
