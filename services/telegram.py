"""Compatibility wrapper exposing :class:`UserService`.

Historically modules imported ``services.telegram`` directly. After the
refactor service implementations live under ``core.services``.  This
module re-exports :class:`UserService` for those legacy imports.
"""
from core.services.telegram import UserService

__all__ = ["UserService"]
