-- Habitica-like module foundations (E16)

-- habits table
CREATE TABLE IF NOT EXISTS habits (
    id           BIGSERIAL PRIMARY KEY,
    owner_id     BIGINT REFERENCES users_web(id),
    area_id      INTEGER NOT NULL REFERENCES areas(id),
    project_id   INTEGER REFERENCES projects(id),
    title        TEXT NOT NULL,
    note         TEXT,
    type         TEXT NOT NULL CHECK (type IN ('positive','negative','both')),
    difficulty   TEXT NOT NULL CHECK (difficulty IN ('trivial','easy','medium','hard')),
    up_enabled   BOOLEAN NOT NULL DEFAULT TRUE,
    down_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    val          DOUBLE PRECISION NOT NULL DEFAULT 0,
    tags         TEXT[],
    archived_at  TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- extend existing habits table if already present
ALTER TABLE habits ADD COLUMN IF NOT EXISTS owner_id BIGINT REFERENCES users_web(id);
ALTER TABLE habits ADD COLUMN IF NOT EXISTS area_id INTEGER;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS project_id INTEGER REFERENCES projects(id);
ALTER TABLE habits ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('positive','negative','both'));
ALTER TABLE habits ADD COLUMN IF NOT EXISTS difficulty TEXT CHECK (difficulty IN ('trivial','easy','medium','hard'));
ALTER TABLE habits ADD COLUMN IF NOT EXISTS up_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS down_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS val DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS tags TEXT[];
ALTER TABLE habits ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
ALTER TABLE habits ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE habits ALTER COLUMN area_id SET NOT NULL;

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
