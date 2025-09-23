#!/usr/bin/env python3
"""Dump the database using pg_dump to a configured directory."""
from __future__ import annotations

import datetime as dt
import logging
import os
import shutil
import subprocess
from pathlib import Path
from typing import Sequence

from dotenv import load_dotenv

logger = logging.getLogger(__name__)


def _resolve_binary(name: str) -> str:
    """Resolve an executable to an absolute path to avoid PATH hijacking."""

    path = shutil.which(name)
    if path is None:
        raise RuntimeError(f"{name} executable not found in PATH")
    return path


def _run_pg_dump(command: Sequence[str], *, env: dict[str, str], timeout: int) -> None:
    """Execute pg_dump with basic logging and bounded runtime."""

    try:
        completed = subprocess.run(
            list(command),
            check=True,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout,
        )
        if completed.stdout:
            logger.debug("pg_dump stdout captured (%s bytes)", len(completed.stdout))
        if completed.stderr:
            logger.debug("pg_dump stderr captured (%s bytes)", len(completed.stderr))
    except subprocess.TimeoutExpired as exc:
        logger.error("pg_dump timed out after %s seconds", exc.timeout)
        raise RuntimeError("pg_dump exceeded timeout") from exc
    except subprocess.CalledProcessError as exc:
        logger.error("pg_dump failed with exit code %s", exc.returncode)
        raise RuntimeError("pg_dump failed; inspect stderr logs") from exc


def main() -> None:
    load_dotenv()
    default_dir = Path(__file__).resolve().parent / "backup"
    backup_dir = Path(os.getenv("DB_DUMP_DIR", default_dir))
    backup_dir.mkdir(parents=True, exist_ok=True)
    date = dt.datetime.utcnow().strftime("%Y%m%d")
    prefix = os.getenv("DB_DUMP_PREFIX", "dump")
    dump_file = backup_dir / f"{prefix}_{date}.sql"

    url = os.getenv('DATABASE_URL')
    if not url:
        user = os.getenv('DB_USER', '')
        password = os.getenv('DB_PASSWORD', '')
        host = os.getenv('DB_HOST', 'localhost')
        port = os.getenv('DB_PORT', '5432')
        name = os.getenv('DB_NAME', '')
        url = f"postgresql://{user}:{password}@{host}:{port}/{name}"
    env = {key: value for key, value in os.environ.items() if key != 'PGPASSWORD'}
    if 'DB_PASSWORD' in os.environ:
        env['PGPASSWORD'] = os.environ['DB_PASSWORD']

    pg_dump_bin = _resolve_binary('pg_dump')
    timeout_seconds = int(os.getenv('DB_DUMP_TIMEOUT', '300'))
    cmd = [pg_dump_bin, url, '-f', str(dump_file)]
    _run_pg_dump(cmd, env=env, timeout=timeout_seconds)
    print(f'Dump written to {dump_file}')


if __name__ == '__main__':
    main()
