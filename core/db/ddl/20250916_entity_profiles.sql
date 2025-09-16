-- Unified entity profiles and access grants
CREATE TABLE IF NOT EXISTS entity_profiles (
    id SERIAL PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id BIGINT NOT NULL,
    slug TEXT NOT NULL,
    display_name TEXT NOT NULL,
    headline TEXT,
    summary TEXT,
    avatar_url TEXT,
    cover_url TEXT,
    tags JSONB DEFAULT '[]'::jsonb,
    profile_meta JSONB DEFAULT '{}'::jsonb,
    sections JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_entity_profiles_type CHECK (entity_type IN ('user','group','project','area','resource')),
    CONSTRAINT ck_entity_profiles_slug CHECK (char_length(slug) BETWEEN 1 AND 255),
    CONSTRAINT ck_entity_profiles_tags CHECK (tags IS NULL OR jsonb_typeof(tags) = 'array'),
    CONSTRAINT ck_entity_profiles_sections CHECK (sections IS NULL OR jsonb_typeof(sections) = 'array'),
    CONSTRAINT ck_entity_profiles_meta CHECK (profile_meta IS NULL OR jsonb_typeof(profile_meta) = 'object')
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_entity_profiles_entity
    ON entity_profiles(entity_type, entity_id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_entity_profiles_slug
    ON entity_profiles(entity_type, lower(slug));

CREATE INDEX IF NOT EXISTS ix_entity_profiles_updated
    ON entity_profiles(entity_type, updated_at DESC);


CREATE TABLE IF NOT EXISTS entity_profile_grants (
    id SERIAL PRIMARY KEY,
    profile_id INTEGER NOT NULL REFERENCES entity_profiles(id) ON DELETE CASCADE,
    audience_type TEXT NOT NULL,
    subject_id BIGINT,
    sections JSONB,
    created_by INTEGER REFERENCES users_web(id),
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT ck_profile_grants_audience CHECK (audience_type IN ('public','authenticated','user','group','project','area')),
    CONSTRAINT ck_profile_grants_subject CHECK (
        (audience_type IN ('public','authenticated') AND subject_id IS NULL)
        OR (audience_type NOT IN ('public','authenticated') AND subject_id IS NOT NULL)
    ),
    CONSTRAINT ck_profile_grants_sections CHECK (sections IS NULL OR jsonb_typeof(sections) = 'array')
);

CREATE INDEX IF NOT EXISTS ix_entity_profile_grants_profile
    ON entity_profile_grants(profile_id);

CREATE INDEX IF NOT EXISTS ix_entity_profile_grants_subject
    ON entity_profile_grants(audience_type, subject_id)
    WHERE subject_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_entity_profile_grants_public
    ON entity_profile_grants(profile_id, audience_type)
    WHERE audience_type IN ('public','authenticated');

CREATE UNIQUE INDEX IF NOT EXISTS ux_entity_profile_grants_target
    ON entity_profile_grants(profile_id, audience_type, subject_id)
    WHERE audience_type NOT IN ('public','authenticated');

-- Ensure system users have baseline profile rows
INSERT INTO entity_profiles (entity_type, entity_id, slug, display_name)
SELECT 'user', u.id, lower(u.username), COALESCE(u.full_name, u.username)
FROM users_web u
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    slug = EXCLUDED.slug,
    display_name = EXCLUDED.display_name,
    updated_at = now();

INSERT INTO entity_profiles (entity_type, entity_id, slug, display_name, summary)
SELECT
    'project',
    p.id,
    COALESCE(NULLIF(lower(p.slug), ''), NULLIF(regexp_replace(lower(p.name), '[^a-z0-9]+', '-', 'g'), ''), 'project-' || p.id::text),
    p.name,
    p.description
FROM projects p
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    slug = EXCLUDED.slug,
    display_name = EXCLUDED.display_name,
    summary = COALESCE(EXCLUDED.summary, entity_profiles.summary),
    updated_at = now();

INSERT INTO entity_profiles (entity_type, entity_id, slug, display_name, summary)
SELECT
    'area',
    a.id,
    COALESCE(NULLIF(lower(a.slug), ''), NULLIF(regexp_replace(lower(a.title), '[^a-z0-9]+', '-', 'g'), ''), 'area-' || a.id::text),
    a.title,
    NULL
FROM areas a
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    slug = EXCLUDED.slug,
    display_name = EXCLUDED.display_name,
    updated_at = now();

INSERT INTO entity_profiles (entity_type, entity_id, slug, display_name, summary)
SELECT
    'group',
    g.telegram_id,
    COALESCE(NULLIF(regexp_replace(lower(g.title), '[^a-z0-9]+', '-', 'g'), ''), 'group-' || g.telegram_id::text),
    g.title,
    g.description
FROM groups g
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    slug = COALESCE(NULLIF(EXCLUDED.slug, ''), entity_profiles.slug),
    display_name = EXCLUDED.display_name,
    summary = COALESCE(EXCLUDED.summary, entity_profiles.summary),
    updated_at = now();

INSERT INTO entity_profiles (entity_type, entity_id, slug, display_name, summary, profile_meta)
SELECT
    'resource',
    r.id,
    COALESCE(NULLIF(regexp_replace(lower(r.title), '[^a-z0-9]+', '-', 'g'), ''), 'resource-' || r.id::text),
    r.title,
    r.content,
    jsonb_build_object('type', r.type)
FROM resources r
ON CONFLICT (entity_type, entity_id) DO UPDATE SET
    slug = COALESCE(NULLIF(EXCLUDED.slug, ''), entity_profiles.slug),
    display_name = EXCLUDED.display_name,
    summary = COALESCE(EXCLUDED.summary, entity_profiles.summary),
    profile_meta = COALESCE(EXCLUDED.profile_meta, entity_profiles.profile_meta),
    updated_at = now();

-- Ensure each profile has at least an authenticated grant by default
INSERT INTO entity_profile_grants (profile_id, audience_type, subject_id)
SELECT p.id, 'user', p.entity_id
FROM entity_profiles p
WHERE p.entity_type = 'user'
ON CONFLICT (profile_id, audience_type, subject_id)
    WHERE audience_type NOT IN ('public','authenticated') DO NOTHING;
