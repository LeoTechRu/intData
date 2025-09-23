"""System endpoints."""

import asyncio
import base64
import logging
import os
import shutil
import subprocess
import time
from functools import lru_cache

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import text

from core.db import engine
from core.metrics import metrics_response

logger = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def _git_bin() -> str:
    path = shutil.which("git")
    if path is None:
        raise RuntimeError("git executable not found")
    return path


def _resolve_git_sha() -> str:
    timeout = int(os.getenv("GIT_SHA_TIMEOUT", "5"))
    try:
        sha_bytes = subprocess.check_output(
            [_git_bin(), "rev-parse", "--short", "HEAD"],
            timeout=timeout,
        )
        return sha_bytes.decode().strip()
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired, OSError) as exc:
        logger.warning("Failed to resolve git SHA: %s", exc)
        return "unknown"

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
    sha = await asyncio.to_thread(_resolve_git_sha)
    return {"ok": True, "version": sha}


@router.get("/readyz")
async def readyz():
    start = time.perf_counter()
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as err:
        raise HTTPException(status_code=503) from err
    duration = time.perf_counter() - start
    return {"ok": True, "db": {"seconds": duration}}
