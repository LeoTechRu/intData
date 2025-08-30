"""PARA: notes fields and indexes

Revision ID: 20250829_02
Revises: 20250829_01
Create Date: 2025-08-29
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '20250829_02'
down_revision = '20250829_01'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # enums
    container_enum = sa.Enum('project', 'area', 'resource', name='container_type')
    container_enum.create(op.get_bind(), checkfirst=True)

    # columns
    op.add_column('notes', sa.Column('title', sa.String(length=255), nullable=True))
    try:
        op.alter_column('notes', 'content', type_=sa.Text())
    except Exception:
        # SQLite or other dialects may fail; ignore type change
        pass
    op.add_column('notes', sa.Column('container_type', container_enum, nullable=True))
    op.add_column('notes', sa.Column('container_id', sa.Integer(), nullable=True))
    op.add_column('notes', sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True))

    # indexes
    op.create_index('ix_notes_owner_container', 'notes', ['owner_id', 'container_type', 'container_id'], unique=False)
    op.create_index('ix_notes_owner_archived', 'notes', ['owner_id', 'archived_at'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_notes_owner_archived', table_name='notes')
    op.drop_index('ix_notes_owner_container', table_name='notes')
    op.drop_column('notes', 'archived_at')
    op.drop_column('notes', 'container_id')
    op.drop_column('notes', 'container_type')
    op.drop_column('notes', 'title')
    try:
        op.alter_column('notes', 'content', type_=sa.String(length=1000))
    except Exception:
        pass
    # drop enum type if exists
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("DROP TYPE IF EXISTS container_type")

