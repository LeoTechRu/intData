"""Structured logging utilities."""
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict
import contextvars

request_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("request_id", default=None)
owner_id_var: contextvars.ContextVar[str | None] = contextvars.ContextVar("owner_id", default=None)

PII_RE = re.compile(r"([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+|\+?\d[\d -]{7,}\d)")


class JsonFormatter(logging.Formatter):
    """Format log records as JSON and scrub PII."""

    def format(self, record: logging.LogRecord) -> str:  # noqa: D401
        data: Dict[str, Any] = {
            "ts": datetime.now(timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": PII_RE.sub("[scrubbed]", record.getMessage()),
        }
        req_id = request_id_var.get()
        if req_id:
            data["request_id"] = req_id
        owner_id = owner_id_var.get()
        if owner_id:
            data["owner_id"] = owner_id
        if hasattr(record, "extra") and isinstance(record.extra, dict):
            for k, v in record.extra.items():
                if isinstance(v, str):
                    v = PII_RE.sub("[scrubbed]", v)
                data[k] = v
        return json.dumps(data, ensure_ascii=False)


def setup_logging() -> None:
    """Configure root logger with JSON formatter."""
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    logging.basicConfig(level=logging.INFO, handlers=[handler])
