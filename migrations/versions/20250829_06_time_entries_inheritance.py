"""PARA: time entries inheritance and categorization

Revision ID: 20250829_06
Revises: 20250829_05
Create Date: 2025-08-29
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '20250829_06'
down_revision = '20250829_05'
branch_labels = None
depends_on = None


def upgrade() -> None:
    activity_enum = sa.Enum('work', 'learning', 'admin', 'rest', 'break', name='activity_type')
    activity_enum.create(op.get_bind(), checkfirst=True)
    source_enum = sa.Enum('timer', 'manual', 'import', name='time_source')
    source_enum.create(op.get_bind(), checkfirst=True)

    op.add_column('time_entries', sa.Column('project_id', sa.Integer(), nullable=True))
    op.add_column('time_entries', sa.Column('area_id', sa.Integer(), nullable=True))
    op.add_column('time_entries', sa.Column('activity_type', activity_enum, nullable=True))
    op.add_column('time_entries', sa.Column('billable', sa.Boolean(), nullable=True))
    op.add_column('time_entries', sa.Column('source', source_enum, nullable=True))

    # indexes – column names follow existing schema names
    try:
        op.create_index('ix_time_user_started', 'time_entries', ['owner_id', 'start_time'], unique=False)
    except Exception:
        pass
    op.create_index('ix_time_user_area_started', 'time_entries', ['owner_id', 'area_id', 'start_time'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_time_user_area_started', table_name='time_entries')
    try:
        op.drop_index('ix_time_user_started', table_name='time_entries')
    except Exception:
        pass
    op.drop_column('time_entries', 'source')
    op.drop_column('time_entries', 'billable')
    op.drop_column('time_entries', 'activity_type')
    op.drop_column('time_entries', 'area_id')
    op.drop_column('time_entries', 'project_id')
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("DROP TYPE IF EXISTS activity_type")
        op.execute("DROP TYPE IF EXISTS time_source")

