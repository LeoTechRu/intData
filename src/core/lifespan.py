from contextlib import asynccontextmanager
from fastapi import FastAPI
from src.services.bot import BotService


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        await BotService.load_application()
    except Exception as exc:
        print(f"Failed to start bot: {exc}")

    yield
