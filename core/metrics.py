"""Prometheus metrics helpers."""
from prometheus_client import Counter, Histogram, generate_latest, CONTENT_TYPE_LATEST

REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "route", "status"],
)
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency",
    ["method", "route"],
)


def metrics_response() -> tuple[bytes, str]:
    """Return metrics for exposure."""
    return generate_latest(), CONTENT_TYPE_LATEST
