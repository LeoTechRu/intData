from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
ENV_FILE = Path(os.getenv("ENV_FILE") or PROJECT_ROOT / ".env")
dotenv_loaded = load_dotenv(ENV_FILE)

if dotenv_loaded:
    if ENV_FILE.resolve().parent == PROJECT_ROOT:
        logger.info("Loaded .env from project root: %s", ENV_FILE)
    else:
        logger.warning(
            "Loaded .env from %s (expected root %s)",
            ENV_FILE.resolve(),
            PROJECT_ROOT,
        )
else:
    logger.warning("Env file %s not found", ENV_FILE)


@dataclass
class Env:
    """Runtime environment flags."""

    DB_BOOTSTRAP: bool = os.getenv("DB_BOOTSTRAP", "0") == "1"
    DB_REPAIR: bool = os.getenv("DB_REPAIR", "0") == "1"
    DEV_INIT_MODELS: bool = os.getenv("DEV_INIT_MODELS", "0") == "1"


env = Env()
