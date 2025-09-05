from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


ENV_FILE = os.getenv("ENV_FILE") or Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_FILE)


@dataclass
class Env:
    """Runtime environment flags."""

    DB_BOOTSTRAP: bool = os.getenv("DB_BOOTSTRAP", "0") == "1"
    DB_REPAIR: bool = os.getenv("DB_REPAIR", "0") == "1"
    DEV_INIT_MODELS: bool = os.getenv("DEV_INIT_MODELS", "0") == "1"


env = Env()
