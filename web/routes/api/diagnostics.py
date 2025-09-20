from __future__ import annotations

import json
from typing import Any, Dict, List, Optional
from urllib.parse import parse_qsl

from fastapi import APIRouter, Depends, HTTPException, Request, status

from core.models import DiagnosticClient, DiagnosticResult, WebUser
from core.services.diagnostics_service import DiagnosticsService
from web.dependencies import get_current_web_user

router = APIRouter(tags=["diagnostics"])

async def _get_actor(
    current_user: Optional[WebUser] = Depends(get_current_web_user),
) -> WebUser:
    if not current_user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    if not current_user.diagnostics_enabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Diagnostics access is disabled",
        )
    if not current_user.diagnostics_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Diagnostics access is inactive",
        )
    return current_user


def _split_name(full_name: Optional[str]) -> tuple[str, str]:
    if not full_name:
        return "", ""
    parts = full_name.strip().split()
    if not parts:
        return "", ""
    if len(parts) == 1:
        return parts[0], ""
    return parts[0], " ".join(parts[1:])


def _ts(value: Optional[Any]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value.timestamp() * 1000)
    except Exception:  # pragma: no cover - defensive
        return None


def _result_payload(result: DiagnosticResult) -> Dict[str, Any]:
    return {
        "date": _ts(result.submitted_at),
        "diagnostic-id": result.diagnostic_id,
        "data": result.payload or {},
        "openAnswer": result.open_answer,
    }


def _client_payload(client: DiagnosticClient) -> Dict[str, Any]:
    user = client.user
    name = user.full_name if user else ""
    first, last = _split_name(name)
    results = sorted(client.results or [], key=lambda r: r.submitted_at)
    result_payloads = [_result_payload(res) for res in results]
    latest = result_payloads[-1] if result_payloads else None
    return {
        "id": client.id,
        "manager_id": client.specialist_id,
        "name": first or name,
        "surname": last,
        "email": user.email if user else None,
        "phone": user.phone if user else None,
        "new": bool(client.is_new),
        "in_archive": bool(client.in_archive),
        "results": result_payloads,
        "result": latest,
        "date": _ts(client.last_result_at),
        "contact_permission": client.contact_permission,
    }


@router.get("/login")
async def diagnostics_login(
    actor: WebUser = Depends(_get_actor),
) -> Dict[str, Any]:
    async with DiagnosticsService() as service:
        is_admin = await service.is_admin(actor)
    first, last = _split_name(actor.full_name)
    return {
        "id": actor.id,
        "login": actor.username,
        "name": first,
        "surname": last,
        "phone": actor.phone,
        "is_admin": is_admin,
        "is_active": actor.diagnostics_active,
        "available_diagnostics": list(actor.diagnostics_available or []),
    }


@router.get("/manager")
async def get_manager(actor: WebUser = Depends(_get_actor)) -> Dict[str, Any]:
    return await diagnostics_login(actor)


class ManagerUpdatePayload(dict):
    id: int
    login: Optional[str]
    password: Optional[str]
    name: Optional[str]
    surname: Optional[str]
    phone: Optional[str]
    available_diagnostics: Optional[List[int]]


async def _load_manager_payload(data: Dict[str, Any]) -> ManagerUpdatePayload:
    payload = ManagerUpdatePayload()
    for key in ("id", "login", "password", "name", "surname", "phone", "available_diagnostics"):
        if key in data:
            payload[key] = data[key]
    if "id" not in payload:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Missing id")
    try:
        payload["id"] = int(payload["id"])
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid id") from None
    if "available_diagnostics" in payload and payload["available_diagnostics"] is not None:
        payload["available_diagnostics"] = [int(x) for x in payload["available_diagnostics"]]
    return payload


@router.put("/manager")
async def update_manager(
    request: Request,
    actor: WebUser = Depends(_get_actor),
) -> Dict[str, Any]:
    data = await request.json()
    payload = await _load_manager_payload(data)
    if actor.id != payload["id"]:
        async with DiagnosticsService() as service:
            if not await service.is_admin(actor):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
            target = await service.get_specialist(payload["id"])
            if not target:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager not found")
            await service.update_specialist(
                target,
                login=payload.get("login"),
                password=payload.get("password"),
                name=payload.get("name"),
                surname=payload.get("surname"),
                phone=payload.get("phone"),
                available_diagnostics=payload.get("available_diagnostics"),
            )
            return {"success": True}
    async with DiagnosticsService() as service:
        await service.update_specialist(
            actor,
            login=payload.get("login"),
            password=payload.get("password"),
            name=payload.get("name"),
            surname=payload.get("surname"),
            phone=payload.get("phone"),
            available_diagnostics=payload.get("available_diagnostics"),
        )
    return {"success": True}


