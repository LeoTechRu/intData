import pytest
import pytest_asyncio

from core.services.app_settings_service import get_settings_by_prefix, upsert_settings
import core.db as db


@pytest_asyncio.fixture
async def db_setup(postgres_db):
    yield


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
