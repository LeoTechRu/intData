"""add calendar and notification tables

Revision ID: 20250902_01
Revises: 20250901_01
Create Date: 2025-09-02
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = '20250902_01'
down_revision = '20250901_01'
branch_labels = None
depends_on = None

def upgrade() -> None:
    calendar_status = sa.Enum('planned', 'done', 'cancelled', name='calendaritemstatus')
    channel_kind = sa.Enum('telegram', 'email', name='notificationchannelkind')

    op.create_table(
        'calendar_items',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('owner_id', sa.BigInteger, sa.ForeignKey('users_tg.telegram_id')),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('start_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_at', sa.DateTime(timezone=True)),
        sa.Column('project_id', sa.Integer, sa.ForeignKey('projects.id')),
        sa.Column('area_id', sa.Integer, sa.ForeignKey('areas.id')),
        sa.Column('status', calendar_status, nullable=False, server_default='planned'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'alarms',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('item_id', sa.Integer, sa.ForeignKey('calendar_items.id'), nullable=False),
        sa.Column('trigger_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_sent', sa.Boolean, nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'notification_channels',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('owner_id', sa.BigInteger, sa.ForeignKey('users_tg.telegram_id')),
        sa.Column('kind', channel_kind, nullable=False),
        sa.Column('address', sa.JSON, nullable=False),
        sa.Column('is_active', sa.Boolean, nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'project_notifications',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('project_id', sa.Integer, sa.ForeignKey('projects.id'), nullable=False),
        sa.Column('channel_id', sa.Integer, sa.ForeignKey('notification_channels.id'), nullable=False),
        sa.Column('rules', sa.JSON, nullable=False, server_default=sa.text("'{}'::json")),
        sa.Column('is_enabled', sa.Boolean, nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'notification_triggers',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('next_fire_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('alarm_id', sa.Integer, sa.ForeignKey('alarms.id')),
        sa.Column('rule', sa.JSON),
        sa.Column('dedupe_key', sa.String(255), nullable=False, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('dedupe_key', sa.String(255), nullable=False, unique=True),
        sa.Column('sent_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )

    op.create_table(
        'gcal_links',
        sa.Column('id', sa.Integer, primary_key=True, autoincrement=True),
        sa.Column('owner_id', sa.BigInteger, sa.ForeignKey('users_tg.telegram_id')),
        sa.Column('calendar_id', sa.String(255), nullable=False),
        sa.Column('access_token', sa.String(255)),
        sa.Column('refresh_token', sa.String(255)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table('gcal_links')
    op.drop_table('notifications')
    op.drop_table('notification_triggers')
    op.drop_table('project_notifications')
    op.drop_table('notification_channels')
    op.drop_table('alarms')
    op.drop_table('calendar_items')
    op.execute('DROP TYPE notificationchannelkind')
    op.execute('DROP TYPE calendaritemstatus')
