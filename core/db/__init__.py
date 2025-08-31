from __future__ import annotations

import builtins
import logging
import os
import sys

import bcrypt as _bcrypt
from aiogram import Bot, Dispatcher
from aiogram.fsm.storage.memory import MemoryStorage
from dotenv import load_dotenv

from .engine import engine, async_session, init_models, Base

logger = logging.getLogger(__name__)
load_dotenv()

TG_BOT_TOKEN = os.getenv("TG_BOT_TOKEN") or ("123456:" + "A" * 35)
try:
    bot = Bot(token=TG_BOT_TOKEN)
except Exception:
    TG_BOT_TOKEN = "123456:" + "A" * 35
    bot = Bot(token=TG_BOT_TOKEN)
storage = MemoryStorage()
dp = Dispatcher(storage=storage)

# Expose module as ``db``
builtins.db = sys.modules[__name__]


class _BcryptWrapper:
    """Lightweight wrapper providing Flask-Bcrypt like helpers."""

    @staticmethod
    def generate_password_hash(password: str) -> str:
        return _bcrypt.hashpw(password.encode(), _bcrypt.gensalt()).decode()

    @staticmethod
    def check_password_hash(hashed: str, password: str) -> bool:
        if not hashed:
            return False
        return _bcrypt.checkpw(password.encode(), hashed.encode())


bcrypt = _BcryptWrapper()
