from __future__ import annotations

import base64
import hashlib
import re
from collections.abc import Iterable

from ..config import S

_SCRIPT_TAG_RE = re.compile(
    r"<script(?P<attrs>[^>]*)>(?P<body>.*?)</script>",
    re.IGNORECASE | re.DOTALL,
)
_TYPE_ATTR_RE = re.compile(
    r"type\s*=\s*(?P<quote>['\"])(?P<value>[^'\"]+)(?P=quote)",
    re.IGNORECASE,
)
_JSON_TYPES = {"application/json", "application/ld+json"}


def extract_inline_script_hashes(html: str) -> tuple[str, ...]:
    """Return base64-encoded SHA256 hashes for inline executable scripts."""
    seen: set[str] = set()
    hashes: list[str] = []
    for match in _SCRIPT_TAG_RE.finditer(html):
        attrs = match.group("attrs") or ""
        body = (match.group("body") or "").strip()
        if not body:
            continue
        attrs_lower = attrs.lower()
        if "src=" in attrs_lower or "nomodule" in attrs_lower:
            continue
        type_match = _TYPE_ATTR_RE.search(attrs)
        if type_match:
            script_type = type_match.group("value").strip().lower()
            if script_type in _JSON_TYPES:
                continue
        digest = hashlib.sha256(body.encode("utf-8")).digest()
        token = base64.b64encode(digest).decode("ascii")
        if token not in seen:
            seen.add(token)
            hashes.append(token)
    return tuple(hashes)


def _normalize_script_source(token: str) -> str:
    stripped = token.strip()
    if not stripped:
        return ""
    stripped = stripped.strip("'")
    if stripped.startswith("sha256-"):
        return f"'sha256-{stripped.split('sha256-', 1)[1]}'"
    return f"'sha256-{stripped}'"


def build_csp(script_hashes: Iterable[str] = ()) -> str:
    """Construct the default CSP string with optional inline script hashes."""
    script_src = ["'self'"]
    frame_src = ["'self'"]
    connect_src = ["'self'"]

    if S.TG_LOGIN_ENABLED:
        script_src.append("https://telegram.org")
        frame_src.append("https://oauth.telegram.org")
        connect_src.append("https://oauth.telegram.org")

    for token in script_hashes:
        normalized = _normalize_script_source(token)
        if normalized and normalized not in script_src:
            script_src.append(normalized)

    return (
        "default-src 'self'; "
        "img-src 'self' data:; "
        "style-src 'self' 'unsafe-inline'; "
        f"script-src {' '.join(script_src)}; "
        f"frame-src {' '.join(frame_src)}; "
        f"connect-src {' '.join(connect_src)}"
    )
