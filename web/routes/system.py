"""System endpoints."""
import os
import subprocess
import time
import base64
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse

from core.metrics import metrics_response
from core.db import engine

router = APIRouter()


def _check_basic_auth(request: Request) -> None:
    user = os.getenv("METRICS_BASIC_AUTH_USER")
    if not user:
        return
    auth = request.headers.get("Authorization")
    expected = os.getenv("METRICS_BASIC_AUTH_PASS", "")
    token = base64.b64encode(f"{user}:{expected}".encode()).decode()
    if not auth or auth != f"Basic {token}":
        raise HTTPException(status_code=401)


@router.get("/metrics")
async def metrics(request: Request):
    if os.getenv("METRICS_ENABLED", "0") != "1":
        raise HTTPException(status_code=404)
    _check_basic_auth(request)
    data, content_type = metrics_response()
    return PlainTextResponse(data, media_type=content_type)


@router.get("/healthz")
async def healthz():
    sha = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"]).decode().strip()
    return {"ok": True, "version": sha}


@router.get("/readyz")
async def readyz():
    start = time.perf_counter()
    try:
        async with engine.connect() as conn:
            await conn.execute("SELECT 1")
    except Exception:
        raise HTTPException(status_code=503)
    duration = time.perf_counter() - start
    return {"ok": True, "db": {"seconds": duration}}
