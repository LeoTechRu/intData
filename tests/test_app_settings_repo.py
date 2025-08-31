import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

from core.services.app_settings_service import get_settings_by_prefix, upsert_settings
import core.db as db


@pytest_asyncio.fixture
async def db_setup():
    engine = create_async_engine('sqlite+aiosqlite:///:memory:?cache=shared')
    async_session = sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
    db.engine = engine
    db.async_session = async_session
    yield
    await engine.dispose()


@pytest.mark.asyncio
async def test_upsert_and_get(db_setup):
    settings = await get_settings_by_prefix('ui.persona.test')
    assert settings == {}
    await upsert_settings({'ui.persona.test.label.ru': 'X'}, None)
    settings = await get_settings_by_prefix('ui.persona.test')
    assert settings['ui.persona.test.label.ru'] == 'X'
    await upsert_settings({'ui.persona.test.label.ru': 'Y'}, None)
    settings = await get_settings_by_prefix('ui.persona.test')
    assert settings['ui.persona.test.label.ru'] == 'Y'
