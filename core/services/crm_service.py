"""Shared CRM helper service for products and customer purchases."""

from __future__ import annotations

from datetime import datetime
from typing import Dict, List, Optional, Sequence

from sqlalchemy import Select, select
from sqlalchemy.ext.asyncio import AsyncSession

from core import db
from core.models import Product, ProductStatus, UserProduct
from core.utils import utcnow


class CRMService:
    """Business logic for managing products and user purchases."""

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
    # Products catalogue helpers
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
        return product

    # ------------------------------------------------------------------
    # Purchases and memberships
    # ------------------------------------------------------------------
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


__all__ = ["CRMService"]
