"""PARA: areas review/is_active/archive; resources archive

Revision ID: 20250829_04
Revises: 20250829_03
Create Date: 2025-08-29
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '20250829_04'
down_revision = '20250829_03'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('areas', sa.Column('review_interval_days', sa.Integer(), nullable=True))
    op.add_column('areas', sa.Column('is_active', sa.Boolean(), nullable=True))
    op.add_column('areas', sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True))

    op.add_column('resources', sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('resources', 'archived_at')
    op.drop_column('areas', 'archived_at')
    op.drop_column('areas', 'is_active')
    op.drop_column('areas', 'review_interval_days')

