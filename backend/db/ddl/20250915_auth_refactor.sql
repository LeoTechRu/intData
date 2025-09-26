-- Auth & authorization refactor
-- Ensure permissions table uses canonical name
ALTER TABLE IF EXISTS perms RENAME TO auth_permissions;
ALTER SEQUENCE IF EXISTS perms_id_seq RENAME TO auth_permissions_id_seq;

-- Extend permissions catalog
ALTER TABLE auth_permissions ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE auth_permissions ADD COLUMN IF NOT EXISTS bit_position SMALLINT;
ALTER TABLE auth_permissions ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE auth_permissions ADD COLUMN IF NOT EXISTS mutable BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE auth_permissions SET code = lower(name) WHERE code IS NULL AND name IS NOT NULL;

WITH ordered AS (
    SELECT id, row_number() OVER (ORDER BY id) - 1 AS rn
    FROM auth_permissions
    WHERE bit_position IS NULL
)
UPDATE auth_permissions ap
SET bit_position = o.rn
FROM ordered o
WHERE ap.id = o.id;

ALTER TABLE auth_permissions
    ALTER COLUMN code SET NOT NULL,
    ALTER COLUMN bit_position SET NOT NULL;

ALTER TABLE auth_permissions
    ADD CONSTRAINT IF NOT EXISTS ck_auth_permissions_bit CHECK (bit_position BETWEEN 0 AND 62);

CREATE UNIQUE INDEX IF NOT EXISTS ux_auth_permissions_code ON auth_permissions(code);
CREATE UNIQUE INDEX IF NOT EXISTS ux_auth_permissions_bit ON auth_permissions(bit_position);

-- Extend roles metadata
ALTER TABLE roles ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS permissions_mask BIGINT NOT NULL DEFAULT 0;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_system BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS grants_all BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE roles SET slug = lower(name) WHERE slug IS NULL AND name IS NOT NULL;

ALTER TABLE roles ALTER COLUMN slug SET NOT NULL;
ALTER TABLE roles ADD CONSTRAINT IF NOT EXISTS uq_roles_slug UNIQUE (slug);

-- Extend user role assignments
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS scope_type TEXT;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS scope_id INTEGER;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS granted_by INTEGER;
ALTER TABLE user_roles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

UPDATE user_roles SET scope_type = 'global' WHERE scope_type IS NULL;

ALTER TABLE user_roles ALTER COLUMN scope_type SET NOT NULL;
ALTER TABLE user_roles ADD CONSTRAINT IF NOT EXISTS ck_user_roles_scope CHECK (scope_type IN ('global','area','project'));
ALTER TABLE user_roles ADD CONSTRAINT IF NOT EXISTS uq_user_roles_assignment UNIQUE (user_id, role_id, scope_type, scope_id);
ALTER TABLE user_roles ADD CONSTRAINT IF NOT EXISTS fk_user_roles_granted_by FOREIGN KEY(granted_by) REFERENCES users_web(id);

CREATE INDEX IF NOT EXISTS ix_user_roles_scope ON user_roles(scope_type, scope_id);
CREATE INDEX IF NOT EXISTS ix_user_roles_user ON user_roles(user_id);

-- Audit log for role changes
CREATE TABLE IF NOT EXISTS auth_audit_entries (
    id SERIAL PRIMARY KEY,
    actor_user_id INTEGER,
    target_user_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    role_slug TEXT,
    scope_type TEXT NOT NULL DEFAULT 'global',
    scope_id INTEGER,
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT fk_auth_audit_actor FOREIGN KEY(actor_user_id) REFERENCES users_web(id),
    CONSTRAINT fk_auth_audit_target FOREIGN KEY(target_user_id) REFERENCES users_web(id),
    CONSTRAINT ck_auth_audit_scope CHECK (scope_type IN ('global','area','project'))
);

