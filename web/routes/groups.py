from __future__ import annotations

from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Path,
    Query,
    Request,
    status,
)
from pydantic import BaseModel, Field

from core.db import bot
from core.models import Group, Product, ProductStatus, TgUser, UserRole, WebUser
from core.services.crm_service import CRMService
from core.services.group_moderation_service import GroupModerationService
from core.services.telegram_user_service import TelegramUserService
from core.utils import utcnow
from web.dependencies import get_current_web_user, role_required
from ..template_env import templates

router = APIRouter(prefix="/groups", tags=["groups"])
ui_router = APIRouter(prefix="/groups", tags=["groups"], include_in_schema=False)


def _format_display_name(user: TgUser | None) -> str:
    if not user:
        return "Неизвестно"
    if user.username:
        return f"@{user.username}"
    full = f"{user.first_name or ''} {user.last_name or ''}".strip()
    return full or str(user.telegram_id)


class ActivityOut(BaseModel):
    messages: int = 0
    reactions: int = 0
    last_activity: Optional[datetime] = None


class ProductSummary(BaseModel):
    id: int
    slug: str
    title: str
    active: bool
    buyers: int = 0
    total_members: int = 0


class MemberProductOut(BaseModel):
    product_id: int
    product_slug: str
    product_title: str
    status: ProductStatus
    source: Optional[str] = None
    acquired_at: Optional[datetime] = None
    notes: Optional[str] = None


class GroupMemberOut(BaseModel):
    telegram_id: int
    username: Optional[str] = None
    display_name: str
    is_owner: bool = False
    is_moderator: bool = False
    crm_notes: Optional[str] = None
    crm_tags: List[str] = Field(default_factory=list)
    trial_expires_at: Optional[datetime] = None
    products: List[MemberProductOut] = Field(default_factory=list)
    activity: ActivityOut = Field(default_factory=ActivityOut)


class LeaderboardEntry(BaseModel):
    user_id: int
    display_name: str
    messages: int
    reactions: int
    last_activity: Optional[datetime] = None


class RemovalLogEntry(BaseModel):
    id: int
    user_id: int
    display_name: str
    product_id: Optional[int] = None
    product_slug: Optional[str] = None
    product_title: Optional[str] = None
    result: str
    reason: Optional[str] = None
    created_at: datetime


class GroupInfoOut(BaseModel):
    telegram_id: int
    title: str
    description: Optional[str] = None
    participants_count: int = 0


class GroupDetailResponse(BaseModel):
    group: GroupInfoOut
    members: List[GroupMemberOut]
    products: List[ProductSummary]
    leaderboard: List[LeaderboardEntry]
    removal_history: List[RemovalLogEntry]


class GroupMemberProfileUpdate(BaseModel):
    notes: Optional[str] = None
    trial_expires_at: Optional[datetime] = None
    tags: Optional[List[str]] = None


class AssignProductRequest(BaseModel):
    product_slug: str
    status: ProductStatus = ProductStatus.paid
    source: Optional[str] = None
    notes: Optional[str] = None


class AssignProductResponse(BaseModel):
    user_id: int
    product_id: int
    status: ProductStatus


class RemoveProductResponse(BaseModel):
    removed: bool


class GroupPruneRequest(BaseModel):
    product_slug: Optional[str] = None
    product_id: Optional[int] = None
    dry_run: bool = False
    reason: Optional[str] = None


class PruneMember(BaseModel):
    user_id: int
    display_name: str


class FailedPruneMember(PruneMember):
    error: str


class GroupPruneResponse(BaseModel):
    dry_run: bool
    product_id: int
    product_slug: str
    removed: List[PruneMember] = Field(default_factory=list)
    failed: List[FailedPruneMember] = Field(default_factory=list)
    candidates: List[PruneMember] = Field(default_factory=list)
    total_candidates: int


async def _ensure_group_access(
    *,
    group_id: int,
    current_user: WebUser,
    service: TelegramUserService,
) -> tuple[TgUser, Group]:
    if not current_user.telegram_accounts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Свяжите Telegram-аккаунт для управления группами.",
        )
    tg_user = current_user.telegram_accounts[0]
    group = await service.get_group_by_telegram_id(group_id)
    if not group:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
    is_member = await service.is_user_in_group(tg_user.telegram_id, group_id)
    if not is_member and group.owner_id != tg_user.telegram_id:
        if UserRole[current_user.role] < UserRole.admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN)
    return tg_user, group


