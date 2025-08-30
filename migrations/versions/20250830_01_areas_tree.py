"""areas tree with materialized path

Revision ID: 20250830_01
Revises: 20250829_06
Create Date: 2025-08-30
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '20250830_01'
down_revision = '20250829_06'
branch_labels = None
depends_on = None


def _slugify(name: str) -> str:
    import re
    s = (name or '').lower()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s).strip("-")
    return s or "area"


def upgrade() -> None:
    bind = op.get_bind()
    op.add_column('areas', sa.Column('parent_id', sa.Integer(), nullable=True))
    op.add_column('areas', sa.Column('mp_path', sa.Text(), nullable=False, server_default=''))
    op.add_column('areas', sa.Column('depth', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('areas', sa.Column('slug', sa.Text(), nullable=False, server_default=''))
    op.create_foreign_key('fk_areas_parent', 'areas', 'areas', ['parent_id'], ['id'], ondelete='SET NULL')
    op.create_unique_constraint('uq_areas_owner_slug', 'areas', ['owner_id', 'slug'])
    if bind.dialect.name == 'postgresql':
        op.execute('CREATE INDEX IF NOT EXISTS areas_mp_path_like ON areas (mp_path text_pattern_ops)')

    conn = bind
    areas = list(conn.execute(sa.text('SELECT id, owner_id, name FROM areas')))
    taken = {}
    for (id_, owner_id, name) in areas:
        key = int(owner_id) if owner_id is not None else 0
        taken.setdefault(key, set())
    updates = []
    for (id_, owner_id, name) in areas:
        base = _slugify(name or f"area-{id_}")
        key = int(owner_id) if owner_id is not None else 0
        slug = base
        n = 2
        while slug in taken[key]:
            slug = f"{base}-{n}"
            n += 1
        taken[key].add(slug)
        mp_path = slug + '.'
        updates.append((slug, mp_path, 0, None, id_))

    if updates:
        conn.execute(sa.text('UPDATE areas SET slug=:slug, mp_path=:mp, depth=:d, parent_id=:p WHERE id=:id'),
                     [dict(slug=s, mp=m, d=d, p=p, id=i) for (s, m, d, p, i) in updates])

    with op.batch_alter_table('areas') as b:
        b.alter_column('mp_path', server_default=None)
        b.alter_column('depth', server_default=None)
        b.alter_column('slug', server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute('DROP INDEX IF EXISTS areas_mp_path_like')
    with op.batch_alter_table('areas') as b:
        b.drop_constraint('uq_areas_owner_slug', type_='unique')
    op.drop_constraint('fk_areas_parent', 'areas', type_='foreignkey')
    op.drop_column('areas', 'slug')
    op.drop_column('areas', 'depth')
    op.drop_column('areas', 'mp_path')
    op.drop_column('areas', 'parent_id')
