"""Compatibility wrapper exposing SQLAlchemy models.

The project originally used a top-level `models` module. After
refactoring the models live inside the `core` package.  Tests and some
legacy imports still expect `models`, so this module simply re-exports
symbols from :mod:`core.models`.
"""
from core.models import *  # noqa: F401,F403 - re-export for backwards compatibility
