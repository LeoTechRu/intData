from telegram.ext import Application, CommandHandler, CallbackContext
from telegram import Update

from src.config.settings import BOT_TOKEN


class BotService:
    application: Application

    async def process_update(self, jsondata):
        update = Update.de_json(jsondata, bot=self.application.bot)

        await self.application.process_update(update)

    @classmethod
    async def load_application(cls):
        application = Application.builder().token(BOT_TOKEN).build()

        async def start(update: Update, context: CallbackContext):
            await update.message.reply_text(f"Salom! Men @{context.bot.username} botman.")

        application.add_handler(CommandHandler("start", start))

        await application.initialize()
        await application.start()

        cls.application = application

        print("✅ Telegram bot started")
