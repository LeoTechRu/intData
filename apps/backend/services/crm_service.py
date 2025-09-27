"""Shared CRM helper service for legacy products and new CRM foundations."""

from __future__ import annotations

from datetime import datetime
from typing import Dict, Iterable, List, Optional, Sequence
import re

import sqlalchemy as sa
from sqlalchemy import Select, func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from backend import db
from backend.models import (
    CRMAccount,
    CRMAccountType,
    CRMDeal,
    CRMDealStatus,
    CRMProduct,
    CRMProductTariff,
    CRMProductVersion,
    CRMBillingType,
    CRMPricingMode,
    CRMSubscription,
    CRMSubscriptionEvent,
    CRMSubscriptionStatus,
    CRMTouchpoint,
    CRMTouchpointChannel,
    CRMTouchpointDirection,
    Product,
    ProductStatus,
    UserProduct,
    WebUser,
)
from backend.services.profile_service import ProfileService, normalize_slug
from backend.utils import utcnow


def _normalize_phone(value: str | None) -> str | None:
    if not value:
        return None
    digits = re.sub(r"[^0-9+]", "", value)
    return digits or None


class CRMService:
    """Business logic helper for CRM entities.

    Сохраняет совместимость с legacy-страницами (`products`, `users_products`) и
    постепенно расширяется сущностями CRM Knowledge Hub (E18).
    """

    def __init__(self, session: Optional[AsyncSession] = None):
        self.session = session
        self._external = session is not None

    async def __aenter__(self) -> "CRMService":
        if self.session is None:
            self.session = db.async_session()
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        if not self._external and self.session is not None:
            if exc_type is None:
                await self.session.commit()
            else:
                await self.session.rollback()
            await self.session.close()
        if not self._external:
            self.session = None

    # ------------------------------------------------------------------
    # Legacy products catalogue helpers (to be sunset after CRM rollout)
    # ------------------------------------------------------------------
    async def list_products(self, *, active_only: bool = True) -> List[Product]:
        stmt: Select[Product] = select(Product)
        if active_only:
            stmt = stmt.where(Product.active.is_(True))
        stmt = stmt.order_by(Product.title.asc())
        rows = await self.session.execute(stmt)
        return rows.scalars().all()

    async def get_product_by_slug(self, slug: str) -> Optional[Product]:
        row = await self.session.execute(
            select(Product).where(Product.slug == slug)
        )
        return row.scalar_one_or_none()

    async def ensure_product(
        self,
        *,
        slug: str,
        title: str,
        description: str | None = None,
        active: bool = True,
        attributes: Optional[Dict[str, object]] = None,
    ) -> Product:
        product = await self.get_product_by_slug(slug)
        if product:
            changed = False
            if product.title != title:
                product.title = title
                changed = True
            if product.description != description:
                product.description = description
                changed = True
            if product.active != active:
                product.active = active
                changed = True
            if attributes is not None and product.attributes != attributes:
                product.attributes = attributes
                changed = True
            if changed:
                product.updated_at = utcnow()
            await self._sync_product_profile(product)
            return product
        product = Product(
            slug=slug,
            title=title,
            description=description,
            active=active,
            attributes=attributes or {},
        )
        self.session.add(product)
        await self.session.flush()
        await self._sync_product_profile(product)
        return product

    async def assign_product(
        self,
        *,
        user_id: int,
        product_id: int,
        status: ProductStatus = ProductStatus.paid,
        source: Optional[str] = None,
        acquired_at: Optional[datetime] = None,
        notes: Optional[str] = None,
        extra: Optional[Dict[str, object]] = None,
    ) -> UserProduct:
        acquired_at = acquired_at or utcnow()
        link = await self.session.get(UserProduct, (user_id, product_id))
        if link:
            link.status = status
            link.source = source
            link.acquired_at = acquired_at
            if notes is not None:
                link.notes = notes
            if extra is not None:
                link.extra = extra
            link.updated_at = utcnow()
            return link
        link = UserProduct(
            user_id=user_id,
            product_id=product_id,
            status=status,
            source=source,
            acquired_at=acquired_at,
            notes=notes,
            extra=extra or {},
        )
        self.session.add(link)
        await self.session.flush()
        return link

    async def revoke_product(self, *, user_id: int, product_id: int) -> bool:
        link = await self.session.get(UserProduct, (user_id, product_id))
        if not link:
            return False
        await self.session.delete(link)
        return True

    async def member_products(
        self,
        *,
        user_ids: Sequence[int],
    ) -> Dict[int, List[UserProduct]]:
        if not user_ids:
            return {}
        rows = await self.session.execute(
            select(UserProduct).where(UserProduct.user_id.in_(user_ids))
        )
        grouped: Dict[int, List[UserProduct]] = {}
        for link in rows.scalars():
            grouped.setdefault(link.user_id, []).append(link)
        return grouped

    async def _sync_product_profile(self, product: Product) -> None:
        updates = {
            "slug": normalize_slug(product.slug or product.title, f"product-{product.id}"),
            "display_name": product.title,
            "summary": product.description,
            "profile_meta": {"active": product.active},
        }
        attrs = product.attributes or {}
        tags = attrs.get("tags")
        if tags:
            updates["tags"] = tags
        async with ProfileService(self.session) as profiles:
            await profiles.upsert_profile_meta(
                entity_type="product",
                entity_id=product.id,
                updates=updates,
            )

    # ------------------------------------------------------------------
    # CRM Knowledge Hub foundations
    # ------------------------------------------------------------------
    async def ensure_web_contact(
        self,
        *,
        email: str | None,
        phone: str | None,
        full_name: str | None = None,
    ) -> WebUser:
        """Find or create a WebUser contact without credentials."""

        normalized_phone = _normalize_phone(phone)
        if not email and not normalized_phone:
            raise ValueError("Нужно указать email или телефон")

        criteria: list = []
        if email:
            criteria.append(func.lower(WebUser.email) == email.lower())
        if normalized_phone:
            criteria.append(WebUser.phone == normalized_phone)

        existing: WebUser | None = None
        if criteria:
            stmt = select(WebUser).where(sa.or_(*criteria))
            row = await self.session.execute(stmt)
            existing = row.scalar_one_or_none()
        if existing:
            updated = False
            if full_name and not existing.full_name:
                existing.full_name = full_name
                updated = True
            if email and not existing.email:
                existing.email = email
                updated = True
            if normalized_phone and not existing.phone:
                existing.phone = normalized_phone
                updated = True
            if updated:
                existing.updated_at = utcnow()
            return existing

        contact = WebUser(
            username=None,
            email=email,
            phone=normalized_phone,
            full_name=full_name,
            password_hash=None,
        )
        self.session.add(contact)
        await self.session.flush()
        return contact

    async def upsert_crm_product(
        self,
        *,
        slug: str,
        title: str,
        area_id: int | None,
        project_id: int | None,
        summary: str | None = None,
        kind: str = "default",
        context: Optional[dict] = None,
    ) -> CRMProduct:
        result = await self.session.execute(
            select(CRMProduct).where(CRMProduct.slug == slug)
        )
        product = result.scalar_one_or_none()
        if product:
            changed = False
            for attr, value in (
                ("title", title),
                ("summary", summary),
                ("kind", kind),
                ("area_id", area_id),
                ("project_id", project_id),
            ):
                if value is not None and getattr(product, attr) != value:
                    setattr(product, attr, value)
                    changed = True
            if metadata is not None and product.config != metadata:
                product.config = metadata
                changed = True
            if changed:
                product.updated_at = utcnow()
            return product

        if not area_id and not project_id:
            raise ValueError("CRM-продукт должен иметь project_id или area_id")
        product = CRMProduct(
            slug=slug,
            title=title,
            summary=summary,
            kind=kind,
            area_id=area_id,
            project_id=project_id,
            config=metadata or {},
        )
        self.session.add(product)
        await self.session.flush()
        return product

    async def list_crm_products(self, *, include_inactive: bool = False) -> List[CRMProduct]:
        stmt = select(CRMProduct)
        if not include_inactive:
            stmt = stmt.where(CRMProduct.is_active.is_(True))
        stmt = stmt.order_by(CRMProduct.title.asc())
        rows = await self.session.execute(stmt)
        return rows.scalars().all()

    async def fetch_crm_catalog(self) -> List[CRMProduct]:
        stmt = (
            select(CRMProduct)
            .options(
                selectinload(CRMProduct.versions),
                selectinload(CRMProduct.tariffs),
            )
            .order_by(CRMProduct.title.asc())
        )
        rows = await self.session.execute(stmt)
        return rows.scalars().unique().all()

    async def add_product_version(
        self,
        *,
        product_id: int,
        slug: str,
        title: str,
        pricing_mode: CRMPricingMode,
        area_id: int | None,
        project_id: int | None,
        starts_at: datetime | None = None,
        ends_at: datetime | None = None,
        seats_limit: int | None = None,
        parent_version_id: int | None = None,
        metadata: Optional[dict] = None,
    ) -> CRMProductVersion:
        result = await self.session.execute(
            select(CRMProductVersion).where(
                CRMProductVersion.product_id == product_id,
                CRMProductVersion.slug == slug,
            )
        )
        version = result.scalar_one_or_none()
        if version:
            changed = False
            for attr, value in (
                ("title", title),
                ("pricing_mode", pricing_mode),
                ("starts_at", starts_at),
                ("ends_at", ends_at),
                ("seats_limit", seats_limit),
                ("area_id", area_id),
                ("project_id", project_id),
                ("parent_version_id", parent_version_id),
            ):
                if value is not None and getattr(version, attr) != value:
                    setattr(version, attr, value)
                    changed = True
            if metadata is not None and version.config != metadata:
                version.config = metadata
                changed = True
            if changed:
                version.updated_at = utcnow()
            return version

        if not area_id and not project_id:
            raise ValueError("Версия продукта должна наследовать PARA-контекст")
        version = CRMProductVersion(
            product_id=product_id,
            slug=slug,
            title=title,
            pricing_mode=pricing_mode,
            starts_at=starts_at,
            ends_at=ends_at,
            seats_limit=seats_limit,
            area_id=area_id,
            project_id=project_id,
            parent_version_id=parent_version_id,
            config=metadata or {},
        )
        self.session.add(version)
        await self.session.flush()
        return version

    async def add_product_tariff(
        self,
        *,
        product_id: int,
        slug: str,
        title: str,
        billing_type: CRMBillingType,
        amount: float | None,
        currency: str = "RUB",
        version_id: int | None = None,
        metadata: Optional[dict] = None,
    ) -> CRMProductTariff:
        result = await self.session.execute(
            select(CRMProductTariff).where(
                CRMProductTariff.product_id == product_id,
                CRMProductTariff.slug == slug,
            )
        )
        tariff = result.scalar_one_or_none()
        if tariff:
            changed = False
            for attr, value in (
                ("title", title),
                ("billing_type", billing_type),
                ("amount", amount),
                ("currency", currency),
                ("version_id", version_id),
            ):
                if getattr(tariff, attr) != value:
                    setattr(tariff, attr, value)
                    changed = True
            if metadata is not None and tariff.config != metadata:
                tariff.config = metadata
                changed = True
            if changed:
                tariff.updated_at = utcnow()
            return tariff

        tariff = CRMProductTariff(
            product_id=product_id,
            version_id=version_id,
            slug=slug,
            title=title,
            billing_type=billing_type,
            amount=amount,
            currency=currency,
            config=metadata or {},
        )
        self.session.add(tariff)
        await self.session.flush()
        return tariff

    async def ensure_account(
        self,
        *,
        title: str,
        area_id: int | None,
        project_id: int | None,
        account_type: CRMAccountType = CRMAccountType.person,
        email: str | None = None,
        phone: str | None = None,
        web_user: WebUser | None = None,
        source: str | None = None,
        tags: Optional[Iterable[str]] = None,
        context: Optional[dict] = None,
    ) -> CRMAccount:
        if not area_id and not project_id:
            raise ValueError("CRM-аккаунт требует area_id или project_id")

        normalized_phone = _normalize_phone(phone)

        if web_user is None and (email or normalized_phone):
            web_user = await self.ensure_web_contact(
                email=email,
                phone=normalized_phone,
                full_name=title,
            )

        query = select(CRMAccount)
        if web_user is not None:
            query = query.where(CRMAccount.web_user_id == web_user.id)
        elif email:
            query = query.where(func.lower(CRMAccount.email) == email.lower())
        elif normalized_phone:
            query = query.where(CRMAccount.phone == normalized_phone)
        else:
            query = query.where(CRMAccount.title == title)

        row = await self.session.execute(query)
        account = row.scalar_one_or_none()
        if account:
            changed = False
            for attr, value in (
                ("title", title),
                ("account_type", account_type),
                ("email", email),
                ("phone", normalized_phone),
                ("area_id", area_id),
                ("project_id", project_id),
                ("source", source),
            ):
                if value is not None and getattr(account, attr) != value:
                    setattr(account, attr, value)
                    changed = True
            if web_user and account.web_user_id != web_user.id:
                account.web_user_id = web_user.id
                changed = True
            if tags is not None:
                tag_list = list(tags)
                if account.tags != tag_list:
                    account.tags = tag_list
                    changed = True
            if context is not None and account.context != context:
                account.context = context
                changed = True
            if changed:
                account.updated_at = utcnow()
            return account

        account = CRMAccount(
            account_type=account_type,
            web_user_id=web_user.id if web_user else None,
            title=title,
            email=email,
            phone=normalized_phone,
            area_id=area_id,
            project_id=project_id,
            source=source,
            tags=list(tags or []),
            context=context or {},
        )
        self.session.add(account)
        await self.session.flush()
        return account

    async def create_deal(
        self,
        *,
        account_id: int,
        pipeline_id: int,
        stage_id: int,
        title: str,
        area_id: int | None,
        project_id: int | None,
        owner_id: int | None = None,
        product_id: int | None = None,
        version_id: int | None = None,
        tariff_id: int | None = None,
        status: CRMDealStatus = CRMDealStatus.lead,
        value: float | None = None,
        currency: str = "RUB",
        probability: float | None = None,
        knowledge_node_id: int | None = None,
        context: Optional[dict] = None,
    ) -> CRMDeal:
        if not area_id and not project_id:
            raise ValueError("Сделка должна иметь area_id или project_id")

        deal = CRMDeal(
            account_id=account_id,
            owner_id=owner_id,
            pipeline_id=pipeline_id,
            stage_id=stage_id,
            product_id=product_id,
            version_id=version_id,
            tariff_id=tariff_id,
            title=title,
            status=status,
            value=value,
            currency=currency,
            probability=probability,
            knowledge_node_id=knowledge_node_id,
            area_id=area_id,
            project_id=project_id,
            context=context or {},
        )
        self.session.add(deal)
        await self.session.flush()
        return deal

    async def move_deal_stage(
        self,
        *,
        deal: CRMDeal,
        stage_id: int,
        status: Optional[CRMDealStatus] = None,
        probability: Optional[float] = None,
        metadata_patch: Optional[dict] = None,
    ) -> CRMDeal:
        changed = False
        if deal.stage_id != stage_id:
            deal.stage_id = stage_id
            changed = True
        if status and deal.status != status:
            deal.status = status
            changed = True
        if probability is not None and deal.probability != probability:
            deal.probability = probability
            changed = True
        if metadata_patch:
            current_context = deal.context or {}
            deal.context = {**current_context, **metadata_patch}
            changed = True
        if changed:
            deal.updated_at = utcnow()
        return deal

    async def log_touchpoint(
        self,
        *,
        deal_id: int | None,
        account_id: int | None,
        channel: CRMTouchpointChannel,
        direction: CRMTouchpointDirection,
        summary: str | None,
        payload: Optional[dict],
        emotion_score: float | None,
        created_by: int | None,
        occurred_at: datetime | None = None,
    ) -> CRMTouchpoint:
        if not deal_id and not account_id:
            raise ValueError("Touchpoint должен ссылаться на сделку или аккаунт")
        tp = CRMTouchpoint(
            deal_id=deal_id,
            account_id=account_id,
            channel=channel,
            direction=direction,
            occurred_at=occurred_at or utcnow(),
            summary=summary,
            payload=payload or {},
            emotion_score=emotion_score,
            created_by=created_by,
        )
        self.session.add(tp)
        await self.session.flush()
        return tp

    async def ensure_subscription(
        self,
        *,
        web_user_id: int,
        product_id: int,
        version_id: int | None,
        tariff_id: int | None,
        area_id: int | None,
        project_id: int | None,
        status: CRMSubscriptionStatus = CRMSubscriptionStatus.active,
        activation_source: str | None = None,
        metadata: Optional[dict] = None,
    ) -> CRMSubscription:
        if not area_id and not project_id:
            raise ValueError("Подписка должна наследовать PARA-контекст")
        stmt = select(CRMSubscription).where(
            CRMSubscription.web_user_id == web_user_id,
            CRMSubscription.product_id == product_id,
            func.coalesce(CRMSubscription.version_id, 0) == (version_id or 0),
            func.coalesce(CRMSubscription.tariff_id, 0) == (tariff_id or 0),
        )
        row = await self.session.execute(stmt)
        subscription = row.scalar_one_or_none()
        if subscription:
            changed = False
            if status and subscription.status != status:
                subscription.status = status
                changed = True
            if activation_source and subscription.activation_source != activation_source:
                subscription.activation_source = activation_source
                changed = True
            if context is not None and subscription.context != context:
                subscription.context = context
                changed = True
            if subscription.area_id != area_id:
                subscription.area_id = area_id
                changed = True
            if subscription.project_id != project_id:
                subscription.project_id = project_id
                changed = True
            if changed:
                subscription.updated_at = utcnow()
            return subscription

        subscription = CRMSubscription(
            web_user_id=web_user_id,
            product_id=product_id,
            version_id=version_id,
            tariff_id=tariff_id,
            status=status,
            activation_source=activation_source,
            area_id=area_id,
            project_id=project_id,
            context=context or {},
        )
        self.session.add(subscription)
        await self.session.flush()
        return subscription

    async def close_subscription(
        self,
        subscription: CRMSubscription,
        *,
        status: CRMSubscriptionStatus,
        ended_at: datetime | None = None,
        expires_at: datetime | None = None,
        metadata_patch: Optional[dict] = None,
        actor_user_id: int | None = None,
        reason: str | None = None,
    ) -> CRMSubscription:
        subscription.status = status
        subscription.ended_at = ended_at or utcnow()
        subscription.expires_at = expires_at
        if metadata_patch:
            current_context = subscription.context or {}
            subscription.context = {**current_context, **metadata_patch}
        await self.record_subscription_event(
            subscription_id=subscription.id,
            event_type="status_change",
            created_by=actor_user_id,
            details={
                "status": status.value,
                "reason": reason,
            },
        )
        return subscription

    async def record_subscription_event(
        self,
        *,
        subscription_id: int,
        event_type: str,
        created_by: int | None,
        details: Optional[dict] = None,
    ) -> CRMSubscriptionEvent:
        event = CRMSubscriptionEvent(
            subscription_id=subscription_id,
            event_type=event_type,
            details=details or {},
            created_by=created_by,
        )
        self.session.add(event)
        await self.session.flush()
        return event


__all__ = ["CRMService"]