async def _collect_group_detail(
    *,
    group: Group,
    crm: CRMService,
    moderation: GroupModerationService,
    service: TelegramUserService,
    days: int,
) -> GroupDetailResponse:
    since_date = utcnow().date() - timedelta(days=days)
    roster = await moderation.list_group_members(group.telegram_id, since=since_date)
    products = await crm.list_products(active_only=False)
    product_map: Dict[int, Product] = {p.id: p for p in products}
    buyers_map: Dict[int, int] = {p.id: 0 for p in products}

    members_out: List[GroupMemberOut] = []
    for entry in roster:
        user: TgUser = entry["user"]
        membership = entry["membership"]
        activity = entry["activity"]
        product_links = entry["products"]
        products_out: List[MemberProductOut] = []
        for link in product_links:
            prod = product_map.get(link.product_id)
            if prod:
                if link.status == ProductStatus.paid:
                    buyers_map[prod.id] = buyers_map.get(prod.id, 0) + 1
                products_out.append(
                    MemberProductOut(
                        product_id=prod.id,
                        product_slug=prod.slug,
                        product_title=prod.title,
                        status=link.status,
                        source=link.source,
                        acquired_at=link.acquired_at,
                        notes=link.notes,
                    )
                )
        members_out.append(
            GroupMemberOut(
                telegram_id=user.telegram_id,
                username=user.username,
                display_name=_format_display_name(user),
                is_owner=membership.is_owner,
                is_moderator=membership.is_moderator,
                crm_notes=membership.crm_notes,
                crm_tags=list(membership.crm_tags or []),
                trial_expires_at=membership.trial_expires_at,
                products=products_out,
                activity=ActivityOut(
                    messages=activity.messages,
                    reactions=activity.reactions,
                    last_activity=activity.last_activity,
                ),
            )
        )

    leaderboard_raw = await moderation.activity_leaderboard(
        group.telegram_id, since=since_date, limit=10
    )
    leaderboard: List[LeaderboardEntry] = []
    for row in leaderboard_raw:
        user = row.get("user")
        leaderboard.append(
            LeaderboardEntry(
                user_id=row.get("user_id"),
                display_name=_format_display_name(user) if user else str(row.get("user_id")),
                messages=row.get("messages", 0),
                reactions=row.get("reactions", 0),
                last_activity=row.get("last_activity"),
            )
        )

    history = await moderation.removal_history(group.telegram_id)
    user_cache: Dict[int, TgUser] = {
        member.telegram_id: entry["user"]
        for member, entry in zip(members_out, roster)
    }
    logs: List[RemovalLogEntry] = []
    for record in history:
        user = user_cache.get(record.user_id)
        if not user:
            user = await service.get_user_by_telegram_id(record.user_id)
            if user:
                user_cache[record.user_id] = user
        product = product_map.get(record.product_id) if record.product_id else None
        logs.append(
            RemovalLogEntry(
                id=record.id,
                user_id=record.user_id,
                display_name=_format_display_name(user) if user else str(record.user_id),
                product_id=record.product_id,
                product_slug=product.slug if product else None,
                product_title=product.title if product else None,
                result=record.result,
                reason=record.reason,
                created_at=record.created_at,
            )
        )

    products_out = [
        ProductSummary(
            id=p.id,
            slug=p.slug,
            title=p.title,
            active=p.active,
            buyers=buyers_map.get(p.id, 0),
            total_members=len(members_out),
        )
        for p in products
    ]

    return GroupDetailResponse(
        group=GroupInfoOut(
            telegram_id=group.telegram_id,
            title=group.title,
            description=group.description,
            participants_count=group.participants_count or len(members_out),
        ),
        members=members_out,
        products=products_out,
        leaderboard=leaderboard,
        removal_history=logs,
    )


