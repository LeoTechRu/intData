from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Dict
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from core.models import UserRole, WebUser
from core.services.app_settings_service import get_settings_by_prefix, upsert_settings
from web.dependencies import get_current_web_user, role_required

PERSONA_DEFAULTS: Dict[str, str] = {
    "ui.persona.personal_brain.label.ru": "Личный мозг",
    "ui.persona.personal_brain.tooltip.ru": "Пространство вашего разума.",
    "ui.persona.personal_brain.slogan.ru": "Работайте в своём втором мозге.",
    "ui.persona.collective_consciousness.label.ru": "Коллективное сознание",
    "ui.persona.collective_consciousness.tooltip.ru": "Вы — часть общего знания.",
    "ui.persona.collective_consciousness.slogan.ru": "Собираем знания вместе.",
    "ui.persona.knowledge_keeper.label.ru": "Хранитель знаний",
    "ui.persona.knowledge_keeper.tooltip.ru": "Поддерживайте порядок и ясность.",
    "ui.persona.knowledge_keeper.slogan.ru": "Помогаем команде понимать больше.",
    "ui.persona.system_architect.label.ru": "Архитектор системы",
    "ui.persona.system_architect.tooltip.ru": "Вы задаёте правила системы.",
    "ui.persona.system_architect.slogan.ru": "Создавайте опоры для платформы.",
    # English minimum
    "ui.persona.personal_brain.label.en": "Personal Brain",
    "ui.persona.personal_brain.tooltip.en": "Your space of thought.",
    "ui.persona.personal_brain.slogan.en": "Work in your second brain.",
    "ui.persona.collective_consciousness.label.en": "Collective Consciousness",
    "ui.persona.collective_consciousness.tooltip.en": "You are part of shared knowledge.",
    "ui.persona.collective_consciousness.slogan.en": "Gathering knowledge together.",
    "ui.persona.knowledge_keeper.label.en": "Knowledge Keeper",
    "ui.persona.knowledge_keeper.tooltip.en": "Maintain order and clarity.",
    "ui.persona.knowledge_keeper.slogan.en": "Helping the team understand more.",
    "ui.persona.system_architect.label.en": "System Architect",
    "ui.persona.system_architect.tooltip.en": "You define the system rules.",
    "ui.persona.system_architect.slogan.en": "Build the platform's foundations.",
}

router = APIRouter(prefix="/api/v1/app-settings", tags=["app-settings"])


class SettingsIn(BaseModel):
    entries: Dict[str, str]


def _apply_defaults(prefix: str, entries: Dict[str, str]) -> Dict[str, str]:
    merged = {
        k: v for k, v in PERSONA_DEFAULTS.items() if k.startswith(prefix)
    }
    merged.update(entries)
    return merged


@router.get("", name="api:app_settings_get")
async def api_get_settings(request: Request, prefix: str) -> Response:
    entries = await get_settings_by_prefix(prefix)
    entries = _apply_defaults(prefix, entries)
    payload = {"entries": entries, "ts": datetime.utcnow().isoformat()}
    raw = json.dumps(payload, ensure_ascii=False, sort_keys=True)
    etag = hashlib.md5(raw.encode()).hexdigest()
    if request.headers.get("if-none-match") == etag:
        return Response(status_code=304)
    resp = Response(raw, media_type="application/json")
    resp.headers["ETag"] = etag
    return resp


@router.put(
    "", name="api:app_settings_put", dependencies=[Depends(role_required(UserRole.admin))]
)
async def api_put_settings(
    payload: SettingsIn,
    current_user: WebUser = Depends(get_current_web_user),
):
    for key, value in payload.entries.items():
        if any(ch in value for ch in "<>&"):
            raise HTTPException(status_code=400, detail="HTML not allowed")
        limit = 40 if ".label." in key else 140
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
