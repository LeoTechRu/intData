from __future__ import annotations

import os
import secrets
from contextlib import asynccontextmanager, contextmanager
from pathlib import Path
from typing import AsyncIterator, Iterator, Tuple

import psycopg
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.engine import URL, Engine
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[2]
ENV_FILE = Path(os.getenv("ENV_FILE") or ROOT / ".env")
load_dotenv(ENV_FILE)


def _env(test_key: str, fallback_key: str, default: str | None = None) -> str | None:
    if test_key in os.environ:
        return os.environ[test_key]
    if fallback_key in os.environ:
        return os.environ[fallback_key]
    return default


def _normalize_port(value: str | None) -> int | None:
    if value in (None, ""):
        return None
    try:
        return int(value)
    except ValueError as exc:
        raise ValueError(f"invalid port value for test database: {value!r}") from exc


def _compose_database_url(async_mode: bool) -> str:
    raw_url = _env("TEST_DATABASE_URL", "DATABASE_URL")
    if raw_url:
        if raw_url.startswith("postgres://"):
            raw_url = raw_url.replace("postgres://", "postgresql://", 1)
        if async_mode:
            if "+asyncpg" not in raw_url and raw_url.startswith("postgresql://"):
                raw_url = raw_url.replace("postgresql://", "postgresql+asyncpg://", 1)
        else:
            if "+asyncpg" in raw_url:
                raw_url = raw_url.replace("+asyncpg", "+psycopg")
            elif "+" not in raw_url.split("://", 1)[0]:
                raw_url = raw_url.replace("postgresql://", "postgresql+psycopg://", 1)
        return raw_url

    user = _env("TEST_DB_USER", "DB_USER")
    password = _env("TEST_DB_PASSWORD", "DB_PASSWORD")
    host = _env("TEST_DB_HOST", "DB_HOST", "localhost")
    port = _env("TEST_DB_PORT", "DB_PORT", "5432")
    name = _env("TEST_DB_NAME", "DB_NAME")

    if not name:
        raise RuntimeError(
            "TEST_DB_NAME (или DB_NAME) не задан: укажите параметры тестовой БД в .env."
        )

    driver = "postgresql+asyncpg" if async_mode else "postgresql+psycopg"
    return str(
        URL.create(
            drivername=driver,
            username=user or None,
            password=password or None,
            host=host or None,
            port=_normalize_port(port),
            database=name,
        )
    )


def _apply_schema_to_url(url: str, schema: str) -> str:
    parts = urlsplit(url)
    query = dict(parse_qsl(parts.query, keep_blank_values=True))
    extra = f"-csearch_path={schema}"
    options = query.get("options")
    query["options"] = (f"{options} {extra}" if options else extra).strip()
    new_query = urlencode(query, doseq=True)
    return urlunsplit((parts.scheme, parts.netloc, parts.path, new_query, parts.fragment))


def build_async_url(schema: str) -> str:
    # asyncpg does not support libpq "options"; search_path applied via connect_args
    return _compose_database_url(async_mode=True)


def build_sync_url(schema: str | None = None) -> str:
    base_url = _compose_database_url(async_mode=False)
    if not schema:
        parts = urlsplit(base_url)
        return urlunsplit((parts.scheme, parts.netloc, parts.path, "", parts.fragment))
    return _apply_schema_to_url(base_url, schema)


@contextmanager
def temporary_schema(schema: str | None = None) -> Iterator[Tuple[str, str]]:
    schema_name = schema or f"test_{secrets.token_hex(4)}"
    sync_url = build_sync_url()
    psycopg_url = sync_url.replace("+psycopg", "")
    with psycopg.connect(psycopg_url) as conn:
        conn.execute(f'CREATE SCHEMA "{schema_name}"')
    try:
        yield schema_name, sync_url
    finally:
        with psycopg.connect(psycopg_url) as conn:
            conn.execute(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')


@asynccontextmanager
async def async_engine(schema: str | None = None) -> AsyncIterator[AsyncEngine]:
    with temporary_schema(schema) as (schema_name, _):
        engine = create_async_engine(
            build_async_url(schema_name),
            future=True,
            connect_args={"server_settings": {"search_path": schema_name}},
        )
        try:
            yield engine
        finally:
            await engine.dispose()


@contextmanager
def sync_engine(schema: str | None = None) -> Iterator[Engine]:
    with temporary_schema(schema) as (schema_name, _):
        engine = create_engine(build_sync_url(schema_name))
        try:
            yield engine
        finally:
            engine.dispose()
