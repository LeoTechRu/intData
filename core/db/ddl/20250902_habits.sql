-- habits table
CREATE TABLE IF NOT EXISTS habits (
    id            BIGSERIAL PRIMARY KEY,
    owner_id      BIGINT REFERENCES users_tg(telegram_id),
    area_id       INTEGER NOT NULL REFERENCES areas(id),
    project_id    INTEGER REFERENCES projects(id),
    title         VARCHAR(255) NOT NULL,
    note          TEXT,
    type          VARCHAR(8) NOT NULL CHECK (type IN ('positive','negative','both')),
    difficulty    VARCHAR(8) NOT NULL CHECK (difficulty IN ('trivial','easy','medium','hard')),
    frequency     VARCHAR(20) NOT NULL DEFAULT 'daily',
    progress      JSON NOT NULL DEFAULT '{}'::json,
    up_enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    down_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
    val           DOUBLE PRECISION NOT NULL DEFAULT 0,
    daily_limit   INTEGER NOT NULL DEFAULT 10,
    cooldown_sec  INTEGER NOT NULL DEFAULT 60,
    last_action_at TIMESTAMPTZ,
    tags          JSON,
    archived_at   TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- extend existing habits table if already present
ALTER TABLE habits ADD COLUMN IF NOT EXISTS owner_id BIGINT;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS area_id INTEGER;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS project_id INTEGER;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS title VARCHAR(255);
ALTER TABLE habits ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS type VARCHAR(8);
ALTER TABLE habits ADD COLUMN IF NOT EXISTS difficulty VARCHAR(8);
ALTER TABLE habits ADD COLUMN IF NOT EXISTS frequency VARCHAR(20);
ALTER TABLE habits ADD COLUMN IF NOT EXISTS progress JSON;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS up_enabled BOOLEAN;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS down_enabled BOOLEAN;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS val DOUBLE PRECISION;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS daily_limit INTEGER;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS cooldown_sec INTEGER;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS last_action_at TIMESTAMPTZ;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS tags JSON;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

-- legacy column migration
UPDATE habits SET note = COALESCE(note, description) WHERE note IS NULL AND column_name('habits','description');

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'habits' AND column_name = 'name'
    ) THEN
        UPDATE habits SET title = COALESCE(title, name);
        ALTER TABLE habits DROP COLUMN name;
    END IF;
END $$;

UPDATE habits SET title = COALESCE(title, description) WHERE title IS NULL;

ALTER TABLE habits DROP COLUMN IF EXISTS description;
ALTER TABLE habits DROP COLUMN IF EXISTS schedule;
ALTER TABLE habits DROP COLUMN IF EXISTS metrics;
ALTER TABLE habits DROP COLUMN IF EXISTS start_date;
ALTER TABLE habits DROP COLUMN IF EXISTS end_date;
ALTER TABLE habits DROP COLUMN IF EXISTS updated_at;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'habits' AND column_name = 'frequency'
    ) THEN
        ALTER TABLE habits ADD COLUMN frequency VARCHAR(20);
    END IF;
END $$;

UPDATE habits SET frequency = 'daily' WHERE frequency IS NULL;
ALTER TABLE habits ALTER COLUMN frequency SET DATA TYPE VARCHAR(20);
ALTER TABLE habits ALTER COLUMN frequency SET NOT NULL;
ALTER TABLE habits ALTER COLUMN frequency SET DEFAULT 'daily';

UPDATE habits SET progress = '{}'::json WHERE progress IS NULL;
ALTER TABLE habits ALTER COLUMN progress SET DEFAULT '{}'::json;
ALTER TABLE habits ALTER COLUMN progress SET NOT NULL;

ALTER TABLE habits ALTER COLUMN up_enabled SET DEFAULT TRUE;
ALTER TABLE habits ALTER COLUMN up_enabled SET NOT NULL;
ALTER TABLE habits ALTER COLUMN down_enabled SET DEFAULT TRUE;
ALTER TABLE habits ALTER COLUMN down_enabled SET NOT NULL;
ALTER TABLE habits ALTER COLUMN val SET DEFAULT 0;
ALTER TABLE habits ALTER COLUMN val SET NOT NULL;

ALTER TABLE habits ALTER COLUMN daily_limit SET DEFAULT 10;
ALTER TABLE habits ALTER COLUMN cooldown_sec SET DEFAULT 60;

ALTER TABLE habits ALTER COLUMN area_id SET NOT NULL;

ALTER TABLE habits DROP CONSTRAINT IF EXISTS fk_habits_owner;
ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_owner_id_fkey;
ALTER TABLE habits ADD CONSTRAINT fk_habits_owner FOREIGN KEY (owner_id) REFERENCES users_tg(telegram_id);
ALTER TABLE habits DROP CONSTRAINT IF EXISTS fk_habits_area;
ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_area_id_fkey;
ALTER TABLE habits ADD CONSTRAINT fk_habits_area FOREIGN KEY (area_id) REFERENCES areas(id);
ALTER TABLE habits DROP CONSTRAINT IF EXISTS fk_habits_project;
ALTER TABLE habits DROP CONSTRAINT IF EXISTS habits_project_id_fkey;
ALTER TABLE habits ADD CONSTRAINT fk_habits_project FOREIGN KEY (project_id) REFERENCES projects(id);

