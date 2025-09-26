-- Anti-farm mechanics extensions for habits module
-- MR-11

-- user_stats daily counters
ALTER TABLE user_stats
    ADD COLUMN IF NOT EXISTS daily_xp INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS daily_gold INT NOT NULL DEFAULT 0;

-- habits per-day limits and cooldown
ALTER TABLE habits
    ADD COLUMN IF NOT EXISTS daily_limit INT NOT NULL DEFAULT 10,
    ADD COLUMN IF NOT EXISTS cooldown_sec INT NOT NULL DEFAULT 60,
    ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ;

-- habit_logs audit of value after click
ALTER TABLE habit_logs
    ADD COLUMN IF NOT EXISTS val_after DOUBLE PRECISION;

-- ensure index for fast lookups
CREATE INDEX IF NOT EXISTS habit_logs_owner_at_idx ON habit_logs(owner_id, at);