@router.get("/managers")
async def list_managers(actor: WebUser = Depends(_get_actor)) -> Dict[str, Any]:
    async with DiagnosticsService() as service:
        if not await service.has_permission(actor, "diagnostics.specialists.manage"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        specialists = await service.list_specialists()
        items = []
        for spec in specialists:
            first, last = _split_name(spec.full_name)
            is_admin = await service.is_admin(spec)
            items.append(
                {
                    "id": spec.id,
                    "login": spec.username,
                    "name": first,
                    "surname": last,
                    "phone": spec.phone,
                    "is_admin": is_admin,
                    "is_active": spec.diagnostics_active,
                    "available_diagnostics": list(spec.diagnostics_available or []),
                }
            )
        return {"data": items}


@router.post("/manager/add")
async def add_manager(
    request: Request,
    actor: WebUser = Depends(_get_actor),
) -> Dict[str, Any]:
    data = await request.json()
    async with DiagnosticsService() as service:
        if not await service.has_permission(actor, "diagnostics.specialists.manage"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        login = (data.get("login") or "").strip()
        password = (data.get("password") or "").strip()
        if not login or not password:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Login and password are required")
        name = data.get("name")
        surname = data.get("surname")
        phone = data.get("phone")
        available = data.get("available_diagnostics") or []
        await service.create_specialist(
            login=login,
            password=password,
            name=name,
            surname=surname,
            phone=phone,
            available_diagnostics=available,
            actor_user_id=actor.id,
        )
    return {"success": True}


@router.put("/manager/is-active/{manager_id}")
async def toggle_manager_active(
    manager_id: int,
    actor: WebUser = Depends(_get_actor),
) -> Dict[str, Any]:
    async with DiagnosticsService() as service:
        if not await service.has_permission(actor, "diagnostics.specialists.manage"):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        target = await service.get_specialist(manager_id)
        if not target:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Manager not found")
        try:
            await service.toggle_specialist_active(target)
        except ValueError as exc:  # cannot deactivate admin
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    return {"success": True}


async def _check_client_permissions(
    client: DiagnosticClient,
    actor: WebUser,
    service: DiagnosticsService,
) -> None:
    if client.specialist_id == actor.id:
        return
    if await service.has_permission(actor, "diagnostics.specialists.manage"):
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")


@router.get("/clients")
async def list_clients(actor: WebUser = Depends(_get_actor)) -> Any:
    async with DiagnosticsService() as service:
        include_all = await service.has_permission(actor, "diagnostics.specialists.manage")
        clients = await service.list_clients(actor, include_all=include_all)
        return [_client_payload(client) for client in clients]


@router.get("/client/{client_id}")
async def get_client(client_id: int, actor: WebUser = Depends(_get_actor)) -> Dict[str, Any]:
    async with DiagnosticsService() as service:
        client = await service.get_client(client_id)
        if not client:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
        await _check_client_permissions(client, actor, service)
        return _client_payload(client)


async def _load_client_payload(request: Request) -> Dict[str, Any]:
    try:
        return await request.json()
    except Exception:
        raw = (await request.body()).decode("utf-8")
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except Exception:
            parsed: Dict[str, Any] = {}
            for key, value in parse_qsl(raw, keep_blank_values=True):
                parsed[key] = value
            return parsed


@router.post("/client/is-new")
async def mark_client_checked(
    request: Request,
    actor: WebUser = Depends(_get_actor),
) -> Dict[str, Any]:
    data = await _load_client_payload(request)
    client_id = data.get("id")
    try:
        client_id = int(client_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid id") from None
    async with DiagnosticsService() as service:
        client = await service.get_client(client_id, include_results=False)
        if not client:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
        await _check_client_permissions(client, actor, service)
        await service.set_client_new(client, False)
    return {"success": True}


@router.post("/client/is-archive")
async def toggle_client_archive(
    request: Request,
    actor: WebUser = Depends(_get_actor),
) -> Dict[str, Any]:
    data = await _load_client_payload(request)
    client_id = data.get("id")
    try:
        client_id = int(client_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid id") from None
    async with DiagnosticsService() as service:
        client = await service.get_client(client_id, include_results=False)
        if not client:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Client not found")
        await _check_client_permissions(client, actor, service)
        await service.toggle_client_archive(client)
    return {"success": True}


@router.post("/client/result")
async def submit_client_result(request: Request) -> Dict[str, Any]:
    data = await _load_client_payload(request)
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty payload")
    async with DiagnosticsService() as service:
        try:
            await service.record_result(data)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    return {"success": True}


__all__ = ["router"]
