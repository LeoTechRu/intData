import json
from pathlib import Path
from fastapi import FastAPI


def export_openapi(app: FastAPI, out_path: str = "api/openapi.json") -> str:
    """Write app.openapi() to out_path with sorted keys."""
    data = app.openapi()
    text = json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True)
    p = Path(out_path)
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    return text


if __name__ == "__main__":
    from web import app

    export_openapi(app)
