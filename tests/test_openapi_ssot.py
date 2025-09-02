import json
from fastapi.testclient import TestClient
from web import app


def test_openapi_ssot():
    c = TestClient(app)
    r = c.get("/api/openapi.json")
    assert r.status_code == 200
    data = r.json()
    names = {t["name"] for t in data.get("tags", [])}
    for tag in ["Habits", "Dailies", "Rewards", "Stats", "Calendar"]:
        assert tag in names
    with open("api/openapi.json", "r", encoding="utf-8") as f:
        file_data = json.load(f)
    assert file_data == data
