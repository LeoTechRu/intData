"""projects require leaf area (backfill)

Revision ID: 20250830_02
Revises: 20250830_01
Create Date: 2025-08-30
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '20250830_02'
down_revision = '20250830_01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    conn = bind
    # find owners with projects missing area_id
    rows = list(conn.execute(sa.text('SELECT id, owner_id FROM projects WHERE area_id IS NULL')))
    if rows:
        # build map owner->area_id for default
        owners = {}
        for pid, owner_id in rows:
            owners.setdefault(owner_id, None)
        # create default area per owner
        for owner_id in owners.keys():
            # ensure unique slug
            slug = 'default-area'
            # slug uniqueness by owner
            # find taken slugs for owner
            taken = set(x[0] for x in conn.execute(sa.text('SELECT slug FROM areas WHERE owner_id = :o'), {'o': owner_id}))
            base = slug
            n = 2
            while slug in taken:
                slug = f"{base}-{n}"
                n += 1
            name = 'Default Area'
            mp_path = slug + '.'
            r = conn.execute(sa.text('INSERT INTO areas (owner_id, name, slug, mp_path, depth, is_active) VALUES (:o, :n, :s, :m, :d, :ia) RETURNING id'),
                              {'o': owner_id, 'n': name, 's': slug, 'm': mp_path, 'd': 0, 'ia': True})
            new_id = r.scalar_one()
            owners[owner_id] = new_id
        # update projects
        for pid, owner_id in rows:
            area_id = owners.get(owner_id)
            if area_id:
                conn.execute(sa.text('UPDATE projects SET area_id=:a WHERE id=:p'), {'a': area_id, 'p': pid})
    # set NOT NULL if possible
    try:
        op.alter_column('projects', 'area_id', existing_type=sa.Integer(), nullable=False)
    except Exception:
        pass


def downgrade() -> None:
    # cannot reliably undo default areas without additional metadata; skip
    pass
