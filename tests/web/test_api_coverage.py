from fastapi.testclient import TestClient
from web.__init__ import app


def test_openapi_tags_present():
    c = TestClient(app)
    r = c.get("/backend/api/openapi.json")
    r.raise_for_status()
    names = {t["name"] for t in r.json().get("tags", [])}
    expected = {
        "Tasks & Projects",
        "Control Hub",
        "Users",
        "Habits",
        "Team Hub",
        "admin",
        "app-settings",
        "crm",
        "cup",
        "diagnostics",
        "docs",
        "integrations",
        "navigation",
        "pricing",
        "products",
        "profiles",
    }
    missing = expected - names
    assert not missing, f"Missing tags in OpenAPI: {missing}"
