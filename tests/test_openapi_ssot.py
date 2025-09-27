"""OpenAPI snapshot parity tests."""
import json
from pathlib import Path

from web import app


def test_openapi_ssot():
    """Runtime OpenAPI spec must match stored snapshot."""
    runtime_spec = app.openapi()
    root = Path(__file__).resolve().parents[1]
    snapshot_path = root / "apps" / "backend" / "api" / "openapi.json"
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))

    runtime_tags = {t["name"] for t in runtime_spec.get("tags", [])}
    for tag in ["Tasks & Projects", "Control Hub", "Habits", "Users", "Team Hub"]:
        assert tag in runtime_tags

    assert runtime_spec == snapshot
