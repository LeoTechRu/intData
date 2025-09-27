from pathlib import Path

from backend.db.schema_export import check


def test_schema_up_to_date() -> None:
    root = Path(__file__).resolve().parents[2]
    schema_dir = root / "apps" / "backend" / "db"
    assert check(schema_dir), (
        "Run python -m backend.db.schema_export generate and commit apps/backend/db/SCHEMA.*"
    )
