import asyncio
from types import SimpleNamespace

import pytest

from core.models import WebUser, TgUser, Group
from web.routes.api import admin as admin_api


@pytest.mark.asyncio
async def test_admin_overview_serialization(monkeypatch):
    web_user = WebUser(id=1, username='alice', role='admin')
    web_user.full_name = 'Alice Admin'
    web_user.email = 'alice@example.com'
    tg_account = TgUser(id=11, telegram_id=42, username='alice42', role='admin')
    web_user.telegram_accounts = [tg_account]

    tg_user = TgUser(id=12, telegram_id=99, username='moderator', role='moderator')
    group = Group(id=7, telegram_id=777, title='Intelligent Crew')
    group.participants_count = 50

    async def fake_loader():
        return {
            'admin_users_web': [web_user],
            'admin_users_tg': [tg_user],
            'admin_groups': [{'group': group, 'members': [tg_user]}],
            'admin_roles': ['admin', 'moderator'],
            'admin_group_moderation': [
                {
                    'group': group,
                    'members': 50,
                    'active_members': 40,
                    'quiet_members': 5,
                    'unpaid_members': 3,
                    'last_activity': None,
                }
            ],
        }

    monkeypatch.setattr(admin_api, 'load_admin_console_data', fake_loader)

    payload = await admin_api.admin_overview(current_user=web_user)
    assert payload['users_web'][0]['username'] == 'alice'
    assert payload['users_tg'][0]['telegram_id'] == 99
    assert payload['groups'][0]['group']['title'] == 'Intelligent Crew'
    assert payload['group_moderation'][0]['members'] == 50
    assert 'admin' in payload['roles']
