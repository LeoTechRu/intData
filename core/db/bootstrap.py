"""Run idempotent DDL scripts using an existing connection."""
from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.engine import Connection

LOG_DIR = Path("logs")
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "db_bootstrap.log"

logger = logging.getLogger("db_bootstrap")
logger.setLevel(logging.INFO)
_file_handler = logging.FileHandler(LOG_FILE)
_file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
logger.addHandler(_file_handler)


def run_bootstrap_sql(conn: Connection) -> None:
    """Execute DDL scripts in alphabetical order inside a transaction."""
    ddl_dir = Path(__file__).resolve().parent / "ddl"
    paths = sorted(ddl_dir.glob("*.sql"))
    if not paths:
        logger.info("no ddl files found")
        return
    for path in paths:
        sql = path.read_text()
        try:
            conn.execute(text(sql))
            logger.info("applied %s", path.name)
        except Exception as exc:  # pragma: no cover - log and continue
            logger.warning("failed %s: %s", path.name, exc)