@router.get("", response_model=List[GroupInfoOut])
async def list_groups(
    current_user: WebUser = Depends(role_required(UserRole.moderator)),
):
    if not current_user.telegram_accounts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Свяжите Telegram-аккаунт для управления группами.",
        )
    tg_user = current_user.telegram_accounts[0]
    async with TelegramUserService() as service:
        groups = await service.list_user_groups(tg_user.telegram_id)
    return [
        GroupInfoOut(
            telegram_id=g.telegram_id,
            title=g.title,
            description=g.description,
            participants_count=g.participants_count or 0,
        )
        for g in groups
    ]


@router.get("/{group_id}", response_model=GroupDetailResponse)
async def get_group_detail(
    group_id: int = Path(..., description="Telegram chat ID"),
    days: int = Query(30, ge=1, le=365),
    current_user: WebUser = Depends(role_required(UserRole.moderator)),
):
    async with TelegramUserService() as service:
        _, group = await _ensure_group_access(
            group_id=group_id, current_user=current_user, service=service
        )
        crm = CRMService(service.session)
        moderation = GroupModerationService(service.session, crm=crm)
        return await _collect_group_detail(
            group=group,
            crm=crm,
            moderation=moderation,
            service=service,
            days=days,
        )


@router.put(
    "/{group_id}/members/{user_id}/profile",
    response_model=GroupMemberOut,
)
async def update_member_profile(
    payload: GroupMemberProfileUpdate,
    group_id: int,
    user_id: int,
    current_user: WebUser = Depends(role_required(UserRole.moderator)),
):
    async with TelegramUserService() as service:
        _, group = await _ensure_group_access(
            group_id=group_id, current_user=current_user, service=service
        )
        moderation = GroupModerationService(service.session)
        updated = await moderation.update_member_profile(
            group_id=group.telegram_id,
            user_id=user_id,
            notes=payload.notes,
            trial_expires_at=payload.trial_expires_at,
            tags=payload.tags,
        )
        if not updated:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        crm = moderation.crm
        detail = await _collect_group_detail(
            group=group,
            crm=crm,
            moderation=moderation,
            service=service,
            days=30,
        )
        member = next(
            (m for m in detail.members if m.telegram_id == user_id), None
        )
        if not member:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        return member


@router.post(
    "/{group_id}/members/{user_id}/products",
    response_model=AssignProductResponse,
    status_code=status.HTTP_201_CREATED,
)
async def assign_product_to_member(
    payload: AssignProductRequest,
    group_id: int,
    user_id: int,
    current_user: WebUser = Depends(role_required(UserRole.moderator)),
):
    async with TelegramUserService() as service:
        _, group = await _ensure_group_access(
            group_id=group_id, current_user=current_user, service=service
        )
        if not await service.is_user_in_group(user_id, group.telegram_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        crm = CRMService(service.session)
        product = await crm.ensure_product(
            slug=payload.product_slug,
            title=payload.product_slug.replace("_", " ").title(),
        )
        await crm.assign_product(
            user_id=user_id,
            product_id=product.id,
            status=payload.status,
            source=payload.source,
            notes=payload.notes,
        )
        return AssignProductResponse(
            user_id=user_id,
            product_id=product.id,
            status=payload.status,
        )


@router.delete(
    "/{group_id}/members/{user_id}/products/{product_id}",
    response_model=RemoveProductResponse,
)
async def remove_product_from_member(
    group_id: int,
    user_id: int,
    product_id: int,
    current_user: WebUser = Depends(role_required(UserRole.moderator)),
):
    async with TelegramUserService() as service:
        _, group = await _ensure_group_access(
            group_id=group_id, current_user=current_user, service=service
        )
        if not await service.is_user_in_group(user_id, group.telegram_id):
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND)
        crm = CRMService(service.session)
        removed = await crm.revoke_product(user_id=user_id, product_id=product_id)
        return RemoveProductResponse(removed=removed)


