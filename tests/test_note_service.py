import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from base import Base
from core.services.note_service import NoteService


@pytest_asyncio.fixture
async def session():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async_session = sessionmaker(
        engine, expire_on_commit=False, class_=AsyncSession
    )
    async with async_session() as sess:
        yield sess


@pytest.mark.asyncio
async def test_note_creation_and_listing(session):
    service = NoteService(session)
    note = await service.create_note(owner_id=1, content="Hello")
    assert note.id is not None
    notes = await service.list_notes(owner_id=1)
    assert len(notes) == 1
    assert notes[0].content == "Hello"


@pytest.mark.asyncio
async def test_list_notes_filters_by_owner(session):
    service = NoteService(session)
    await service.create_note(owner_id=1, content="A")
    await service.create_note(owner_id=2, content="B")
    notes_owner1 = await service.list_notes(owner_id=1)
    assert len(notes_owner1) == 1
    assert notes_owner1[0].content == "A"


@pytest.mark.asyncio
async def test_delete_note(session):
    service = NoteService(session)
    note = await service.create_note(owner_id=1, content="Temp")
    deleted = await service.delete_note(note.id)
    assert deleted is True
    assert await service.list_notes(owner_id=1) == []
