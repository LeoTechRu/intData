-- Telegram group CRM extensions: products, activity stats, removal log

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'product_status'
    ) THEN
        CREATE TYPE product_status AS ENUM ('pending', 'trial', 'paid', 'refunded', 'gift');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    slug VARCHAR(64) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    attributes JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users_products (
    user_id BIGINT NOT NULL REFERENCES users_tg(telegram_id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    status product_status NOT NULL DEFAULT 'paid',
    source VARCHAR(64),
    acquired_at TIMESTAMPTZ DEFAULT now(),
    notes TEXT,
    extra JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_users_products_product ON users_products(product_id);
CREATE INDEX IF NOT EXISTS idx_users_products_status ON users_products(status);

CREATE TABLE IF NOT EXISTS group_activity_daily (
    group_id BIGINT NOT NULL REFERENCES groups(telegram_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users_tg(telegram_id) ON DELETE CASCADE,
    activity_date DATE NOT NULL,
    messages_count INTEGER NOT NULL DEFAULT 0,
    reactions_count INTEGER NOT NULL DEFAULT 0,
    last_activity_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id, activity_date)
);

CREATE INDEX IF NOT EXISTS idx_group_activity_group_date ON group_activity_daily(group_id, activity_date DESC);
CREATE INDEX IF NOT EXISTS idx_group_activity_group_user ON group_activity_daily(group_id, user_id);

CREATE TABLE IF NOT EXISTS group_removal_log (
    id BIGSERIAL PRIMARY KEY,
    group_id BIGINT NOT NULL REFERENCES groups(telegram_id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users_tg(telegram_id),
    product_id INTEGER REFERENCES products(id),
    initiator_web_id INTEGER REFERENCES users_web(id),
    initiator_tg_id BIGINT,
    reason TEXT,
    result VARCHAR(32) NOT NULL DEFAULT 'queued',
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_group_removal_group_created ON group_removal_log(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_group_removal_product ON group_removal_log(product_id);

ALTER TABLE user_group
    ADD COLUMN IF NOT EXISTS crm_notes TEXT,
    ADD COLUMN IF NOT EXISTS trial_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS crm_tags JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS crm_metadata JSONB DEFAULT '{}'::jsonb;

