"""Compatibility wrapper exposing `apps.web` as top-level `web` package."""
from __future__ import annotations

import importlib
import sys
from pathlib import Path
from types import ModuleType

# Ensure imports like `import web.routes` resolve to the actual code under apps/web
_APPS_WEB = Path(__file__).resolve().parent.parent / "apps" / "web"
if str(_APPS_WEB) not in sys.path:
    # Keep lookup deterministic: allow submodules to be discovered under this package
    sys.path.insert(0, str(_APPS_WEB.parent))

# Mark this module as a package with the same search path as apps.web
__path__ = [str(_APPS_WEB)]

_target = importlib.import_module("apps.web")

# Mirror attributes onto this module for backwards compatibility
for name, value in vars(_target).items():
    if name.startswith("__") and name not in {"__all__", "__doc__", "__path__"}:
        continue
    globals()[name] = value

# Keep reference for attr fallbacks
_target_module: ModuleType = _target

def __getattr__(name: str):
    return getattr(_target_module, name)


def __dir__():
    return sorted(set(globals()) | set(dir(_target_module)))

# Ensure both names resolve to the same module object
sys.modules.setdefault("apps.web", _target_module)
sys.modules[__name__] = sys.modules.setdefault(__name__, sys.modules.get(__name__, sys.modules["apps.web"]))
