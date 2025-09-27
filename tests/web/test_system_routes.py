import pytest
from httpx import AsyncClient, ASGITransport

from web import app


@pytest.mark.asyncio
async def test_healthz_is_public():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://testserver") as client:
        response = await client.get("/healthz", follow_redirects=False)
    assert response.status_code == 200
    data = response.json()
    assert data.get("ok") is True
    assert isinstance(data.get("version"), str) and data["version"]
