import argparse
import hashlib
import json
import difflib
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from sqlalchemy import Column, MetaData, CheckConstraint, UniqueConstraint, Enum as SAEnum
from sqlalchemy.schema import CreateIndex, CreateTable
from sqlalchemy.dialects import postgresql


def collect_metadata() -> MetaData:
    """Import models and return shared MetaData."""
    from core import models  # noqa: F401  # ensure models imported
    from base import Base

    return Base.metadata


def _column_default(col: Column) -> Any:
    if col.default is None:
        return None
    arg = getattr(col.default, "arg", None)
    if callable(arg):
        return None
    if hasattr(arg, "value"):
        return arg.value
    return arg


def _server_default(col: Column) -> Any:
    if col.server_default is None:
        return None
    arg = getattr(col.server_default, "arg", None)
    if arg is None:
        return None
    text = getattr(arg, "text", None)
    return str(text) if text is not None else str(arg)


def export_json(path: Path) -> None:
    metadata = collect_metadata()
    dialect = postgresql.dialect()
    data: dict[str, Any] = {
        "version": 1,
        "dialect": "postgresql",
        "generated_at": datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z"),
        "enums": [],
        "tables": {},
    }

    enums: dict[str, list[str]] = {}
    for table in metadata.tables.values():
        for col in table.columns:
            col_type = col.type
            if isinstance(col_type, SAEnum):
                name = col_type.name or (
                    col_type.enum_class.__name__ if col_type.enum_class else col.name
                )
                values = [getattr(v, "value", v) for v in col_type.enums]
                enums[name] = sorted([str(v) for v in values])
    data["enums"] = [
        {"name": name, "values": values} for name, values in sorted(enums.items())
    ]

    tables: dict[str, Any] = {}
    for table in sorted(metadata.tables.values(), key=lambda t: t.name):
        tbl: dict[str, Any] = {
            "comment": table.comment or "",
            "columns": [],
            "primary_key": list(table.primary_key.columns.keys()),
            "foreign_keys": [],
            "unique_constraints": [],
            "indexes": [],
            "checks": [],
        }
        for col in sorted(table.columns, key=lambda c: c.name):
            tbl["columns"].append(
                {
                    "name": col.name,
                    "type": col.type.compile(dialect=dialect),
                    "nullable": col.nullable,
                    "primary_key": col.primary_key,
                    "autoincrement": bool(getattr(col, "autoincrement", False)),
                    "default": _column_default(col),
                    "server_default": _server_default(col),
                    "comment": col.comment or "",
                }
            )

        fk_list = []
        for fk in table.foreign_key_constraints:
            fk_list.append(
                {
                    "name": fk.name,
                    "columns": sorted([c.name for c in fk.columns]),
                    "ref_table": fk.referred_table.name,
                    "ref_columns": [elem.column.name for elem in fk.elements],
                    "ondelete": fk.ondelete,
                    "onupdate": fk.onupdate,
                }
            )
        tbl["foreign_keys"] = sorted(
            fk_list, key=lambda x: (x["name"] or "", x["columns"])
        )

        uqs = []
        for c in table.constraints:
            if isinstance(c, UniqueConstraint):
                uqs.append({"name": c.name, "columns": list(c.columns.keys())})
        tbl["unique_constraints"] = sorted(
            uqs, key=lambda x: (x["name"] or "", x["columns"])
        )

        idxs = []
        for idx in table.indexes:
            idxs.append(
                {"name": idx.name, "columns": list(idx.columns.keys()), "unique": idx.unique}
            )
        tbl["indexes"] = sorted(
            idxs, key=lambda x: (x["name"] or "", x["columns"])
        )

        checks = []
        for c in table.constraints:
            if isinstance(c, CheckConstraint):
                checks.append({"name": c.name, "sql": str(c.sqltext)})
        tbl["checks"] = sorted(checks, key=lambda x: x["name"] or "")

        tables[table.name] = tbl

    data["tables"] = tables
    metadata_hash = compute_hash(data)
    ordered = {
        "version": data["version"],
        "dialect": data["dialect"],
        "generated_at": data["generated_at"],
        "metadata_hash": metadata_hash,
        "enums": data["enums"],
        "tables": data["tables"],
    }
    path.write_text(
        json.dumps(ordered, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def export_sql(path: Path) -> None:
    metadata = collect_metadata()
    dialect = postgresql.dialect()
    statements: list[str] = []
    for table in sorted(metadata.tables.values(), key=lambda t: t.name):
        statements.append(str(CreateTable(table).compile(dialect=dialect)).strip())
    for table in sorted(metadata.tables.values(), key=lambda t: t.name):
        for idx in sorted(table.indexes, key=lambda i: i.name):
            statements.append(str(CreateIndex(idx).compile(dialect=dialect)).strip())
    sql = ";\n\n".join(statements) + ";\n"
    path.write_text(sql, encoding="utf-8")


def normalized_dict_for_hash(obj: Any) -> Any:
    if isinstance(obj, dict):
        result = {}
        for key in sorted(obj.keys()):
            if key in {"generated_at", "metadata_hash"}:
                continue
            result[key] = normalized_dict_for_hash(obj[key])
        return result
    if isinstance(obj, list):
        return [normalized_dict_for_hash(i) for i in obj]
    return obj


def compute_hash(struct: dict[str, Any]) -> str:
    normalized = normalized_dict_for_hash(struct)
    data = json.dumps(
        normalized, sort_keys=True, separators=(",", ":"), ensure_ascii=True
    )
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


# Default output directory is the current package directory: core/db
DEFAULT_OUT_DIR = Path(__file__).resolve().parent


def generate(out_dir: str | Path = DEFAULT_OUT_DIR, overwrite: bool = True) -> None:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    json_path = out_dir / "SCHEMA.json"
    sql_path = out_dir / "SCHEMA.sql"
    if not overwrite and (json_path.exists() or sql_path.exists()):
        raise FileExistsError("Schema files already exist")
    export_json(json_path)
    export_sql(sql_path)


def _file_diff(a: Path, b: Path) -> str:
    a_text = a.read_text().splitlines()
    b_text = b.read_text().splitlines()
    return "\n".join(
        difflib.unified_diff(a_text, b_text, fromfile=str(a), tofile=str(b))
    )


def check(out_dir: str | Path = DEFAULT_OUT_DIR) -> bool:
    out_dir = Path(out_dir)
    json_path = out_dir / "SCHEMA.json"
    sql_path = out_dir / "SCHEMA.sql"
    if not json_path.exists() or not sql_path.exists():
        print("Schema files are missing. Run: python -m core.db.schema_export generate")
        return False
    with TemporaryDirectory() as tmp:
        tmp_dir = Path(tmp)
        export_json(tmp_dir / "SCHEMA.json")
        export_sql(tmp_dir / "SCHEMA.sql")
        ok = True
        existing = json.loads(json_path.read_text())
        generated = json.loads((tmp_dir / "SCHEMA.json").read_text())
        if existing.get("metadata_hash") != generated.get("metadata_hash"):
            print(_file_diff(json_path, tmp_dir / "SCHEMA.json"))
            ok = False
        if sql_path.read_text() != (tmp_dir / "SCHEMA.sql").read_text():
            print(_file_diff(sql_path, tmp_dir / "SCHEMA.sql"))
            ok = False
        if not ok:
            print(
                "DB schema is out of date with models. Run: python -m core.db.schema_export generate"
            )
        return ok


def main() -> None:
    parser = argparse.ArgumentParser(description="DB schema exporter")
    sub = parser.add_subparsers(dest="cmd")
    sub.add_parser("generate")
    sub.add_parser("check")
    args = parser.parse_args()
    if args.cmd == "generate":
        generate()
    elif args.cmd == "check":
        ok = check()
        raise SystemExit(0 if ok else 1)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()

