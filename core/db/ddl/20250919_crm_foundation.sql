-- CRM foundations: продукты, тарифы, потоки, сделки, аккаунты, подписки, коммуникации

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'crm_account_type'
    ) THEN
        CREATE TYPE crm_account_type AS ENUM ('person', 'company');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'crm_deal_status'
    ) THEN
        CREATE TYPE crm_deal_status AS ENUM ('lead', 'qualified', 'proposal', 'won', 'lost', 'archived');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'crm_billing_type'
    ) THEN
        CREATE TYPE crm_billing_type AS ENUM ('free', 'one_off', 'subscription', 'upgrade', 'downgrade');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'crm_touchpoint_channel'
    ) THEN
        CREATE TYPE crm_touchpoint_channel AS ENUM ('email', 'telegram', 'phone_call', 'meeting', 'note', 'system', 'web_form');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'crm_touchpoint_direction'
    ) THEN
        CREATE TYPE crm_touchpoint_direction AS ENUM ('inbound', 'outbound', 'internal');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'crm_subscription_status'
    ) THEN
        CREATE TYPE crm_subscription_status AS ENUM ('active', 'pending', 'completed', 'cancelled', 'failed');
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'crm_pricing_mode'
    ) THEN
        CREATE TYPE crm_pricing_mode AS ENUM ('cohort', 'rolling', 'perpetual');
    END IF;
END
$$;

ALTER TABLE users_web
    ALTER COLUMN username DROP NOT NULL;

