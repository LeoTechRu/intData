import pytest
from httpx import AsyncClient

pytest_plugins = ["tests.web.test_auth"]


@pytest.mark.asyncio
async def test_register_duplicate_username(client: AsyncClient) -> None:
    resp1 = await client.post(
        "/auth/register",
        data={"username": "alice", "password": "secret"},
        follow_redirects=False,
    )
    assert resp1.status_code in {200, 303}

    resp2 = await client.post(
        "/auth/register",
        data={"username": "alice", "password": "secret"},
        follow_redirects=False,
    )
    assert resp2.status_code == 400
    assert resp2.json()["detail"] == "username taken"
