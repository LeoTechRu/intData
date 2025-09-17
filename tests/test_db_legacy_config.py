import importlib
from pathlib import Path
from types import SimpleNamespace

import pytest

ENV_VARS = {
    "DATABASE_URL",
    "DB_USER",
    "DB_PASSWORD",
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "PORT",
    "SCHEMA_PATH",
    "LOG_PATH",
    "PROJECT_PATH",
    "LOGGING_LEVEL",
}


def reload_legacy(monkeypatch, **env):
    for name in ENV_VARS:
        monkeypatch.delenv(name, raising=False)
    module = importlib.import_module("core.db.legacy")
    module = importlib.reload(module)
    for name in ENV_VARS:
        monkeypatch.delenv(name, raising=False)
    for name, value in env.items():
        monkeypatch.setenv(name, value)
    return module


def test_validate_config_requires_env(monkeypatch):
    legacy = reload_legacy(monkeypatch)
    with pytest.raises(EnvironmentError):
        legacy.validate_config()


def test_dbconfig_from_env(monkeypatch, tmp_path):
    schema = tmp_path / "schema.sql"
    log = tmp_path / "db.log"
    env = {
        "DATABASE_URL": "postgresql://user:pass@host:5432/db",
        "PORT": "3010",
        "SCHEMA_PATH": str(schema),
        "LOG_PATH": str(log),
        "PROJECT_PATH": str(tmp_path),
        "LOGGING_LEVEL": "DEBUG",
    }
    legacy = reload_legacy(monkeypatch, **env)

    config = legacy.DBConfig.from_env()
    assert config.database_uri == env["DATABASE_URL"]
    assert config.port == 3010
    assert config.schema_path == Path(env["SCHEMA_PATH"])
    assert config.log_path == Path(env["LOG_PATH"])
    assert config.logging_level == "DEBUG"

    flask_cfg = config.as_flask_config()
    assert flask_cfg["SQLALCHEMY_DATABASE_URI"] == env["DATABASE_URL"]
    assert flask_cfg["PORT"] == 3010
    assert flask_cfg["SCHEMA_PATH"] == env["SCHEMA_PATH"]


def test_get_raw_connection_uses_psycopg(monkeypatch):
    env = {"DATABASE_URL": "postgresql://user:pass@host:5432/db"}
    legacy = reload_legacy(monkeypatch, **env)

    captured = {}

    def fake_connect(dsn):
        captured["dsn"] = dsn
        return SimpleNamespace(name="fake")

    monkeypatch.setattr(legacy.psycopg, "connect", fake_connect)
    conn = legacy.get_raw_connection()

    assert captured["dsn"] == env["DATABASE_URL"]
    assert conn.name == "fake"
