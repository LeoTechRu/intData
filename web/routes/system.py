"""System endpoints."""

import asyncio
import os
import subprocess
import time

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy import text

from core.db import engine
from core.metrics import metrics_response

router = APIRouter()


@router.get("/metrics")
async def metrics(request: Request):
    if os.getenv("METRICS_ENABLED", "0") != "1":
        raise HTTPException(status_code=404)
    data, content_type = metrics_response()
    return PlainTextResponse(data, media_type=content_type)


@router.get("/healthz")
async def healthz():
    sha_bytes = await asyncio.to_thread(
        subprocess.check_output, ["git", "rev-parse", "--short", "HEAD"]
    )
    sha = sha_bytes.decode().strip()
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
