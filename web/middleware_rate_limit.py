"""Simple in-memory rate limiter."""

import time
from collections import defaultdict, deque
from typing import Callable, Deque

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limit: int, period: int, paths: tuple[str, ...]):
        super().__init__(app)
        self.limit = limit
        self.period = period
        self.paths = paths
        self.calls: dict[str, Deque[float]] = defaultdict(deque)

    async def dispatch(self, request: Request, call_next: Callable):
        if request.url.path not in self.paths:
            return await call_next(request)
        now = time.time()
        client_host = request.client.host if request.client else "unknown"
        dq = self.calls[client_host]
        while dq and now - dq[0] > self.period:
            dq.popleft()
        if len(dq) >= self.limit:
            return Response(status_code=429)
        dq.append(now)
        return await call_next(request)
