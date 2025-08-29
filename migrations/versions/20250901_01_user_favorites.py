"""create users_favorites table

Revision ID: 20250901_01
Revises: 20250831_01
Create Date: 2025-09-01
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '20250901_01'
down_revision = '20250831_01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'users_favorites',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('owner_id', sa.Integer, sa.ForeignKey('users_web.id'), nullable=False),
        sa.Column('label', sa.String(40)),
        sa.Column('path', sa.String(128), nullable=False),
        sa.Column('position', sa.Integer, nullable=False, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('owner_id', 'path'),
    )
    op.create_index('ix_users_favorites_owner_position', 'users_favorites', ['owner_id', 'position'])


def downgrade() -> None:
    op.drop_index('ix_users_favorites_owner_position', table_name='users_favorites')
    op.drop_table('users_favorites')
