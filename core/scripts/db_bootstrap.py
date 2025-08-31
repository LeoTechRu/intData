#!/usr/bin/env python3
"""Run idempotent DDL scripts for initial database bootstrap."""
from __future__ import annotations

import logging
import os
from pathlib import Path

import psycopg
from dotenv import load_dotenv

LOG_DIR = Path('logs')
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / 'db_bootstrap.log'

logger = logging.getLogger('db_bootstrap')
logger.setLevel(logging.INFO)
_file_handler = logging.FileHandler(LOG_FILE)
_file_handler.setFormatter(logging.Formatter('%(asctime)s %(levelname)s %(message)s'))
logger.addHandler(_file_handler)


def get_conn() -> psycopg.Connection:
    load_dotenv()
    url = os.getenv('DATABASE_URL')
    if not url:
        user = os.getenv('DB_USER', '')
        password = os.getenv('DB_PASSWORD', '')
        host = os.getenv('DB_HOST', 'localhost')
        port = os.getenv('DB_PORT', '5432')
        name = os.getenv('DB_NAME', '')
        url = f"postgresql://{user}:{password}@{host}:{port}/{name}"
    return psycopg.connect(url)


def run() -> None:
    ddl_dir = Path(__file__).resolve().parent.parent / 'db' / 'ddl'
    paths = sorted(ddl_dir.glob('*.sql'))
    if not paths:
        logger.info('no ddl files found')
        return
    with get_conn() as conn:
        for path in paths:
            sql = path.read_text()
            try:
                with conn.transaction():
                    with conn.cursor() as cur:
                        cur.execute(sql)
                logger.info('applied %s', path.name)
            except Exception as exc:  # pragma: no cover - log and continue
                logger.warning('failed %s: %s', path.name, exc)
        conn.commit()


if __name__ == '__main__':
    run()
