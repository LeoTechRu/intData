"""OpenAPI snapshot parity tests."""
import json
from pathlib import Path

from web import app


def test_openapi_ssot():
    """Runtime OpenAPI spec must match stored snapshot."""
    runtime_spec = app.openapi()
    snapshot = json.loads(Path("api/openapi.json").read_text(encoding="utf-8"))

    runtime_tags = {t["name"] for t in runtime_spec.get("tags", [])}
    for tag in ["Habits", "Dailies", "Rewards", "Stats", "Calendar"]:
        assert tag in runtime_tags

    assert runtime_spec == snapshot
