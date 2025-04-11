from contextlib import asynccontextmanager
from fastapi import FastAPI
from src.services.bot import BotService


@asynccontextmanager
async def lifespan(app: FastAPI):
    await BotService.load_application()

    yield
