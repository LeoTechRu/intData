from __future__ import annotations

from decimal import Decimal
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from core.models import (
    CRMAccountType,
    CRMProduct,
    CRMProductTariff,
    CRMProductVersion,
    CRMSubscriptionStatus,
    WebUser,
)
from core.services.crm_service import CRMService, CRMBillingType, CRMPricingMode
from core.services.web_user_service import WebUserService
from web.dependencies import get_current_web_user

router = APIRouter(prefix="/crm", tags=["crm"])


class CRMProductVersionOut(BaseModel):
    id: int
    slug: str
    title: str
    pricing_mode: CRMPricingMode
    starts_at: Optional[str]
    ends_at: Optional[str]
    seats_limit: Optional[int]
    area_id: Optional[int]
    project_id: Optional[int]
    config: dict = Field(default_factory=dict)

    class Config:
        json_encoders = {CRMPricingMode: lambda value: value.value}


class CRMTariffOut(BaseModel):
    id: int
    slug: str
    title: str
    billing_type: CRMBillingType
    amount: Optional[float]
    currency: str
    is_active: bool
    version_id: Optional[int]
    config: dict = Field(default_factory=dict)

    class Config:
        json_encoders = {CRMBillingType: lambda value: value.value}


class CRMProductOut(BaseModel):
    id: int
    slug: str
    title: str
    summary: Optional[str]
    kind: str
    area_id: Optional[int]
    project_id: Optional[int]
    is_active: bool
    config: dict = Field(default_factory=dict)
    versions: List[CRMProductVersionOut]
    tariffs: List[CRMTariffOut]


@router.get("/products", response_model=List[CRMProductOut])
async def list_crm_products(current_user: WebUser | None = Depends(get_current_web_user)):
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)
    async with CRMService() as crm:
        products = await crm.fetch_crm_catalog()
        return [
            CRMProductOut(
                id=product.id,
                slug=product.slug,
                title=product.title,
                summary=product.summary,
                kind=product.kind,
                area_id=product.area_id,
                project_id=product.project_id,
                is_active=bool(product.is_active),
                config=product.config or {},
                versions=[
                    CRMProductVersionOut(
                        id=version.id,
                        slug=version.slug,
                        title=version.title,
                        pricing_mode=version.pricing_mode,
                        starts_at=version.starts_at.isoformat() if version.starts_at else None,
                        ends_at=version.ends_at.isoformat() if version.ends_at else None,
                        seats_limit=version.seats_limit,
                        area_id=version.area_id,
                        project_id=version.project_id,
                        config=version.config or {},
                    )
                    for version in sorted(
                        product.versions,
                        key=lambda item: (
                            item.starts_at or item.created_at,
                            item.id,
                        ),
                    )
                ],
                tariffs=[
                    CRMTariffOut(
                        id=tariff.id,
                        slug=tariff.slug,
                        title=tariff.title,
                        billing_type=tariff.billing_type,
                        amount=float(tariff.amount) if isinstance(tariff.amount, Decimal) else tariff.amount,
                        currency=tariff.currency,
                        is_active=bool(tariff.is_active),
                        version_id=tariff.version_id,
                        config=tariff.config or {},
                    )
                    for tariff in sorted(
                        product.tariffs,
                        key=lambda item: (item.version_id or 0, item.title.lower()),
                    )
                ],
            )
            for product in products
        ]


class SubscriptionTransitionPayload(BaseModel):
    product_id: int
    version_id: Optional[int]
    tariff_id: Optional[int]
    transition_type: Literal["free", "upgrade", "downgrade"]
    activation_source: Optional[str]
    metadata: dict = Field(default_factory=dict)
    area_id: Optional[int]
    project_id: Optional[int]
    web_user_id: Optional[int]
    email: Optional[str]
    phone: Optional[str]
    full_name: Optional[str]


class SubscriptionTransitionResponse(BaseModel):
    subscription_id: int
    status: CRMSubscriptionStatus
    transition_type: str

    class Config:
        json_encoders = {CRMSubscriptionStatus: lambda value: value.value}


@router.post("/subscriptions/transition", response_model=SubscriptionTransitionResponse)
async def transition_subscription(
    payload: SubscriptionTransitionPayload,
    current_user: WebUser | None = Depends(get_current_web_user),
):
    if current_user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED)

    if not payload.web_user_id and not (payload.email or payload.phone):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Укажите web_user_id либо контактные данные (email/телефон)",
        )

    async with CRMService() as crm:
        target_user_id: int
        if payload.web_user_id:
            async with WebUserService(crm.session) as wsvc:
                user = await wsvc.get_by_id(payload.web_user_id)
            if user is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Пользователь не найден")
            target_user_id = user.id
        else:
            contact = await crm.ensure_web_contact(
                email=payload.email,
                phone=payload.phone,
                full_name=payload.full_name,
            )
            target_user_id = contact.id

        product = await crm.session.get(CRMProduct, payload.product_id)
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Продукт не найден")

        area_id = payload.area_id or product.area_id
        project_id = payload.project_id or product.project_id
        if not area_id and not project_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Нужно указать area_id или project_id для подписки",
            )

        version: CRMProductVersion | None = None
        if payload.version_id:
            version = await crm.session.get(CRMProductVersion, payload.version_id)
            if version is None or version.product_id != product.id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Версия продукта не найдена")
            if version.area_id:
                area_id = area_id or version.area_id
            if version.project_id:
                project_id = project_id or version.project_id

        tariff: CRMProductTariff | None = None
        if payload.tariff_id:
            tariff = await crm.session.get(CRMProductTariff, payload.tariff_id)
            if tariff is None or tariff.product_id != product.id:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Тариф не найден")

        status_map = {
            "free": CRMSubscriptionStatus.active,
            "upgrade": CRMSubscriptionStatus.pending,
            "downgrade": CRMSubscriptionStatus.pending,
        }
        target_status = status_map[payload.transition_type]

        subscription = await crm.ensure_subscription(
            web_user_id=target_user_id,
            product_id=product.id,
            version_id=version.id if version else None,
            tariff_id=tariff.id if tariff else None,
            area_id=area_id,
            project_id=project_id,
            status=target_status,
            activation_source=payload.activation_source,
            context=payload.metadata,
        )

        await crm.record_subscription_event(
            subscription_id=subscription.id,
            event_type="transition",
            created_by=current_user.id,
            details={
                "type": payload.transition_type,
                "initiator": current_user.id,
            },
        )

        if payload.transition_type in {"upgrade", "downgrade"} and target_status == CRMSubscriptionStatus.pending:
            subscription = await crm.close_subscription(
                subscription,
                status=CRMSubscriptionStatus.completed,
                metadata_patch={"transition": payload.transition_type},
                actor_user_id=current_user.id,
            )

        return SubscriptionTransitionResponse(
            subscription_id=subscription.id,
            status=subscription.status,
            transition_type=payload.transition_type,
        )


__all__ = ["router"]