@router.post(
    "/{group_id}/prune",
    response_model=GroupPruneResponse,
)
async def prune_group_members(
    payload: GroupPruneRequest,
    group_id: int,
    current_user: WebUser = Depends(role_required(UserRole.moderator)),
):
    async with TelegramUserService() as service:
        tg_user, group = await _ensure_group_access(
            group_id=group_id, current_user=current_user, service=service
        )
        crm = CRMService(service.session)
        moderation = GroupModerationService(service.session, crm=crm)
        product: Optional[Product] = None
        if payload.product_id:
            product = await service.session.get(Product, payload.product_id)
        elif payload.product_slug:
            product = await crm.get_product_by_slug(payload.product_slug)
        if not product:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Продукт не найден")

        members = await moderation.list_group_members(group.telegram_id)
        member_map = {entry["membership"].user_id: entry["user"] for entry in members}
        candidates_links = await moderation.members_without_product(
            group_id=group.telegram_id, product_id=product.id
        )
        candidates: List[PruneMember] = [
            PruneMember(
                user_id=link.user_id,
                display_name=_format_display_name(member_map.get(link.user_id)),
            )
            for link in candidates_links
        ]

        if payload.dry_run:
            return GroupPruneResponse(
                dry_run=True,
                product_id=product.id,
                product_slug=product.slug,
                candidates=candidates,
                total_candidates=len(candidates),
            )

        removed: List[PruneMember] = []
        failed: List[FailedPruneMember] = []
        # Telegram requires ban+unban for graceful kick allowing rejoin later
        for link in candidates_links:
            display_name = _format_display_name(member_map.get(link.user_id))
            try:
                await bot.ban_chat_member(group.telegram_id, link.user_id)
                await bot.unban_chat_member(group.telegram_id, link.user_id)
                await service.remove_user_from_group(link.user_id, group.telegram_id)
                await moderation.log_removal(
                    group_id=group.telegram_id,
                    user_id=link.user_id,
                    product_id=product.id,
                    initiator_web_id=current_user.id,
                    initiator_tg_id=tg_user.telegram_id,
                    reason=payload.reason or "auto-prune",
                    result="removed",
                    details=None,
                )
                removed.append(
                    PruneMember(user_id=link.user_id, display_name=display_name)
                )
            except Exception as exc:  # pragma: no cover - Telegram errors
                await moderation.log_removal(
                    group_id=group.telegram_id,
                    user_id=link.user_id,
                    product_id=product.id,
                    initiator_web_id=current_user.id,
                    initiator_tg_id=tg_user.telegram_id,
                    reason=payload.reason or "auto-prune",
                    result="failed",
                    details={"error": str(exc)},
                )
                failed.append(
                    FailedPruneMember(
                        user_id=link.user_id,
                        display_name=display_name,
                        error=str(exc),
                    )
                )

        return GroupPruneResponse(
            dry_run=False,
            product_id=product.id,
            product_slug=product.slug,
            removed=removed,
            failed=failed,
            total_candidates=len(candidates_links),
        )


@ui_router.get("")
async def groups_overview(
    request: Request,
    current_user: WebUser | None = Depends(get_current_web_user),
):
    groups: List[Group] = []
    if current_user and current_user.telegram_accounts:
        tg_user = current_user.telegram_accounts[0]
        async with TelegramUserService() as service:
            groups = await service.list_user_groups(tg_user.telegram_id)
    context = {
        "current_user": current_user,
        "current_role_name": getattr(current_user, "role", ""),
        "is_admin": bool(current_user and current_user.role == UserRole.admin.name),
        "page_title": "Телеграм‑группы",
        "groups": groups,
        "MODULE_TITLE": "Телеграм‑группы",
    }
    return templates.TemplateResponse(request, "groups/index.html", context)


@ui_router.get("/{group_id}")
async def group_detail_page(
    request: Request,
    group_id: int,
    current_user: WebUser = Depends(role_required(UserRole.moderator)),
):
    async with TelegramUserService() as service:
        _, group = await _ensure_group_access(
            group_id=group_id, current_user=current_user, service=service
        )
        crm = CRMService(service.session)
        moderation = GroupModerationService(service.session, crm=crm)
        detail = await _collect_group_detail(
            group=group,
            crm=crm,
            moderation=moderation,
            service=service,
            days=30,
        )
    context = {
        "current_user": current_user,
        "current_role_name": current_user.role,
        "is_admin": True,
        "page_title": f"Группа: {detail.group.title}",
        "group_detail": detail,
        "MODULE_TITLE": f"Группа: {detail.group.title}",
        "MODULE_TITLE_TOOLTIP": "CRM по участникам и продажам",
    }
    return templates.TemplateResponse(request, "groups/detail.html", context)


api = router
