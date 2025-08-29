from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from typing import Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from core.models import UserRole, WebUser
from core.services.app_settings_service import get_settings_by_prefix, upsert_settings
from web.dependencies import get_current_web_user, role_required

PERSONA_DEFAULTS: Dict[str, str] = {
    # RU defaults
    "ui.persona.single.label.ru": "Второй мозг",
    "ui.persona.single.tooltip_md.ru": "Ваш второй мозг — внешний контур памяти и обдумывания. [Что это?](https://trends.rbc.ru/trends/social/620393859a7947e531dafbcc)",
    "ui.persona.single.slogan.ru": "Работайте во «втором мозге».",
    "ui.persona.multiplayer.label.ru": "Коллективное сознание",
    "ui.persona.multiplayer.tooltip_md.ru": "Вы — часть общего знания.",
    "ui.persona.multiplayer.slogan.ru": "Собираем знание вместе.",
    "ui.persona.moderator.label.ru": "Хранитель знаний",
    "ui.persona.moderator.tooltip_md.ru": "Поддерживайте порядок и ясность.",
    "ui.persona.moderator.slogan.ru": "Помогаем команде понимать больше.",
    "ui.persona.admin.label.ru": "Архитектор системы",
    "ui.persona.admin.tooltip_md.ru": "Вы задаёте правила платформы.",
    "ui.persona.admin.slogan.ru": "Создавайте опоры для всей системы.",
    # EN minimal defaults
    "ui.persona.single.label.en": "Second Brain",
    "ui.persona.single.tooltip_md.en": "Your external memory and thinking. [What is it?](https://trends.rbc.ru/trends/social/620393859a7947e531dafbcc)",
    "ui.persona.single.slogan.en": "Work in your second brain.",
    "ui.persona.multiplayer.label.en": "Collective Mind",
    "ui.persona.multiplayer.tooltip_md.en": "You are part of shared knowledge.",
    "ui.persona.multiplayer.slogan.en": "Gather knowledge together.",
    "ui.persona.moderator.label.en": "Knowledge Keeper",
    "ui.persona.moderator.tooltip_md.en": "Maintain order and clarity.",
    "ui.persona.moderator.slogan.en": "Helping the team understand more.",
    "ui.persona.admin.label.en": "System Architect",
    "ui.persona.admin.tooltip_md.en": "You set the platform rules.",
    "ui.persona.admin.slogan.en": "Build foundations for the whole system.",
}

router = APIRouter(prefix="/api/v1", tags=["app-settings"])


class SettingsIn(BaseModel):
    entries: Dict[str, str]


def _apply_defaults(prefix: str, entries: Dict[str, str]) -> Dict[str, str]:
    merged = {
        k: v for k, v in PERSONA_DEFAULTS.items() if k.startswith(prefix)
    }
    merged.update(entries)
    return merged


@router.get("/app-settings", name="api:app_settings_get")
@router.get("/app-settings/")
async def api_get_settings(request: Request, prefix: str) -> Response:
    entries = await get_settings_by_prefix(prefix)
    entries = _apply_defaults(prefix, entries)
    entries_raw = json.dumps(entries, ensure_ascii=False, sort_keys=True)
    etag = hashlib.md5(entries_raw.encode()).hexdigest()
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304)
    payload = {"entries": entries, "ts": datetime.utcnow().isoformat()}
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    resp = Response(raw, media_type="application/json")
    resp.headers["ETag"] = etag
    return resp


@router.put(
    "/app-settings", name="api:app_settings_put", dependencies=[Depends(role_required(UserRole.admin))]
)
@router.put(
    "/app-settings/", dependencies=[Depends(role_required(UserRole.admin))], include_in_schema=False
)
async def api_put_settings(
    payload: SettingsIn,
    current_user: WebUser = Depends(get_current_web_user),
):
    link_re = re.compile(r"\[[^\]]+\]\((https?://[^)]+)\)")
    for key, value in payload.entries.items():
        if "<" in value or ">" in value or "javascript:" in value.lower():
            raise HTTPException(status_code=400, detail="HTML not allowed")
        if ".label." in key:
            limit = 40
        elif ".tooltip_md." in key:
            limit = 300
            stripped = link_re.sub("", value)
            if any(ch in stripped for ch in "[]()"):
                raise HTTPException(status_code=400, detail="Only markdown links allowed")
        else:
            limit = 140
        if len(value) > limit:
            raise HTTPException(status_code=400, detail="Value too long")
    updated_by: UUID | None = None
    if current_user:
        try:
            updated_by = UUID(int=current_user.id)
        except Exception:
            updated_by = None
    await upsert_settings(payload.entries, updated_by)
    return {"ok": True}
