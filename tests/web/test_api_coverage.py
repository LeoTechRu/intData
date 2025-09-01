from fastapi.testclient import TestClient
from web.__init__ import app


def test_openapi_tags_present():
    c = TestClient(app)
    r = c.get("/api/v1/openapi.json")
    r.raise_for_status()
    names = {t["name"] for t in r.json().get("tags", [])}
    expected = {
        "tasks",
        "calendar",
        "notes",
        "time",
        "areas",
        "projects",
        "resources",
        "inbox",
        "admin",
        "app-settings",
        "auth",
        "user",
    }
    missing = expected - names
    assert not missing, f"Missing tags in OpenAPI: {missing}"
