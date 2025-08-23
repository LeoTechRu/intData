import os
from dotenv import load_dotenv

load_dotenv()

DEBUG = os.getenv("DEBUG", "false").lower() == "true"
BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBHOOK_URL = os.getenv("WEBHOOK_URL")

assert BOT_TOKEN is not None, "BOT_TOKEN is required"
assert WEBHOOK_URL is not None, "WEBHOOK_URL is required"
