"""Compatibility helpers migrated from the legacy NexusCore Balance project.

The original Flask application exposed a ``DBConfig`` object along with
utility helpers to validate environment variables and open a raw psycopg2
connection.  Intelligent Data Pro now provides an async SQLAlchemy stack,
so the functionality is adapted to fit the current architecture while
preserving the public API.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Dict

from dotenv import load_dotenv
import psycopg

load_dotenv()

REQUIRED_ENV_VARS = ("DB_USER", "DB_PASSWORD", "DB_HOST", "DB_NAME")


def _build_database_url() -> str:
    """Construct a PostgreSQL DSN from environment variables.

    ``DATABASE_URL`` takes precedence to support modern deployments.  When it
    is absent we fall back to the discrete credentials that were used in the
    legacy NexusCore project.  ``EnvironmentError`` is raised when required
    values are missing – allowing callers to surface a clear setup issue.
    """

    url = os.getenv("DATABASE_URL")
    if url:
        return url

    missing = [name for name in REQUIRED_ENV_VARS if not os.getenv(name)]
    if missing:
        raise EnvironmentError(
            "Missing required database environment variables: " + ", ".join(missing)
        )

    user = os.getenv("DB_USER", "")
    password = os.getenv("DB_PASSWORD", "")
    host = os.getenv("DB_HOST", "localhost")
    port = os.getenv("DB_PORT", "5432")
    name = os.getenv("DB_NAME", "")
    return f"postgresql://{user}:{password}@{host}:{port}/{name}"


def validate_config() -> str:
    """Validate database configuration returning the resulting DSN.

    The return value mirrors the legacy behaviour where callers expected a
    connection string.  The function raises ``EnvironmentError`` when the
    configuration is incomplete.
    """

    return _build_database_url()


def get_raw_connection(dsn: str | None = None) -> psycopg.Connection:
    """Open a psycopg connection using NexusCore-compatible semantics."""

    return psycopg.connect(dsn or _build_database_url())


@dataclass(slots=True)
class DBConfig:
    """Container for database-related parameters maintained for parity."""

    database_uri: str
    track_modifications: bool
    port: int
    project_path: Path
    schema_path: Path
    logging_level: str
    log_path: Path

    @classmethod
    def from_env(cls) -> "DBConfig":
        database_uri = _build_database_url()
        track_modifications = False
        project_path = Path(os.getenv("PROJECT_PATH") or os.getcwd())

        env_schema = os.getenv("SCHEMA_PATH")
        if env_schema:
            schema_path = Path(env_schema)
        else:
            candidates = [
                project_path / "backend" / "db" / "SCHEMA.sql",
                project_path / "backend" / "sql" / "main.sql",
            ]
            for candidate in candidates:
                if candidate.exists():
                    schema_path = candidate
                    break
            else:
                schema_path = candidates[0]
        logging_level = os.getenv("LOGGING_LEVEL", "INFO")
        log_path = Path(
            os.getenv("LOG_PATH")
            or project_path / "logs" / "db_manager.log"
        )
        port = int(os.getenv("PORT", "3001"))

        return cls(
            database_uri=database_uri,
            track_modifications=track_modifications,
            port=port,
            project_path=project_path,
            schema_path=schema_path,
            logging_level=logging_level,
            log_path=log_path,
        )

    def as_flask_config(self) -> Dict[str, str | int | bool]:
        """Return a dict compatible with the original Flask config contract."""

        return {
            "SQLALCHEMY_DATABASE_URI": self.database_uri,
            "SQLALCHEMY_TRACK_MODIFICATIONS": self.track_modifications,
            "PORT": self.port,
            "PROJECT_PATH": str(self.project_path),
            "SCHEMA_PATH": str(self.schema_path),
            "LOGGING_LEVEL": self.logging_level,
            "LOG_PATH": str(self.log_path),
        }


__all__ = ["DBConfig", "validate_config", "get_raw_connection"]
