import pytest
import pytest_asyncio
from httpx import AsyncClient

from base import Base
import core.db as db
from core.models import TgUser, WebUser, UserRole
from core.services.telegram_user_service import TelegramUserService
from core.services.web_user_service import WebUserService
from core.services.crm_service import CRMService
from core.services.group_moderation_service import GroupModerationService
from core.models import GroupType, ProductStatus

try:
    from main import app  # type: ignore
except ModuleNotFoundError:  # pragma: no cover
    from main import app  # type: ignore


@pytest_asyncio.fixture
async def client(monkeypatch, postgres_db):
    engine, _ = postgres_db
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async def fake_ban(chat_id, user_id):
        return True

    async def fake_unban(chat_id, user_id):
        return True

    monkeypatch.setattr(db.bot, "ban_chat_member", fake_ban)
    monkeypatch.setattr(db.bot, "unban_chat_member", fake_unban)

    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


async def _bootstrap_group() -> tuple[int, int, int]:
    async with db.async_session() as session:  # type: ignore
        async with session.begin():
            tsvc = TelegramUserService(session)
            crm = CRMService(session)
            moderation = GroupModerationService(session, crm=crm)
            owner, _ = await tsvc.get_or_create_user(
                telegram_id=10, first_name="Owner", role=UserRole.admin.name
            )
            trial, _ = await tsvc.get_or_create_user(
                telegram_id=11, first_name="Trial"
            )
            group, _ = await tsvc.get_or_create_group(
                telegram_id=-900,
                title="Launch Group",
                type=GroupType.supergroup,
                owner_id=owner.telegram_id,
            )
            await tsvc.add_user_to_group(owner.telegram_id, group.telegram_id, True)
            await tsvc.add_user_to_group(trial.telegram_id, group.telegram_id)
            await moderation.record_activity(
                group_id=group.telegram_id,
                user_id=owner.telegram_id,
                messages=5,
            )
            product = await crm.ensure_product(slug="course", title="Курс")
            await crm.assign_product(
                user_id=owner.telegram_id,
                product_id=product.id,
                status=ProductStatus.paid,
            )

            wsvc = WebUserService(session)
            web_user = await wsvc.register(username="web", password="secret")
            web_user.role = UserRole.admin.name
            await session.flush()
            await wsvc.link_telegram(web_user.id, owner.id)
    return owner.telegram_id, trial.telegram_id, web_user.id  # type: ignore


@pytest.mark.asyncio
async def test_groups_api_endpoints(client: AsyncClient):
    owner_id, trial_id, web_user_id = await _bootstrap_group()
    cookies = {"web_user_id": str(web_user_id), "telegram_id": str(owner_id)}

    resp = await client.get("/api/v1/groups", cookies=cookies)
    assert resp.status_code == 200
    groups = resp.json()
    assert groups and groups[0]["telegram_id"] == -900

    resp = await client.get("/api/v1/groups/-900", cookies=cookies)
    assert resp.status_code == 200
    detail = resp.json()
    assert detail["group"]["title"] == "Launch Group"
    assert len(detail["members"]) == 2

    profile_payload = {
        "notes": "оформил возврат",
        "trial_expires_at": "2025-09-30T00:00:00Z",
        "tags": ["refund", "wave1"],
    }
    resp = await client.put(
        f"/api/v1/groups/-900/members/{trial_id}/profile",
        json=profile_payload,
        cookies=cookies,
    )
    assert resp.status_code == 200
    updated = resp.json()
    assert updated["crm_notes"] == profile_payload["notes"]
    assert "refund" in updated["crm_tags"]

    prune_resp = await client.post(
        "/api/v1/groups/-900/prune",
        json={"product_slug": "course", "dry_run": True},
        cookies=cookies,
    )
    assert prune_resp.status_code == 200
    data = prune_resp.json()
    assert data["dry_run"] is True
    assert any(item["user_id"] == trial_id for item in data.get("candidates", []))

    assign_payload = {
        "product_slug": "course",
        "status": "paid",
        "source": "web",
    }
    resp = await client.post(
        f"/api/v1/groups/-900/members/{trial_id}/products",
        json=assign_payload,
        cookies=cookies,
    )
    assert resp.status_code == 201

    prune_after = await client.post(
        "/api/v1/groups/-900/prune",
        json={"product_slug": "course", "dry_run": True},
        cookies=cookies,
    )
    assert prune_after.status_code == 200
    assert prune_after.json()["candidates"] == []

    detail_after = await client.get("/api/v1/groups/-900", cookies=cookies)
    assert detail_after.status_code == 200
    members = detail_after.json()["members"]
    trial_entry = next(m for m in members if m["telegram_id"] == trial_id)
    assert any(prod["status"] == "paid" for prod in trial_entry["products"])
