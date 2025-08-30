"""tasks/time inheritance indexes (ensure)

Revision ID: 20250830_03
Revises: 20250830_02
Create Date: 2025-08-30
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '20250830_03'
down_revision = '20250830_02'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    # Ensure indexes exist; ignore if already created
    try:
        op.create_index('ix_tasks_owner_project', 'tasks', ['owner_id', 'project_id'], unique=False)
    except Exception:
        pass
    try:
        op.create_index('ix_tasks_owner_area', 'tasks', ['owner_id', 'area_id'], unique=False)
    except Exception:
        pass
    try:
        op.create_index('ix_time_user_started', 'time_entries', ['owner_id', 'start_time'], unique=False)
    except Exception:
        pass
    try:
        op.create_index('ix_time_user_area_started', 'time_entries', ['owner_id', 'area_id', 'start_time'], unique=False)
    except Exception:
        pass


def downgrade() -> None:
    # No-op: indexes may be shared with previous migrations
    pass
