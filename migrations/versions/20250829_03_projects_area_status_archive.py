"""PARA: projects area/status/slug/archive

Revision ID: 20250829_03
Revises: 20250829_02
Create Date: 2025-08-29
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '20250829_03'
down_revision = '20250829_02'
branch_labels = None
depends_on = None


def upgrade() -> None:
    status_enum = sa.Enum('active', 'paused', 'completed', name='project_status')
    status_enum.create(op.get_bind(), checkfirst=True)

    # Ensure column exists and set NOT NULL if possible
    try:
        op.alter_column('projects', 'area_id', existing_type=sa.Integer(), nullable=False)
    except Exception:
        pass

    op.add_column('projects', sa.Column('status', status_enum, nullable=True))
    op.add_column('projects', sa.Column('slug', sa.String(length=255), nullable=True))
    op.add_column('projects', sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True))

    # Indexes
    op.create_index('ix_projects_owner_area', 'projects', ['owner_id', 'area_id'], unique=False)
    op.create_index('ix_projects_owner_status', 'projects', ['owner_id', 'status'], unique=False)
    op.create_unique_constraint('uq_projects_owner_slug', 'projects', ['owner_id', 'slug'])


def downgrade() -> None:
    # drop constraints and indexes
    with op.batch_alter_table('projects'):
        try:
            op.drop_constraint('uq_projects_owner_slug', type_='unique')
        except Exception:
            pass
    op.drop_index('ix_projects_owner_status', table_name='projects')
    op.drop_index('ix_projects_owner_area', table_name='projects')
    op.drop_column('projects', 'archived_at')
    op.drop_column('projects', 'slug')
    op.drop_column('projects', 'status')
    # enum cleanup
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("DROP TYPE IF EXISTS project_status")
