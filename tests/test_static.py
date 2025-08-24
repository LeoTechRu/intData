from fastapi.testclient import TestClient

from web import app


client = TestClient(app)


def test_static_and_favicon_accessible():
    res = client.get("/static/css/style.css")
    assert res.status_code != 307
    res2 = client.get("/favicon.ico")
    assert res2.status_code != 307
