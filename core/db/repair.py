from __future__ import annotations

import logging
from sqlalchemy.engine import Connection

logger = logging.getLogger(__name__)


def run_repair(conn: Connection) -> None:  # pragma: no cover - placeholder
    """Perform backfill and repair tasks.

    Currently no operations are required.  This function exists to keep a
    single entry point for future repairs.
    """
    logger.info("run_repair: nothing to repair")
