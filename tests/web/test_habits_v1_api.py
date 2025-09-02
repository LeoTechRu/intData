import sqlalchemy as sa
import pytest
import pytest_asyncio
import sqlalchemy as sa
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from base import Base
import core.db as db
from core.models import TgUser, Area, Project, WebUser
from core.services.habits import metadata, habits

try:
    from main import app  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    from main import app  # type: ignore


@pytest_asyncio.fixture
async def client():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:?cache=shared", connect_args={"uri": True}
    )
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(metadata.create_all)
    db.engine = engine
    db.async_session = async_session
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    await engine.dispose()


async def _seed(owner_id: int, tg_id: int, area_id: int, project_id: int | None = None):
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            session.add(WebUser(id=owner_id, username="u"))
            session.add(TgUser(telegram_id=tg_id, first_name="tg"))
            session.add(
                Area(id=area_id, owner_id=tg_id, name="A", title="A")
            )
            if project_id is not None:
                session.add(
                    Project(id=project_id, owner_id=tg_id, area_id=area_id, name="P")
                )


@pytest.mark.asyncio
async def test_habit_and_reward_flow(client: AsyncClient):
    await _seed(owner_id=1, tg_id=1, area_id=1, project_id=1)
    cookies = {"web_user_id": "1", "telegram_id": "1"}

    resp = await client.post(
        "/api/v1/habits",
        json={
            "title": "H",
            "type": "positive",
            "difficulty": "easy",
            "project_id": 1,
        },
        cookies=cookies,
    )
    assert resp.status_code == 201
    habit_id = resp.json()["id"]
    async with db.async_session() as session:  # type: ignore
        await session.execute(
            sa.update(habits).where(habits.c.id == habit_id).values(cooldown_sec=0)
        )
        await session.commit()

    resp = await client.post(f"/api/v1/habits/{habit_id}/up", cookies=cookies)
    assert resp.status_code == 200

    resp = await client.post(f"/api/v1/habits/{habit_id}/down", cookies=cookies)
    assert resp.status_code == 200

    # reward operations
    resp = await client.post(
        "/api/v1/rewards",
        json={"title": "R", "cost_gold": 1, "area_id": 1},
        cookies=cookies,
    )
    assert resp.status_code == 201
    reward_id = resp.json()["id"]

    resp = await client.post(f"/api/v1/rewards/{reward_id}/buy", cookies=cookies)
    assert resp.status_code == 200
    assert "gold_after" in resp.json()

    # insufficient gold
    resp = await client.post(
        "/api/v1/rewards",
        json={"title": "Exp", "cost_gold": 100, "area_id": 1},
        cookies=cookies,
    )
    rid = resp.json()["id"]
    resp = await client.post(f"/api/v1/rewards/{rid}/buy", cookies=cookies)
    assert resp.status_code == 400
    assert resp.json()["error"] == "insufficient_gold"

    # check stats endpoint
    resp = await client.get("/api/v1/habits/stats", cookies=cookies)
    assert resp.status_code == 200
    assert "level" in resp.json()

    # area inherited from project
    async with db.async_session() as session:  # type: ignore
        res = await session.execute(
            sa.select(habits.c.area_id).where(habits.c.id == habit_id)
        )
        assert res.scalar_one() == 1


@pytest.mark.asyncio
async def test_daily_and_cron(client: AsyncClient):
    await _seed(owner_id=2, tg_id=2, area_id=2)
    cookies = {"web_user_id": "2", "telegram_id": "2"}

    resp = await client.post(
        "/api/v1/dailies",
        json={
            "title": "D",
            "rrule": "FREQ=DAILY",
            "difficulty": "easy",
            "area_id": 2,
        },
        cookies=cookies,
    )
    assert resp.status_code == 201
    daily_id = resp.json()["id"]

    resp = await client.post(f"/api/v1/dailies/{daily_id}/done", cookies=cookies)
    assert resp.status_code == 200

    resp = await client.post(f"/api/v1/dailies/{daily_id}/undo", cookies=cookies)
    assert resp.status_code == 200

    # cron idempotence
    resp = await client.post("/api/v1/habits/cron/run", cookies=cookies)
    assert resp.status_code == 200
    assert resp.json()["ran"] is True
    resp = await client.post("/api/v1/habits/cron/run", cookies=cookies)
    assert resp.json()["ran"] is False


@pytest.mark.asyncio
async def test_para_enforcement(client: AsyncClient):
    await _seed(owner_id=3, tg_id=3, area_id=3)
    cookies = {"web_user_id": "3", "telegram_id": "3"}
    resp = await client.post(
        "/api/v1/habits",
        json={"title": "H", "type": "positive", "difficulty": "easy"},
        cookies=cookies,
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_up_requires_tg_link(client: AsyncClient):
    await _seed(owner_id=4, tg_id=4, area_id=4)
    cookies = {"web_user_id": "4", "telegram_id": "4"}
    resp = await client.post(
        "/api/v1/habits",
        json={"title": "H", "type": "positive", "difficulty": "easy", "area_id": 4},
        cookies=cookies,
    )
    habit_id = resp.json()["id"]
    resp = await client.post(f"/api/v1/habits/{habit_id}/up", cookies={"web_user_id": "4"})
    assert resp.status_code == 403
    assert resp.json()["error"] == "tg_link_required"


@pytest.mark.asyncio
async def test_cooldown_returns_429(client: AsyncClient):
    await _seed(owner_id=5, tg_id=5, area_id=5)
    cookies = {"web_user_id": "5", "telegram_id": "5"}
    resp = await client.post(
        "/api/v1/habits",
        json={"title": "H", "type": "positive", "difficulty": "easy", "area_id": 5},
        cookies=cookies,
    )
    hid = resp.json()["id"]
    await client.post(f"/api/v1/habits/{hid}/up", cookies=cookies)
    resp = await client.post(f"/api/v1/habits/{hid}/up", cookies=cookies)
    assert resp.status_code == 429
    data = resp.json().get("detail", {})
    assert data.get("error") == "cooldown"
    assert data.get("retry_after", 0) > 0

