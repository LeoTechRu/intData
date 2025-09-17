-- Diagnostics integration migration

ALTER TABLE users_web
    ADD COLUMN IF NOT EXISTS diagnostics_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS diagnostics_active BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS diagnostics_available SMALLINT[] NOT NULL DEFAULT '{}'::SMALLINT[];

CREATE TABLE IF NOT EXISTS diagnostic_templates (
    id SMALLINT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    form_path TEXT NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB NOT NULL DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS diagnostic_clients (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users_web(id) ON DELETE CASCADE,
    specialist_id INTEGER REFERENCES users_web(id) ON DELETE SET NULL,
    is_new BOOLEAN NOT NULL DEFAULT TRUE,
    in_archive BOOLEAN NOT NULL DEFAULT FALSE,
    contact_permission BOOLEAN NOT NULL DEFAULT TRUE,
    last_result_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_diagnostic_clients_specialist ON diagnostic_clients(specialist_id, in_archive, is_new);
CREATE INDEX IF NOT EXISTS ix_diagnostic_clients_last_result ON diagnostic_clients(last_result_at DESC);

CREATE TABLE IF NOT EXISTS diagnostic_results (
    id BIGSERIAL PRIMARY KEY,
    client_id INTEGER NOT NULL REFERENCES diagnostic_clients(id) ON DELETE CASCADE,
    specialist_id INTEGER REFERENCES users_web(id) ON DELETE SET NULL,
    diagnostic_id SMALLINT REFERENCES diagnostic_templates(id),
    payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    open_answer TEXT,
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_diagnostic_results_client ON diagnostic_results(client_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS ix_diagnostic_results_specialist ON diagnostic_results(specialist_id, submitted_at DESC);

INSERT INTO auth_permissions (code, name, description, category, bit_position, mutable)
VALUES
    ('diagnostics.clients.manage', 'Diagnostics: manage clients', 'Просмотр и управление клиентами диагностик', 'diagnostics', 14, FALSE),
    ('diagnostics.specialists.manage', 'Diagnostics: manage specialists', 'Управление специалистами и их доступом к диагностикам', 'diagnostics', 15, FALSE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    bit_position = EXCLUDED.bit_position,
    mutable = EXCLUDED.mutable;

INSERT INTO roles (slug, name, description, level, permissions_mask, is_system, grants_all)
VALUES
    ('diagnostics_client', 'Diagnostics Client', 'Клиент диагностических программ', 5, 0, FALSE, FALSE),
    ('diagnostics_specialist', 'Diagnostics Specialist', 'Специалист по диагностике', 25, (1 << 14), FALSE, FALSE),
    ('diagnostics_admin', 'Diagnostics Admin', 'Администратор диагностик', 35, (1 << 14) + (1 << 15), FALSE, FALSE)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    level = EXCLUDED.level,
    permissions_mask = EXCLUDED.permissions_mask,
    grants_all = EXCLUDED.grants_all;

INSERT INTO diagnostic_templates (id, slug, title, form_path, sort_order)
VALUES
    (0, '43-professions', '43 Профессии', '/diagnostics/43-professions.html', 0),
    (1, '10-favorite-things-kid', '10 Любимых дел (Детский)', '/diagnostics/10-favorite-things-kid.html', 10),
    (2, '10-favorite-things', '10 Любимых дел (Взрослый)', '/diagnostics/10-favorite-things.html', 20),
    (3, 'perfect-job-kid', 'Идеальная работа (Детский)', '/diagnostics/perfect-job-kid.html', 30),
    (4, 'perfect-job', 'Идеальная работа (Взрослый)', '/diagnostics/perfect-job.html', 40),
    (5, 'my-needs-kid', 'Мои потребности (Детский)', '/diagnostics/my-needs-kid.html', 50),
    (6, 'my-needs', 'Мои потребности (Взрослый)', '/diagnostics/my-needs.html', 60),
    (7, 'antirating-professions-kid', 'Антирейтинг профессий (Детский)', '/diagnostics/antirating-of-professions-kid.html', 70),
    (8, 'antirating-professions', 'Антирейтинг профессий (Взрослый)', '/diagnostics/antirating-of-professions.html', 80),
    (9, 'interview-kid', 'Интервью (Детский)', '/diagnostics/interview-kid.html', 90),
    (10, 'interview', 'Интервью (Общий)', '/diagnostics/interview.html', 100),
    (11, '8-frames-kid', '8 Кадров (Детский)', '/diagnostics/8-frames-kid.html', 110),
    (12, '8-frames', '8 Кадров (Взрослый)', '/diagnostics/8-frames.html', 120),
    (13, 'exploring-values', 'Исследование ценностей', '/diagnostics/exploring-values.html', 130),
    (14, 'learning-motivation', 'Учебная мотивация', '/diagnostics/learning-motivation.html', 140),
    (15, 'viability', 'Жизнестойкость', '/diagnostics/viability.html', 150),
    (16, '10-questions', '10 вопросов', '/diagnostics/10-questions.html', 160),
    (17, 'im-at-work', 'Я на работе', '/diagnostics/im-at-work.html', 170)
ON CONFLICT (id) DO UPDATE SET
    slug = EXCLUDED.slug,
    title = EXCLUDED.title,
    form_path = EXCLUDED.form_path,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE;

