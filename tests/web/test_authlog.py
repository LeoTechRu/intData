import json
from datetime import datetime
from importlib import reload
from types import SimpleNamespace

from core.utils import utcnow


def test_authlog_uses_utcnow(tmp_path, monkeypatch):
    log_file = tmp_path / "auth.log"
    monkeypatch.setenv("AUTH_LOG_PATH", str(log_file))

    import web.security.authlog as authlog

    reload(authlog)

    request = SimpleNamespace(
        client=SimpleNamespace(host="127.0.0.1"), headers={}
    )
    user = SimpleNamespace(id=1, username="alice")
    authlog.log_event(request, "test", user=user)

    data = json.loads(log_file.read_text().strip())

    assert data["event"] == "test"
    assert data["ts"].endswith("Z")

    ts = datetime.fromisoformat(data["ts"].rstrip("Z"))
    assert ts.tzinfo is None
    assert abs((utcnow() - ts).total_seconds()) < 5