CREATE INDEX IF NOT EXISTS ix_auth_audit_target ON auth_audit_entries(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_auth_audit_actor ON auth_audit_entries(actor_user_id, created_at DESC);

-- Seed canonical permissions (idempotent)
INSERT INTO auth_permissions (code, name, description, category, bit_position, mutable)
VALUES
    ('app.dashboard.view', 'Dashboard: view', 'Просмотр главного дашборда', 'core', 0, FALSE),
    ('app.calendar.manage', 'Calendar: manage', 'Управление календарём и напоминаниями', 'calendar', 1, FALSE),
    ('app.tasks.manage', 'Tasks: manage', 'Создание и редактирование задач', 'tasks', 2, FALSE),
    ('app.areas.manage', 'Areas: manage', 'Управление областями PARA', 'para', 3, FALSE),
    ('app.projects.manage', 'Projects: manage', 'Управление проектами', 'para', 4, FALSE),
    ('app.habits.manage', 'Habits: manage', 'Управление привычками и ежедневками', 'habits', 5, FALSE),
    ('app.groups.moderate', 'Groups: moderate', 'Модерация групп и CRM', 'community', 6, FALSE),
    ('app.integrations.manage', 'Integrations: manage', 'Настройка интеграций и вебхуков', 'platform', 7, FALSE),
    ('app.settings.manage', 'Settings: manage', 'Изменение глобальных настроек', 'platform', 8, FALSE),
    ('app.roles.manage', 'Roles: manage', 'Управление ролями и правами доступа', 'platform', 9, FALSE),
    ('app.users.invite', 'Users: invite', 'Приглашение и управление участниками', 'platform', 10, FALSE),
    ('app.reports.view', 'Reports: view', 'Просмотр аналитики и отчётов', 'analytics', 11, FALSE),
    ('app.billing.manage', 'Billing: manage', 'Управление платежами и подписками', 'platform', 12, FALSE),
    ('app.data.export', 'Data: export', 'Экспорт и бэкапы данных', 'platform', 13, FALSE)
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    category = EXCLUDED.category,
    bit_position = EXCLUDED.bit_position,
    mutable = EXCLUDED.mutable;

-- Seed default roles with presets
INSERT INTO roles (slug, name, description, level, permissions_mask, is_system, grants_all)
VALUES
    ('suspended', 'Suspended', 'Доступ запрещён', 0, 0, TRUE, FALSE),
    ('single', 'Single', 'Личный доступ к данным пользователя', 10, (1<<0) + (1<<1) + (1<<2) + (1<<5), TRUE, FALSE),
    ('multiplayer', 'Multiplayer', 'Участник рабочей области', 20, (1<<0) + (1<<1) + (1<<2) + (1<<3) + (1<<4) + (1<<5) + (1<<6) + (1<<10) + (1<<11), TRUE, FALSE),
    ('moderator', 'Moderator', 'Куратор/модератор и владелец интеграций', 30, (1<<0) + (1<<1) + (1<<2) + (1<<3) + (1<<4) + (1<<5) + (1<<6) + (1<<7) + (1<<8) + (1<<10) + (1<<11) + (1<<13), TRUE, FALSE),
    ('admin', 'Admin', 'Полный административный доступ', 40, 0, TRUE, TRUE)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    level = EXCLUDED.level,
    permissions_mask = EXCLUDED.permissions_mask,
    is_system = EXCLUDED.is_system,
    grants_all = EXCLUDED.grants_all;

-- Align legacy role strings
UPDATE users_web SET role = 'suspended' WHERE role IN ('ban', 'suspended');
UPDATE users_tg SET role = 'suspended' WHERE role IN ('ban', 'suspended');
UPDATE users_web SET role = lower(role);
UPDATE users_tg SET role = lower(role);

-- Ensure admin users retain direct assignment
INSERT INTO user_roles (user_id, role_id, scope_type, scope_id, granted_by)
SELECT id, (SELECT r.id FROM roles r WHERE r.slug = 'admin'), 'global', NULL, id
FROM users_web
WHERE role = 'admin'
ON CONFLICT (user_id, role_id, scope_type, scope_id) DO NOTHING;
