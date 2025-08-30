"""Google Calendar sync helpers."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode
import uuid

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.logger import logger
from core.models import GCalLink
from core.utils import utcnow

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
EVENTS_URL_TMPL = "https://www.googleapis.com/calendar/v3/calendars/{cal_id}/events"
WATCH_URL_TMPL = EVENTS_URL_TMPL + "/watch"
SCOPE = "https://www.googleapis.com/auth/calendar"


async def _refresh_if_needed(link: GCalLink, session: AsyncSession) -> GCalLink:
    from web.config import S

    if link.token_expiry and link.token_expiry > utcnow() + timedelta(minutes=1):
        return link
    data = {
        "client_id": S.GOOGLE_CLIENT_ID,
        "client_secret": S.GOOGLE_CLIENT_SECRET,
        "refresh_token": link.refresh_token,
        "grant_type": "refresh_token",
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(TOKEN_URL, data=data)
        resp.raise_for_status()
        payload = resp.json()
    link.access_token = payload["access_token"]
    expires_in = int(payload.get("expires_in", 3600))
    link.token_expiry = utcnow() + timedelta(seconds=expires_in)
    session.add(link)
    await session.commit()
    return link


def generate_auth_url(state: str, redirect_uri: str) -> str:
    from web.config import S

    params = {
        "client_id": S.GOOGLE_CLIENT_ID,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",
        "prompt": "consent",
        "state": state,
    }
    return f"{AUTH_URL}?{urlencode(params)}"


async def exchange_code(code: str, redirect_uri: str) -> dict[str, Any]:
    from web.config import S

    data = {
        "code": code,
        "client_id": S.GOOGLE_CLIENT_ID,
        "client_secret": S.GOOGLE_CLIENT_SECRET,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
    }
    async with httpx.AsyncClient() as client:
        resp = await client.post(TOKEN_URL, data=data)
        resp.raise_for_status()
        return resp.json()


async def save_link(
    user_id: str,
    google_calendar_id: str,
    token_data: dict[str, Any],
) -> GCalLink:
    async with db.async_session() as session:
        link = GCalLink(
            user_id=user_id,
            google_calendar_id=google_calendar_id,
            access_token=token_data["access_token"],
            refresh_token=token_data.get("refresh_token", ""),
            scope=token_data.get("scope", ""),
            token_expiry=utcnow() + timedelta(seconds=int(token_data.get("expires_in", 3600))),
        )
        session.add(link)
        await session.commit()
        await session.refresh(link)
        return link


async def get_link(user_id: str, calendar_id: str) -> GCalLink | None:
    async with db.async_session() as session:
        res = await session.execute(
            select(GCalLink).where(
                GCalLink.user_id == user_id,
                GCalLink.google_calendar_id == calendar_id,
            )
        )
        link = res.scalar_one_or_none()
        if not link:
            return None
        return await _refresh_if_needed(link, session)


async def initial(user_id: str, google_calendar_id: str) -> list[dict[str, Any]]:
    link = await get_link(user_id, google_calendar_id)
    if not link:
        raise ValueError("not linked")
    params = {
        "timeMin": (utcnow() - timedelta(days=60)).isoformat(),
        "timeMax": (utcnow() + timedelta(days=180)).isoformat(),
        "singleEvents": True,
        "showDeleted": True,
    }
    headers = {"Authorization": f"Bearer {link.access_token}"}
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            EVENTS_URL_TMPL.format(cal_id=google_calendar_id),
            params=params,
            headers=headers,
        )
        resp.raise_for_status()
        data = resp.json()
    async with db.async_session() as session:
        link.sync_token = data.get("nextSyncToken")
        session.add(link)
        await session.commit()
    items = data.get("items", [])
    logger.info("gcal initial sync: %s items", len(items))
    return items


async def incremental(user_id: str, google_calendar_id: str) -> list[dict[str, Any]]:
    link = await get_link(user_id, google_calendar_id)
    if not link or not link.sync_token:
        return await initial(user_id, google_calendar_id)
    params = {
        "syncToken": link.sync_token,
        "singleEvents": True,
        "showDeleted": True,
    }
    headers = {"Authorization": f"Bearer {link.access_token}"}
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            EVENTS_URL_TMPL.format(cal_id=google_calendar_id),
            params=params,
            headers=headers,
        )
    if resp.status_code == 410:
        logger.warning("gcal sync token expired, resyncing")
        return await initial(user_id, google_calendar_id)
    resp.raise_for_status()
    data = resp.json()
    async with db.async_session() as session:
        link.sync_token = data.get("nextSyncToken")
        session.add(link)
        await session.commit()
    items = data.get("items", [])
    logger.info("gcal incremental sync: %s items", len(items))
    return items


async def start_watch(link: GCalLink) -> None:
    from web.config import S

    body = {
        "id": link.channel_id or str(uuid.uuid4()),
        "type": "webhook",
        "address": S.GCAL_WEBHOOK_URL,
    }
    headers = {"Authorization": f"Bearer {link.access_token}"}
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            WATCH_URL_TMPL.format(cal_id=link.google_calendar_id), json=body, headers=headers
        )
        resp.raise_for_status()
        payload = resp.json()
    link.channel_id = payload.get("id")
    link.resource_id = payload.get("resourceId")
    exp = payload.get("expiration")
    if exp:
        link.channel_expiry = datetime.fromtimestamp(int(exp) / 1000, tz=timezone.utc)
    async with db.async_session() as session:
        session.add(link)
        await session.commit()
