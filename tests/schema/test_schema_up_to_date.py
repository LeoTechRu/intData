from pathlib import Path

from core.db.schema_export import check


def test_schema_up_to_date() -> None:
    root = Path(__file__).resolve().parents[2]
    assert check(root / "core" / "db"), (
        "Run python -m core.db.schema_export generate and commit /core/db/SCHEMA.*"
    )
