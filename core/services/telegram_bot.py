import os
import httpx


class TelegramBotClient:
    """Minimal async Telegram Bot API client."""

    def __init__(self, token: str | None = None) -> None:
        self.token = token or os.getenv("TG_BOT_TOKEN", "")
        self.base_url = f"https://api.telegram.org/bot{self.token}"
        self._client: httpx.AsyncClient | None = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None:
            self._client = httpx.AsyncClient()
        return self._client

    async def send_message(self, chat_id: int, text: str, *, silent: bool = False) -> None:
        if not self.token:
            return
        client = await self._get_client()
        await client.post(
            f"{self.base_url}/sendMessage",
            json={"chat_id": chat_id, "text": text, "disable_notification": silent},
            timeout=10,
        )

    async def close(self) -> None:
        if self._client:
            await self._client.aclose()
            self._client = None
