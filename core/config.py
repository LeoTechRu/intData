"""Application configuration defaults for habits module."""
from __future__ import annotations

import math
import os
from dataclasses import dataclass


@dataclass
class Config:
    HABITS_V1_ENABLED: bool = os.getenv("HABITS_V1_ENABLED", "true").lower() == "true"
    HABITS_RPG_ENABLED: bool = os.getenv("HABITS_RPG_ENABLED", "true").lower() == "true"
    XP_BASE: dict[str, int] | None = None
    GOLD_BASE: dict[str, int] | None = None
    HP_BASE: dict[str, int] | None = None
    VAL_STEP: float = 0.1
    REWARD_DECAY_K: float = math.log(2)
    HP_MAX: int = 50

    def __post_init__(self) -> None:
        self.XP_BASE = {"trivial": 3, "easy": 10, "medium": 15, "hard": 25}
        self.GOLD_BASE = {"trivial": 1, "easy": 3, "medium": 5, "hard": 8}
        self.HP_BASE = {"trivial": 1, "easy": 5, "medium": 8, "hard": 12}


config = Config()
