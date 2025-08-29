"""link time_entries to tasks via task_id

Revision ID: 20250829_01
Revises: 
Create Date: 2025-08-29
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250829_01'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('time_entries', sa.Column('task_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_time_entries_task', 'time_entries', 'tasks', ['task_id'], ['id'],
        ondelete=None,
    )
    op.create_index(
        'ix_time_entries_task_id', 'time_entries', ['task_id'], unique=False
    )


def downgrade() -> None:
    op.drop_index('ix_time_entries_task_id', table_name='time_entries')
    op.drop_constraint('fk_time_entries_task', 'time_entries', type_='foreignkey')
    op.drop_column('time_entries', 'task_id')

