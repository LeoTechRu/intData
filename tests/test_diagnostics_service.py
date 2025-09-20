import time

import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
from core.services.access_control import AccessControlService
from core.services.diagnostics_service import DiagnosticsService


@pytest_asyncio.fixture
async def session(postgres_engine):
    engine = postgres_engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    async with factory() as sess:
        async with AccessControlService(sess) as access:
            await access.seed_presets()
            from sqlalchemy import select
            from core.models import AuthPermission, DiagnosticTemplate, Role

            perm_defs = [
                {
                    "code": "diagnostics.clients.manage",
                    "name": "Diagnostics: manage clients",
                    "description": "Просмотр и управление клиентами диагностик",
                    "bit": 14,
                },
                {
                    "code": "diagnostics.specialists.manage",
                    "name": "Diagnostics: manage specialists",
                    "description": "Управление специалистами и диагностиками",
                    "bit": 15,
                },
            ]
            for definition in perm_defs:
                result = await sess.execute(
                    select(AuthPermission).where(AuthPermission.code == definition["code"])
                )
                existing = result.scalar_one_or_none()
                if existing is None:
                    sess.add(
                        AuthPermission(
                            code=definition["code"],
                            name=definition["name"],
                            description=definition["description"],
                            category="diagnostics",
                            bit_position=definition["bit"],
                            mutable=False,
                        )
                    )
            await sess.flush()

            role_defs = [
                {
                    "slug": "diagnostics_client",
                    "name": "Diagnostics Client",
                    "description": "Клиент диагностических программ",
                    "level": 5,
                    "mask": 0,
                    "grants_all": False,
                },
                {
                    "slug": "diagnostics_specialist",
                    "name": "Diagnostics Specialist",
                    "description": "Специалист по диагностике",
                    "level": 25,
                    "mask": 1 << 14,
                    "grants_all": False,
                },
                {
                    "slug": "diagnostics_admin",
                    "name": "Diagnostics Admin",
                    "description": "Администратор диагностик",
                    "level": 35,
                    "mask": (1 << 14) | (1 << 15),
                    "grants_all": False,
                },
            ]
            for definition in role_defs:
                result = await sess.execute(
                    select(Role).where(Role.slug == definition["slug"])
                )
                existing = result.scalar_one_or_none()
                if existing is None:
                    sess.add(
                        Role(
                            slug=definition["slug"],
                            name=definition["name"],
                            description=definition["description"],
                            level=definition["level"],
                            permissions_mask=definition["mask"],
                            is_system=False,
                            grants_all=definition["grants_all"],
                        )
                    )
                else:
                    existing.name = definition["name"]
                    existing.description = definition["description"]
                    existing.level = definition["level"]
                    existing.permissions_mask = definition["mask"]
                    existing.grants_all = definition["grants_all"]
            await sess.flush()
            AccessControlService.invalidate_cache()

            template_ids = {0, 2, 15}
            existing_templates = await sess.execute(
                select(DiagnosticTemplate).where(
                    DiagnosticTemplate.id.in_(template_ids)
                )
            )
            templates_map = {template.id: template for template in existing_templates.scalars()}
            for template_id in template_ids:
                if template_id in templates_map:
                    continue
                sess.add(
                    DiagnosticTemplate(
                        id=template_id,
                        slug=f"diagnostic-{template_id}",
                        title=f"Diagnostic {template_id}",
                        form_path=f"forms/diagnostic-{template_id}.json",
                        sort_order=template_id,
                    )
                )

        # Зафиксируем сиды до передачи сессии тесту, чтобы не оставлять
        # незавершённую транзакцию и не блокировать дальнейшие begin()
        await sess.commit()

        yield sess


@pytest.mark.asyncio
async def test_diagnostics_workflow(session):
    service = DiagnosticsService(session)

    async with session.begin():
        specialist = await service.create_specialist(
            login="coach@example.com",
            password="secret123",
            name="Coach",
            surname="Tester",
            available_diagnostics=[0, 2, 15],
        )
    assert specialist.diagnostics_enabled
    assert specialist.diagnostics_active
    assert specialist.diagnostics_available == [0, 2, 15]

    async with session.begin():
        authenticated = await service.authenticate_basic(
            login="coach@example.com", password="secret123"
        )
    assert authenticated and authenticated.id == specialist.id

    timestamp = int(time.time() * 1000)
    payload = {
        "manager_id": specialist.id,
        "name": "Client One",
        "email": "client@example.com",
        "phone": "+1-234-567",
        "new": True,
        "in_archive": False,
        "date": timestamp,
        "result": {
            "diagnostic-id": 2,
            "data": {"score": 42},
            "date": timestamp,
            "openAnswer": "Ready",
        },
    }

    async with session.begin():
        profile = await service.record_result(payload)
    assert profile.is_new is True
    assert profile.in_archive is False
    assert profile.user.email == "client@example.com"
    assert profile.last_result_at is not None

    async with session.begin():
        clients = await service.list_clients(specialist, include_all=False)
    assert len(clients) == 1
    client = clients[0]
    assert client.user.full_name == "Client One"
    assert client.results and client.results[0].payload["score"] == 42

    async with session.begin():
        await service.set_client_new(client, False)
    assert client.is_new is False

    async with session.begin():
        await service.toggle_client_archive(client)
    assert client.in_archive is True

    async with session.begin():
        stored = await service.get_client(client.id)
    assert stored is not None
    assert stored.results and stored.results[0].diagnostic_id == 2
    assert stored.results[0].open_answer == "Ready"
