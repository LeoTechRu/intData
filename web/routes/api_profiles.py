from __future__ import annotations

from datetime import datetime
from typing import Any, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from core.models import WebUser
from core.services.profile_service import ProfileService, ProfileAccess
from web.dependencies import get_current_web_user

router = APIRouter(prefix="/profiles", tags=["profiles"])

EntityKind = Literal["users", "groups", "projects", "areas"]
AUDIENCE_VALUES = {"public", "authenticated", "user", "group", "project", "area"}

_TYPE_MAP = {
    "users": "user",
    "groups": "group",
    "projects": "project",
    "areas": "area",
}


class ProfileSection(BaseModel):
    id: str
    title: Optional[str] = None


class ProfileGrantPayload(BaseModel):
    audience_type: Literal["public", "authenticated", "user", "group", "project", "area"]
    subject_id: Optional[int] = Field(
        None,
        description="Target identifier (Web user ID, Telegram chat ID or Area/Project ID).",
    )
    sections: Optional[list[str]] = Field(
        default=None,
        description="Optional subset of section identifiers visible to this audience.",
    )
    expires_at: Optional[datetime] = None


class ProfileListItem(BaseModel):
    slug: str
    display_name: str
    headline: Optional[str] = None
    summary: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    sections: list[ProfileSection] = Field(default_factory=list)


class ProfileOut(ProfileListItem):
    profile_meta: dict[str, Any] = Field(default_factory=dict)
    tags: list[str] = Field(default_factory=list)
    grants: list[ProfileGrantPayload] = Field(default_factory=list)
    can_edit: bool = False
    is_owner: bool = False


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    headline: Optional[str] = None
    summary: Optional[str] = None
    avatar_url: Optional[str] = None
    cover_url: Optional[str] = None
    tags: Optional[list[str]] = None
    sections: Optional[list[dict[str, Any]]] = None
    profile_meta: Optional[dict[str, Any]] = None
    slug: Optional[str] = None


def _ensure_entity(entity: EntityKind) -> str:
    mapped = _TYPE_MAP.get(entity)
    if not mapped:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    return mapped


def _as_sections(access: ProfileAccess) -> list[ProfileSection]:
    sections: list[ProfileSection] = []
    for raw in access.sections:
        section_id = str(raw.get("id")) if isinstance(raw, dict) else str(raw)
        title = raw.get("title") if isinstance(raw, dict) else None
        sections.append(ProfileSection(id=section_id, title=title))
    return sections


def _profile_to_response(access: ProfileAccess, *, include_grants: bool = False) -> ProfileOut:
    profile = access.profile
    grants: list[ProfileGrantPayload] = []
    if include_grants:
        for grant in access.profile.grants:
            grants.append(
                ProfileGrantPayload(
                    audience_type=grant.audience_type,  # type: ignore[arg-type]
                    subject_id=grant.subject_id,
                    sections=list(grant.sections or []) if grant.sections else None,
                    expires_at=grant.expires_at,
                )
            )
    return ProfileOut(
        slug=profile.slug,
        display_name=profile.display_name,
        headline=profile.headline,
        summary=profile.summary,
        avatar_url=profile.avatar_url,
        cover_url=profile.cover_url,
        sections=_as_sections(access),
        profile_meta=profile.profile_meta or {},
        tags=list(profile.tags or []),
        grants=grants,
        can_edit=access.is_owner or access.is_admin,
        is_owner=access.is_owner,
    )


@router.get("/{entity}", response_model=list[ProfileListItem])
async def list_profiles(
    entity: EntityKind,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    search: Optional[str] = Query(None, min_length=2),
    current_user: Optional[WebUser] = Depends(get_current_web_user),
):
    entity_type = _ensure_entity(entity)
    async with ProfileService() as service:
        items = await service.list_catalog(
            entity_type=entity_type,
            viewer=current_user,
            limit=limit,
            offset=offset,
            search=search,
        )
    return [
        ProfileListItem(
            slug=access.profile.slug,
            display_name=access.profile.display_name,
            headline=access.profile.headline,
            summary=access.profile.summary,
            avatar_url=access.profile.avatar_url,
            cover_url=access.profile.cover_url,
            sections=_as_sections(access),
        )
        for access in items
    ]


@router.get("/{entity}/{slug}", response_model=ProfileOut)
async def get_profile(
    entity: EntityKind,
    slug: str,
    current_user: Optional[WebUser] = Depends(get_current_web_user),
):
    entity_type = _ensure_entity(entity)
    async with ProfileService() as service:
        try:
            access = await service.get_profile(
                entity_type=entity_type,
                slug=slug,
                viewer=current_user,
            )
        except ValueError as exc:  # profile not found
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    include_grants = access.is_owner or access.is_admin
    return _profile_to_response(access, include_grants=include_grants)


@router.put("/{entity}/{slug}", response_model=ProfileOut)
async def update_profile(
    entity: EntityKind,
    slug: str,
    payload: ProfileUpdate,
    current_user: Optional[WebUser] = Depends(get_current_web_user),
):
    entity_type = _ensure_entity(entity)
    async with ProfileService() as service:
        try:
            access = await service.get_profile(
                entity_type=entity_type,
                slug=slug,
                viewer=current_user,
                with_sections=False,
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
        if not (access.is_owner or access.is_admin):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
        try:
            updated = await service.update_profile_data(
                entity_type=entity_type,
                slug=slug,
                data=payload.dict(exclude_unset=True),
            )
            access.profile = updated
            await service.ensure_default_sections(updated)
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    include_grants = access.is_owner or access.is_admin
    access.sections = access.sections  # force existing sections usage
    return _profile_to_response(access, include_grants=include_grants)


@router.put("/{entity}/{slug}/grants", response_model=ProfileOut)
async def update_profile_grants(
    entity: EntityKind,
    slug: str,
    payload: list[ProfileGrantPayload],
    current_user: Optional[WebUser] = Depends(get_current_web_user),
):
    entity_type = _ensure_entity(entity)
    async with ProfileService() as service:
        try:
            access = await service.get_profile(
                entity_type=entity_type,
                slug=slug,
                viewer=current_user,
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
        except PermissionError:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
        if not (access.is_owner or access.is_admin):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
        grants_payload = [item.dict(exclude_unset=True) for item in payload]
        # Validate payload semantics manually for clarity
        for grant in grants_payload:
            audience = grant["audience_type"]
            if audience not in AUDIENCE_VALUES:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)
            if audience in {"public", "authenticated"} and grant.get("subject_id") is not None:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)
            if audience not in {"public", "authenticated"} and grant.get("subject_id") is None:
                raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY)
        await service.replace_grants(
            access.profile,
            grants_payload,
            actor=current_user,
        )
        await service.ensure_default_sections(access.profile)
        include_grants = True
        return _profile_to_response(access, include_grants=include_grants)


api = router
