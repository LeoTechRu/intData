"""Compatibility wrapper for database utilities.

The application code now keeps database configuration under
``core.db``.  Some modules (and tests) still import ``db`` directly, so
this file re-exports the relevant objects.
"""
from core.db import *  # noqa: F401,F403 - re-export
