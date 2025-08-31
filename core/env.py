from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class Env:
    """Runtime environment flags."""

    DB_BOOTSTRAP: bool = os.getenv("DB_BOOTSTRAP", "0") == "1"
    DB_REPAIR: bool = os.getenv("DB_REPAIR", "0") == "1"
    DEV_INIT_MODELS: bool = os.getenv("DEV_INIT_MODELS", "0") == "1"


env = Env()