ALTER TABLE users_web
    ALTER COLUMN password_hash DROP NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.constraint_column_usage
        WHERE table_name = 'users_web' AND constraint_name = 'users_web_contact_present'
    ) THEN
        EXECUTE '
            ALTER TABLE users_web
            ADD CONSTRAINT users_web_contact_present
            CHECK (
                username IS NOT NULL
                OR email IS NOT NULL
                OR phone IS NOT NULL
            )
        ';
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS crm_products (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(96) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    kind VARCHAR(32) NOT NULL DEFAULT 'default',
    area_id INTEGER,
    project_id INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crm_products_para_ck CHECK (project_id IS NOT NULL OR area_id IS NOT NULL),
    CONSTRAINT crm_products_area_fk FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
    CONSTRAINT crm_products_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_products_area ON crm_products(area_id);
CREATE INDEX IF NOT EXISTS idx_crm_products_project ON crm_products(project_id);

CREATE TABLE IF NOT EXISTS crm_pipelines (
    id BIGSERIAL PRIMARY KEY,
    slug VARCHAR(96) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    area_id INTEGER,
    project_id INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crm_pipelines_para_ck CHECK (project_id IS NOT NULL OR area_id IS NOT NULL),
    CONSTRAINT crm_pipelines_area_fk FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
    CONSTRAINT crm_pipelines_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS crm_pipeline_stages (
    id BIGSERIAL PRIMARY KEY,
    pipeline_id BIGINT NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
    slug VARCHAR(96) NOT NULL,
    title VARCHAR(255) NOT NULL,
    position INTEGER NOT NULL DEFAULT 0,
    probability NUMERIC(5,2),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (pipeline_id, slug),
    UNIQUE (pipeline_id, position)
);

CREATE TABLE IF NOT EXISTS crm_accounts (
    id BIGSERIAL PRIMARY KEY,
    account_type crm_account_type NOT NULL DEFAULT 'person',
    web_user_id INTEGER REFERENCES users_web(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(32),
    area_id INTEGER,
    project_id INTEGER,
    source VARCHAR(64),
    tags TEXT[] DEFAULT '{}',
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crm_accounts_para_ck CHECK (project_id IS NOT NULL OR area_id IS NOT NULL),
    CONSTRAINT crm_accounts_area_fk FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
    CONSTRAINT crm_accounts_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_accounts_area ON crm_accounts(area_id);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_project ON crm_accounts(project_id);
CREATE INDEX IF NOT EXISTS idx_crm_accounts_email ON crm_accounts(lower(email));
CREATE INDEX IF NOT EXISTS idx_crm_accounts_phone ON crm_accounts(phone);

CREATE TABLE IF NOT EXISTS crm_product_versions (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES crm_products(id) ON DELETE CASCADE,
    parent_version_id BIGINT REFERENCES crm_product_versions(id) ON DELETE SET NULL,
    slug VARCHAR(96) NOT NULL,
    title VARCHAR(255) NOT NULL,
    pricing_mode crm_pricing_mode NOT NULL DEFAULT 'cohort',
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    seats_limit INTEGER,
    area_id INTEGER,
    project_id INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT crm_product_versions_para_ck CHECK (project_id IS NOT NULL OR area_id IS NOT NULL),
    CONSTRAINT crm_product_versions_area_fk FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
    CONSTRAINT crm_product_versions_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL,
    UNIQUE (product_id, slug)
);

CREATE TABLE IF NOT EXISTS crm_product_tariffs (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES crm_products(id) ON DELETE CASCADE,
    version_id BIGINT REFERENCES crm_product_versions(id) ON DELETE SET NULL,
    slug VARCHAR(96) NOT NULL,
    title VARCHAR(255) NOT NULL,
    billing_type crm_billing_type NOT NULL DEFAULT 'one_off',
    amount NUMERIC(12,2),
    currency CHAR(3) NOT NULL DEFAULT 'RUB',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (product_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_crm_tariffs_version ON crm_product_tariffs(version_id);

CREATE TABLE IF NOT EXISTS crm_deals (
    id BIGSERIAL PRIMARY KEY,
    account_id BIGINT NOT NULL REFERENCES crm_accounts(id) ON DELETE CASCADE,
    owner_id INTEGER REFERENCES users_web(id) ON DELETE SET NULL,
    pipeline_id BIGINT NOT NULL REFERENCES crm_pipelines(id) ON DELETE CASCADE,
    stage_id BIGINT NOT NULL REFERENCES crm_pipeline_stages(id) ON DELETE RESTRICT,
    product_id BIGINT REFERENCES crm_products(id) ON DELETE SET NULL,
    version_id BIGINT REFERENCES crm_product_versions(id) ON DELETE SET NULL,
    tariff_id BIGINT REFERENCES crm_product_tariffs(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    status crm_deal_status NOT NULL DEFAULT 'lead',
    value NUMERIC(14,2),
    currency CHAR(3) NOT NULL DEFAULT 'RUB',
    probability NUMERIC(5,2),
    knowledge_node_id INTEGER,
    area_id INTEGER,
    project_id INTEGER,
    opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    closed_at TIMESTAMPTZ,
    close_forecast_at TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT crm_deals_para_ck CHECK (project_id IS NOT NULL OR area_id IS NOT NULL),
    CONSTRAINT crm_deals_area_fk FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
    CONSTRAINT crm_deals_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_deals_account ON crm_deals(account_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_pipeline_stage ON crm_deals(pipeline_id, stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_deals_status ON crm_deals(status);

CREATE TABLE IF NOT EXISTS crm_touchpoints (
    id BIGSERIAL PRIMARY KEY,
    deal_id BIGINT REFERENCES crm_deals(id) ON DELETE CASCADE,
    account_id BIGINT REFERENCES crm_accounts(id) ON DELETE CASCADE,
    channel crm_touchpoint_channel NOT NULL,
    direction crm_touchpoint_direction NOT NULL DEFAULT 'inbound',
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    summary TEXT,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    emotion_score NUMERIC(5,2),
    created_by INTEGER REFERENCES users_web(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_touchpoints_deal ON crm_touchpoints(deal_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_touchpoints_account ON crm_touchpoints(account_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS crm_subscriptions (
    id BIGSERIAL PRIMARY KEY,
    web_user_id INTEGER NOT NULL REFERENCES users_web(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES crm_products(id) ON DELETE CASCADE,
    version_id BIGINT REFERENCES crm_product_versions(id) ON DELETE SET NULL,
    tariff_id BIGINT REFERENCES crm_product_tariffs(id) ON DELETE SET NULL,
    status crm_subscription_status NOT NULL DEFAULT 'active',
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    activation_source VARCHAR(64),
    ended_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    area_id INTEGER,
    project_id INTEGER,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    CONSTRAINT crm_subscriptions_para_ck CHECK (project_id IS NOT NULL OR area_id IS NOT NULL),
    CONSTRAINT crm_subscriptions_area_fk FOREIGN KEY (area_id) REFERENCES areas(id) ON DELETE SET NULL,
    CONSTRAINT crm_subscriptions_project_fk FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_subscriptions_user ON crm_subscriptions(web_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_subscriptions_status ON crm_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_crm_subscriptions_product ON crm_subscriptions(product_id, version_id);

CREATE TABLE IF NOT EXISTS crm_subscription_events (
    id BIGSERIAL PRIMARY KEY,
    subscription_id BIGINT NOT NULL REFERENCES crm_subscriptions(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_by INTEGER REFERENCES users_web(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_crm_sub_events_sub ON crm_subscription_events(subscription_id, occurred_at DESC);
