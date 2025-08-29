"""PARA: tasks project/area/estimate and indexes

Revision ID: 20250829_05
Revises: 20250829_04
Create Date: 2025-08-29
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '20250829_05'
down_revision = '20250829_04'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tasks', sa.Column('project_id', sa.Integer(), nullable=True))
    op.add_column('tasks', sa.Column('area_id', sa.Integer(), nullable=True))
    op.add_column('tasks', sa.Column('estimate_minutes', sa.Integer(), nullable=True))
    op.create_index('ix_tasks_owner_project', 'tasks', ['owner_id', 'project_id'], unique=False)
    op.create_index('ix_tasks_owner_area', 'tasks', ['owner_id', 'area_id'], unique=False)
    # legacy due_date column name in models is 'due_date'; create additional index if present
    try:
        op.create_index('ix_tasks_status_due', 'tasks', ['status', 'due_date'], unique=False)
    except Exception:
        pass


def downgrade() -> None:
    try:
        op.drop_index('ix_tasks_status_due', table_name='tasks')
    except Exception:
        pass
    op.drop_index('ix_tasks_owner_area', table_name='tasks')
    op.drop_index('ix_tasks_owner_project', table_name='tasks')
    op.drop_column('tasks', 'estimate_minutes')
    op.drop_column('tasks', 'area_id')
    op.drop_column('tasks', 'project_id')

