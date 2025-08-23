"""Entry point for the FastAPI application used in tests.

This module exposes a single ``app`` instance that combines the
authentication route defined in :mod:`web.main` with the routers from the
``web.routes`` package.  Historically the project provided ``main.py`` at
repository root; tests and external scripts still import ``main``.  After
refactoring the web application moved under the ``web`` package, so this
file restores the expected import path.
"""
from web.main import app  # reuse auth endpoints
from web.routes import profile, admin

# Attach routers for profile and admin functionality.
app.include_router(profile.router)
app.include_router(admin.router, prefix="/admin")