CREATE INDEX IF NOT EXISTS idx_habits_owner_area ON habits(owner_id, area_id);
CREATE INDEX IF NOT EXISTS idx_habits_project ON habits(project_id);

-- habit_logs table
CREATE TABLE IF NOT EXISTS habit_logs (
    id          BIGSERIAL PRIMARY KEY,
    habit_id    BIGINT REFERENCES habits(id) ON DELETE CASCADE,
    owner_id    BIGINT,
    at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    delta       INTEGER NOT NULL CHECK (delta IN (-1,1)),
    reward_xp   INTEGER,
    reward_gold INTEGER,
    penalty_hp  INTEGER
);
CREATE INDEX IF NOT EXISTS idx_habit_logs_owner_at ON habit_logs(owner_id, at);

-- dailies table
CREATE TABLE IF NOT EXISTS dailies (
    id         BIGSERIAL PRIMARY KEY,
    owner_id   BIGINT REFERENCES users_web(id),
    area_id    INTEGER NOT NULL REFERENCES areas(id),
    project_id INTEGER REFERENCES projects(id),
    title      TEXT NOT NULL,
    note       TEXT,
    rrule      TEXT NOT NULL,
    difficulty TEXT NOT NULL CHECK (difficulty IN ('trivial','easy','medium','hard')),
    streak     INTEGER NOT NULL DEFAULT 0,
    frozen     BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE dailies ADD COLUMN IF NOT EXISTS owner_id BIGINT REFERENCES users_web(id);
ALTER TABLE dailies ADD COLUMN IF NOT EXISTS area_id INTEGER;
ALTER TABLE dailies ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id);
ALTER TABLE dailies ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE dailies ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE dailies ADD COLUMN IF NOT EXISTS rrule TEXT;
ALTER TABLE dailies ADD COLUMN IF NOT EXISTS difficulty TEXT CHECK (difficulty IN ('trivial','easy','medium','hard'));
ALTER TABLE dailies ADD COLUMN IF NOT EXISTS streak INTEGER NOT NULL DEFAULT 0;
ALTER TABLE dailies ADD COLUMN IF NOT EXISTS frozen BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE dailies ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE dailies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE dailies ALTER COLUMN area_id SET NOT NULL;
ALTER TABLE dailies
    ADD CONSTRAINT IF NOT EXISTS fk_dailies_area FOREIGN KEY (area_id) REFERENCES areas(id),
    ADD CONSTRAINT IF NOT EXISTS fk_dailies_project FOREIGN KEY (project_id) REFERENCES projects(id);

-- daily_logs
CREATE TABLE IF NOT EXISTS daily_logs (
    id         BIGSERIAL PRIMARY KEY,
    daily_id   BIGINT REFERENCES dailies(id) ON DELETE CASCADE,
    owner_id   BIGINT,
    date       DATE NOT NULL,
    done       BOOLEAN NOT NULL,
    reward_xp   INTEGER,
    reward_gold INTEGER,
    penalty_hp  INTEGER,
    UNIQUE (daily_id, date)
);
CREATE INDEX IF NOT EXISTS idx_daily_logs_owner_date ON daily_logs(owner_id, date);

-- rewards table
CREATE TABLE IF NOT EXISTS rewards (
    id         BIGSERIAL PRIMARY KEY,
    owner_id   BIGINT REFERENCES users_web(id),
    title      TEXT NOT NULL,
    cost_gold  INTEGER NOT NULL CHECK (cost_gold >= 0),
    area_id    INTEGER NOT NULL REFERENCES areas(id),
    project_id INTEGER REFERENCES projects(id),
    archived_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS owner_id BIGINT REFERENCES users_web(id);
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS cost_gold INTEGER CHECK (cost_gold >= 0);
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS area_id INTEGER;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id);
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE rewards ALTER COLUMN area_id SET NOT NULL;
ALTER TABLE rewards
    ADD CONSTRAINT IF NOT EXISTS fk_rewards_area FOREIGN KEY (area_id) REFERENCES areas(id),
    ADD CONSTRAINT IF NOT EXISTS fk_rewards_project FOREIGN KEY (project_id) REFERENCES projects(id);
CREATE INDEX IF NOT EXISTS idx_rewards_owner_area ON rewards(owner_id, area_id);

-- user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
    owner_id BIGINT PRIMARY KEY REFERENCES users_web(id),
    level    INTEGER NOT NULL DEFAULT 1,
    xp       INTEGER NOT NULL DEFAULT 0,
    gold     INTEGER NOT NULL DEFAULT 0,
    hp       INTEGER NOT NULL DEFAULT 50,
    kp       BIGINT NOT NULL DEFAULT 0,
    last_cron DATE
);
