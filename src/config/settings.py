from environs import Env

env = Env()
env.read_env()


DEBUG = env.bool("DEBUG", default=False)

BOT_TOKEN = env.str("BOT_TOKEN", default=None)
WEBHOOK_URL = env.str("WEBHOOK_URL", default=None)


assert BOT_TOKEN is not None, "BOT_TOKEN is required"
assert WEBHOOK_URL is not None, "WEBHOOK_URL is required"
