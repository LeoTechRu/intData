"""Request/response logging middleware."""
import logging
import time
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from core.logging import request_id_var, setup_logging
from core.metrics import REQUEST_COUNT, REQUEST_LATENCY

setup_logging()

logger = logging.getLogger("web")


class LoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable):
        start = time.perf_counter()
        request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request_id_var.set(request_id)
        response: Response | None = None
        try:
            response = await call_next(request)
            return response
        finally:
            duration = (time.perf_counter() - start) * 1000
            route = request.url.path
            status = response.status_code if response else 500
            REQUEST_COUNT.labels(request.method, route, status).inc()
            REQUEST_LATENCY.labels(request.method, route).observe(duration / 1000)
            request.state.request_id = request_id
            log_extra = {
                "extra": {
                    "path": route,
                    "method": request.method,
                    "status": status,
                    "duration_ms": round(duration, 2),
                }
            }
            logger.info("request", **log_extra)
            response.headers["X-Request-ID"] = request_id
