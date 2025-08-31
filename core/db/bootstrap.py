"""Run idempotent DDL scripts using an existing connection."""
from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy.engine import Connection

LOG_DIR = Path("logs")
LOG_DIR.mkdir(parents=True, exist_ok=True)
LOG_FILE = LOG_DIR / "db_bootstrap.log"

logger = logging.getLogger("db_bootstrap")
logger.setLevel(logging.INFO)
_file_handler = logging.FileHandler(LOG_FILE)
_file_handler.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
logger.addHandler(_file_handler)


DDL_DIR = Path(__file__).resolve().parent / "ddl"


def split_sql(sql: str) -> list[str]:
    """Split raw SQL text into individual statements.

    Handles quotes, dollar-quoting and comments. Trailing semicolons are
    stripped. Empty statements and whitespace are ignored.
    """
    statements: list[str] = []
    buf: list[str] = []
    i = 0
    ln = len(sql)
    in_squote = False
    in_dquote = False
    in_line_comment = False
    in_block_comment = False
    dollar_tag: str | None = None

    while i < ln:
        ch = sql[i]
        nxt = sql[i : i + 2]

        if in_line_comment:
            buf.append(ch)
            if ch == "\n":
                in_line_comment = False
            i += 1
            continue
        if in_block_comment:
            buf.append(ch)
            if nxt == "*/":
                buf.append("/")
                i += 2
                in_block_comment = False
            else:
                i += 1
            continue
        if dollar_tag is not None:
            buf.append(ch)
            if sql.startswith(dollar_tag, i):
                buf.extend(dollar_tag[1:])  # first char already added
                i += len(dollar_tag)
                dollar_tag = None
            else:
                i += 1
            continue

        if ch == "'":
            buf.append(ch)
            if in_squote and sql[i + 1 : i + 2] == "'":
                buf.append("'")
                i += 2
                continue
            in_squote = not in_squote
            i += 1
            continue

        if ch == '"':
            buf.append(ch)
            if in_dquote and sql[i + 1 : i + 2] == '"':
                buf.append('"')
                i += 2
                continue
            in_dquote = not in_dquote
            i += 1
            continue

        if not in_squote and not in_dquote:
            if nxt == "--":
                buf.append(nxt)
                i += 2
                in_line_comment = True
                continue
            if nxt == "/*":
                buf.append(nxt)
                i += 2
                in_block_comment = True
                continue
            if ch == "$":
                j = i + 1
                while j < ln and sql[j] != "$":
                    j += 1
                if j < ln:
                    tag = sql[i : j + 1]
                    buf.append(tag)
                    dollar_tag = tag
                    i = j + 1
                    continue
            if ch == ";":
                stmt = "".join(buf).strip()
                if stmt:
                    statements.append(stmt)
                buf.clear()
                i += 1
                continue

        buf.append(ch)
        i += 1

    stmt = "".join(buf).strip()
    if stmt:
        statements.append(stmt)
    return statements


def run_bootstrap_sql(conn: Connection) -> dict[str, int]:
    """Execute DDL scripts sequentially without wrapping them in one txn."""

    paths = sorted(DDL_DIR.glob("*.sql"))
    if not paths:
        logger.info("no ddl files found")
        return {"files": 0, "executed": 0, "failed": 0}

    executed = 0
    failed = 0
    for path in paths:
        sql = path.read_text()
        for stmt in split_sql(sql):
            snippet = stmt.strip().replace("\n", " ")[:200]
            try:
                conn.exec_driver_sql(stmt)
                conn.commit()
                executed += 1
            except Exception as exc:  # pragma: no cover - log and continue
                conn.rollback()
                failed += 1
                logger.warning("failed %s: %s; snippet: %s", path.name, exc, snippet)

    return {"files": len(paths), "executed": executed, "failed": failed}
