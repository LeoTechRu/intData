import json
import os
from pathlib import Path

from core.utils import utcnow

LOG_PATH = Path(os.getenv("AUTH_LOG_PATH", "/sd/intdata/var/auth.log"))


def log_event(request, event: str, user=None, extra: dict | None = None):
    LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    rec = {
        "ts": utcnow().isoformat() + "Z",
        "event": event,  # e.g. "login_ok", "login_fail", "tg_ok", "magic_ok"
        "ip": request.client.host if request and request.client else None,
        "ua": request.headers.get("user-agent") if request else None,
        "user_id": getattr(user, "id", None),
        "username": getattr(user, "username", None),
    }
    if extra:
        rec.update(extra)
    with LOG_PATH.open("a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
