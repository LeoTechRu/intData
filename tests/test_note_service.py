import pytest
import pytest_asyncio

from core.services.note_service import NoteService
from core.models import Area
from tests.utils.seeds import ensure_tg_user


@pytest_asyncio.fixture
async def session(postgres_db):
    engine, session_factory = postgres_db
    async with session_factory() as sess:
        yield sess


@pytest.mark.asyncio
async def test_note_creation_and_listing(session):
    service = NoteService(session)
    await ensure_tg_user(session, 1)
    area = Area(owner_id=1, name="Inbox")
    session.add(area)
    await session.flush()
    note = await service.create_note(owner_id=1, content="Hello", area_id=area.id)
    assert note.id is not None
    notes = await service.list_notes(owner_id=1)
    assert len(notes) == 1
    assert notes[0].content == "Hello"


@pytest.mark.asyncio
async def test_list_notes_filters_by_owner(session):
    service = NoteService(session)
    await ensure_tg_user(session, 1)
    await ensure_tg_user(session, 2)
    a1 = Area(owner_id=1, name="A1")
    a2 = Area(owner_id=2, name="A2")
    session.add_all([a1, a2])
    await session.flush()
    await service.create_note(owner_id=1, content="A", area_id=a1.id)
    await service.create_note(owner_id=2, content="B", area_id=a2.id)
    notes_owner1 = await service.list_notes(owner_id=1)
    assert len(notes_owner1) == 1
    assert notes_owner1[0].content == "A"


@pytest.mark.asyncio
async def test_delete_note(session):
    service = NoteService(session)
    await ensure_tg_user(session, 1)
    area = Area(owner_id=1, name="X")
    session.add(area)
    await session.flush()
    note = await service.create_note(owner_id=1, content="Temp", area_id=area.id)
    deleted = await service.delete_note(note.id)
    assert deleted is True
    assert await service.list_notes(owner_id=1) == []


@pytest.mark.asyncio
async def test_update_note(session):
    service = NoteService(session)
    await ensure_tg_user(session, 1)
    area = Area(owner_id=1, name="Z")
    session.add(area)
    await session.flush()
    note = await service.create_note(owner_id=1, content="Old", area_id=area.id)
    updated = await service.update_note(note.id, content="New")
    assert updated is not None
    assert updated.content == "New"


@pytest.mark.asyncio
async def test_pin_archive_reorder(session):
    service = NoteService(session)
    await ensure_tg_user(session, 1)
    area = Area(owner_id=1, name="R")
    session.add(area)
    await session.flush()
    n1 = await service.create_note(owner_id=1, content="A", area_id=area.id)
    n2 = await service.create_note(owner_id=1, content="B", area_id=area.id)
    await service.update_note(n1.id, pinned=True)
    pinned = await service.list_notes(owner_id=1, pinned=True)
    assert [n.id for n in pinned] == [n1.id]
    await service.archive(n1.id, owner_id=1)
    archived = await service.list_notes(owner_id=1, archived=True)
    assert [n.id for n in archived] == [n1.id]
    await service.unarchive(n1.id, owner_id=1)
    await service.update_note(n1.id, pinned=False)
    await service.reorder(owner_id=1, area_id=area.id, project_id=None, ids=[n2.id, n1.id])
    ordered = await service.list_notes(owner_id=1)
    assert [n.id for n in ordered] == [n2.id, n1.id]
