#!/usr/bin/env python3
"""Dump the database using pg_dump to a configured directory."""
from __future__ import annotations

import datetime as dt
import os
import subprocess
from pathlib import Path

from dotenv import load_dotenv


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
    env = os.environ.copy()
    if 'DB_PASSWORD' in os.environ:
        env['PGPASSWORD'] = os.environ['DB_PASSWORD']
    cmd = ['pg_dump', url, '-f', str(dump_file)]
    subprocess.run(cmd, check=True, env=env)
    print(f'Dump written to {dump_file}')


if __name__ == '__main__':
    main()
