"""add PARA invariants & overrides"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa

revision = "20250910_01"
down_revision = "20250901_01_user_favorites"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # projects.area_id NOT NULL + index
    try:
        op.alter_column("projects", "area_id", existing_type=sa.Integer(), nullable=False)
    except Exception:
        pass
    try:
        op.create_index("ix_projects_area_id", "projects", ["area_id"], unique=False)
    except Exception:
        pass

    # tasks: check constraint and trigger for area inheritance
    try:
        op.create_check_constraint(
            "ck_tasks_project_or_area",
            "tasks",
            "(project_id IS NOT NULL OR area_id IS NOT NULL)",
        )
    except Exception:
        pass
    op.execute(
        """
        CREATE OR REPLACE FUNCTION tasks_inherit_area() RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.project_id IS NOT NULL THEN
                SELECT area_id INTO NEW.area_id FROM projects WHERE id = NEW.project_id;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER trg_tasks_inherit_area
        BEFORE INSERT OR UPDATE ON tasks
        FOR EACH ROW EXECUTE FUNCTION tasks_inherit_area();
        """
    )

    # resources: project_id/area_id + constraints
    try:
        op.add_column("resources", sa.Column("project_id", sa.Integer(), nullable=True))
    except Exception:
        pass
    try:
        op.add_column("resources", sa.Column("area_id", sa.Integer(), nullable=True))
    except Exception:
        pass
    try:
        op.create_index("ix_resources_project", "resources", ["project_id"], unique=False)
    except Exception:
        pass
    try:
        op.create_index("ix_resources_area", "resources", ["area_id"], unique=False)
    except Exception:
        pass
    try:
        op.create_check_constraint(
            "ck_resources_project_or_area",
            "resources",
            "(project_id IS NOT NULL OR area_id IS NOT NULL)",
        )
    except Exception:
        pass
    op.execute(
        """
        CREATE OR REPLACE FUNCTION resources_inherit_area() RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.project_id IS NOT NULL THEN
                SELECT area_id INTO NEW.area_id FROM projects WHERE id = NEW.project_id;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        CREATE TRIGGER trg_resources_inherit_area
        BEFORE INSERT OR UPDATE ON resources
        FOR EACH ROW EXECUTE FUNCTION resources_inherit_area();
        """
    )

    # time_entries: unique active timer per user
    try:
        op.create_unique_constraint(
            "uq_time_entries_active_timer",
            "time_entries",
            ["owner_id"],
            postgresql_where=sa.text("end_time IS NULL"),
        )
    except Exception:
        pass

    # para_overrides table
    op.create_table(
        "para_overrides",
        sa.Column("id", sa.String(length=36), primary_key=True),
        sa.Column("owner_user_id", sa.Integer(), nullable=False),
        sa.Column("entity_type", sa.String(), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("override_project_id", sa.Integer(), nullable=True),
        sa.Column("override_area_id", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.UniqueConstraint(
            "owner_user_id", "entity_type", "entity_id", name="uq_para_override_owner_entity"
        ),
        sa.CheckConstraint(
            "(override_project_id IS NOT NULL OR override_area_id IS NOT NULL)",
            name="ck_para_override_not_null",
        ),
        sa.CheckConstraint(
            "NOT (override_project_id IS NOT NULL AND override_area_id IS NOT NULL)",
            name="ck_para_override_mutual_excl",
        ),
    )
    try:
        op.create_index(
            "ix_para_overrides_owner_entity",
            "para_overrides",
            ["owner_user_id", "entity_type"],
            unique=False,
        )
    except Exception:
        pass


def downgrade() -> None:
    op.drop_table("para_overrides")
    try:
        op.drop_constraint("uq_time_entries_active_timer", "time_entries", type_="unique")
    except Exception:
        pass
    op.execute("DROP TRIGGER IF EXISTS trg_resources_inherit_area ON resources")
    op.execute("DROP FUNCTION IF EXISTS resources_inherit_area")
    op.execute("DROP TRIGGER IF EXISTS trg_tasks_inherit_area ON tasks")
    op.execute("DROP FUNCTION IF EXISTS tasks_inherit_area")
    for name in ["ck_resources_project_or_area", "ck_tasks_project_or_area"]:
        try:
            op.drop_constraint(name, table_name="tasks" if "tasks" in name else "resources")
        except Exception:
            pass
    for name, table in [
        ("ix_resources_project", "resources"),
        ("ix_resources_area", "resources"),
        ("ix_projects_area_id", "projects"),
    ]:
        try:
            op.drop_index(name, table_name=table)
        except Exception:
            pass
    for col, table in [
        ("project_id", "resources"),
        ("area_id", "resources"),
    ]:
        try:
            op.drop_column(table, col)
        except Exception:
            pass
    try:
        op.alter_column("projects", "area_id", existing_type=sa.Integer(), nullable=True)
    except Exception:
        pass
