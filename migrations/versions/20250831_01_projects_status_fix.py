"""Ensure projects.status column exists

Revision ID: 20250831_01
Revises: 20250830_03
Create Date: 2025-08-31
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = '20250831_01'
down_revision = '20250830_03'
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    cols = [c["name"] for c in inspector.get_columns("projects")]
    status_enum = sa.Enum("active", "paused", "completed", name="project_status")
    status_enum.create(bind, checkfirst=True)
    if "status" not in cols:
        op.add_column(
            "projects",
            sa.Column(
                "status",
                status_enum,
                server_default="active",
                nullable=False,
            ),
        )
    else:
        op.alter_column(
            "projects",
            "status",
            existing_type=status_enum,
            server_default="active",
            existing_nullable=True,
            nullable=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("projects") as batch_op:
        try:
            batch_op.drop_column("status")
        except Exception:
            pass
    op.execute("DROP TYPE IF EXISTS project_status")
