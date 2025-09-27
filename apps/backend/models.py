"""Database models used by the application."""
from enum import IntEnum, Enum as PyEnum
from datetime import date, datetime, timezone
import uuid

from .db import bcrypt

from .utils import utcnow, utcnow_aware

import sqlalchemy as sa
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    Float,
    Numeric,
    SmallInteger,
    String,
    Text,
    JSON,
    UniqueConstraint,
    CheckConstraint,
    Index,
    func,
)
from sqlalchemy.orm import relationship, backref
from sqlalchemy.dialects.postgresql import UUID as PG_UUID, ARRAY

from backend.base import Base

__mapper_args__ = {
    "confirm_deleted_rows": False  # Для PostgreSQL
}


class UserRole(IntEnum):  # Числовая иерархия ролей (legacy alias)
    suspended = 0
    ban = 0  # legacy alias for suspended
    single = 10
    multiplayer = 20
    moderator = 30
    admin = 40


class GroupType(PyEnum):  # Типы групп и каналов
    private = "private"
    public = "public"
    group = "group"
    supergroup = "supergroup"
    channel = "channel"


class ChannelType(PyEnum):
    channel = "channel"
    supergroup = "supergroup"


class ProductStatus(PyEnum):
    pending = "pending"
    trial = "trial"
    paid = "paid"
    refunded = "refunded"
    gift = "gift"


class CRMAccountType(PyEnum):
    person = "person"
    company = "company"


class CRMDealStatus(PyEnum):
    lead = "lead"
    qualified = "qualified"
    proposal = "proposal"
    won = "won"
    lost = "lost"
    archived = "archived"


class CRMBillingType(PyEnum):
    free = "free"
    one_off = "one_off"
    subscription = "subscription"
    upgrade = "upgrade"
    downgrade = "downgrade"


class CRMTouchpointChannel(PyEnum):
    email = "email"
    telegram = "telegram"
    phone_call = "phone_call"
    meeting = "meeting"
    note = "note"
    system = "system"
    web_form = "web_form"


class CRMTouchpointDirection(PyEnum):
    inbound = "inbound"
    outbound = "outbound"
    internal = "internal"


class CRMSubscriptionStatus(PyEnum):
    active = "active"
    pending = "pending"
    completed = "completed"
    cancelled = "cancelled"
    failed = "failed"


class CRMPricingMode(PyEnum):
    cohort = "cohort"
    rolling = "rolling"
    perpetual = "perpetual"


class TgUser(Base):
    """Telegram user data stored separately from web accounts."""

    __tablename__ = "users_tg"

    id = Column(Integer, primary_key=True, autoincrement=True)
    telegram_id = Column(BigInteger, unique=True, nullable=False)
    username = Column(String(32), unique=True)
    first_name = Column(String(255))
    last_name = Column(String(255))
    language_code = Column(String(10))
    role = Column(String(20), default=UserRole.single.name)
    bot_settings = Column(JSON, default=dict)
    ics_token_hash = Column(String(64))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class WebUser(Base):
    """User registered via web interface."""

    __tablename__ = "users_web"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=True)
    email = Column(String(255))
    phone = Column(String(20))
    full_name = Column(String(255))
    password_hash = Column(String(255), nullable=True)
    role = Column(String(20), default=UserRole.single.name)
    privacy_settings = Column(JSON, default=dict)
    birthday = Column(Date)
    language = Column(String(10))
    diagnostics_enabled = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default=sa.false(),
    )
    diagnostics_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default=sa.true(),
    )
    diagnostics_available = Column(
        ARRAY(SmallInteger),
        nullable=False,
        default=list,
        server_default=sa.text("'{}'::smallint[]"),
    )
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    __table_args__ = (
        Index("ix_users_web_username_ci", func.lower(username), unique=True),
        CheckConstraint(
            "username IS NOT NULL OR email IS NOT NULL OR phone IS NOT NULL",
            name="users_web_contact_present",
        ),
    )

    telegram_accounts = relationship(
        "TgUser",
        secondary="users_web_tg",
        backref="web_accounts",
    )
    diagnostic_profile = relationship(
        "DiagnosticClient",
        back_populates="user",
        uselist=False,
        cascade="all, delete-orphan",
        foreign_keys="DiagnosticClient.user_id",
    )
    diagnostics_clients = relationship(
        "DiagnosticClient",
        back_populates="specialist",
        foreign_keys="DiagnosticClient.specialist_id",
    )

    # Flask-Login compatibility helpers
    @property
    def is_authenticated(self) -> bool:
        """All persisted web users are considered authenticated."""
        return True

    @property
    def is_active(self) -> bool:
        """User is active unless explicitly banned."""
        return self.role != UserRole.ban.name

    @property
    def is_anonymous(self) -> bool:
        return False

    def get_id(self) -> str:
        return str(self.id)

    def check_password(self, password: str) -> bool:
        """Validate password against stored bcrypt hash."""
        if not self.password_hash:
            return False
        return bcrypt.check_password_hash(self.password_hash, password)

    @property
    def avatar_url(self) -> str | None:
        """Optional avatar URL for header/profile.

        Looks into `privacy_settings["avatar_url"]` when present.
        Returns None if not set, letting templates fall back to a default icon.
        """
        try:
            if self.privacy_settings and isinstance(self.privacy_settings, dict):
                url = self.privacy_settings.get("avatar_url")
                if url:
                    return url
        except Exception:
            pass
        return None


class EntityProfile(Base):
    """Unified profile representation for users, groups, projects and areas."""

    __tablename__ = "entity_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    entity_type = Column(String(32), nullable=False)
    entity_id = Column(BigInteger, nullable=False)
    slug = Column(String(255), nullable=False)
    display_name = Column(String(255), nullable=False)
    headline = Column(String(255))
    summary = Column(Text)
    avatar_url = Column(String(512))
    cover_url = Column(String(512))
    tags = Column(JSON, default=list)
    profile_meta = Column(JSON, default=dict)
    sections = Column(JSON, default=list)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    grants = relationship(
        "EntityProfileGrant",
        back_populates="profile",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", name="uq_entity_profiles_entity"),
        UniqueConstraint("entity_type", "slug", name="uq_entity_profiles_slug"),
    )


class CRMProduct(Base):
    __tablename__ = "crm_products"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    slug = Column(String(96), unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    summary = Column(Text)
    kind = Column(String(32), nullable=False, default="default")
    area_id = Column(Integer, ForeignKey("areas.id", ondelete="SET NULL"))
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"))
    is_active = Column(Boolean, nullable=False, default=True)
    config = Column("metadata", JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    versions = relationship(
        "CRMProductVersion",
        back_populates="product",
        cascade="all, delete-orphan",
    )
    tariffs = relationship(
        "CRMProductTariff",
        back_populates="product",
        cascade="all, delete-orphan",
    )


class CRMPipeline(Base):
    __tablename__ = "crm_pipelines"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    slug = Column(String(96), unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    area_id = Column(Integer, ForeignKey("areas.id", ondelete="SET NULL"))
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"))
    config = Column("metadata", JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    stages = relationship(
        "CRMPipelineStage",
        back_populates="pipeline",
        order_by="CRMPipelineStage.position",
        cascade="all, delete-orphan",
    )


class CRMPipelineStage(Base):
    __tablename__ = "crm_pipeline_stages"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    pipeline_id = Column(BigInteger, ForeignKey("crm_pipelines.id", ondelete="CASCADE"))
    slug = Column(String(96), nullable=False)
    title = Column(String(255), nullable=False)
    position = Column(Integer, nullable=False, default=0)
    probability = Column(Numeric(5, 2))
    config = Column("metadata", JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    pipeline = relationship("CRMPipeline", back_populates="stages")


class CRMProductVersion(Base):
    __tablename__ = "crm_product_versions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    product_id = Column(BigInteger, ForeignKey("crm_products.id", ondelete="CASCADE"))
    parent_version_id = Column(BigInteger, ForeignKey("crm_product_versions.id", ondelete="SET NULL"))
    slug = Column(String(96), nullable=False)
    title = Column(String(255), nullable=False)
    pricing_mode = Column(
        Enum(CRMPricingMode, name="crm_pricing_mode"), nullable=False
    )
    starts_at = Column(DateTime(timezone=True))
    ends_at = Column(DateTime(timezone=True))
    seats_limit = Column(Integer)
    area_id = Column(Integer, ForeignKey("areas.id", ondelete="SET NULL"))
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"))
    config = Column("metadata", JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    product = relationship("CRMProduct", back_populates="versions")
    parent_version = relationship("CRMProductVersion", remote_side=[id])


class CRMProductTariff(Base):
    __tablename__ = "crm_product_tariffs"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    product_id = Column(BigInteger, ForeignKey("crm_products.id", ondelete="CASCADE"))
    version_id = Column(BigInteger, ForeignKey("crm_product_versions.id", ondelete="SET NULL"))
    slug = Column(String(96), nullable=False)
    title = Column(String(255), nullable=False)
    billing_type = Column(Enum(CRMBillingType, name="crm_billing_type"), nullable=False)
    amount = Column(Numeric(12, 2))
    currency = Column(String(3), nullable=False, default="RUB")
    is_active = Column(Boolean, nullable=False, default=True)
    config = Column("metadata", JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    product = relationship("CRMProduct", back_populates="tariffs")
    version = relationship("CRMProductVersion")


class CRMAccount(Base):
    __tablename__ = "crm_accounts"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    account_type = Column(Enum(CRMAccountType, name="crm_account_type"), nullable=False)
    web_user_id = Column(Integer, ForeignKey("users_web.id", ondelete="SET NULL"))
    title = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(32))
    area_id = Column(Integer, ForeignKey("areas.id", ondelete="SET NULL"))
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"))
    source = Column(String(64))
    tags = Column(ARRAY(String), default=list)
    context = Column(JSON, default=dict, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    web_user = relationship("WebUser")


class CRMDeal(Base):
    __tablename__ = "crm_deals"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    account_id = Column(BigInteger, ForeignKey("crm_accounts.id", ondelete="CASCADE"))
    owner_id = Column(Integer, ForeignKey("users_web.id", ondelete="SET NULL"))
    pipeline_id = Column(BigInteger, ForeignKey("crm_pipelines.id", ondelete="CASCADE"))
    stage_id = Column(BigInteger, ForeignKey("crm_pipeline_stages.id", ondelete="RESTRICT"))
    product_id = Column(BigInteger, ForeignKey("crm_products.id", ondelete="SET NULL"))
    version_id = Column(BigInteger, ForeignKey("crm_product_versions.id", ondelete="SET NULL"))
    tariff_id = Column(BigInteger, ForeignKey("crm_product_tariffs.id", ondelete="SET NULL"))
    title = Column(String(255), nullable=False)
    status = Column(Enum(CRMDealStatus, name="crm_deal_status"), nullable=False)
    value = Column(Numeric(14, 2))
    currency = Column(String(3), nullable=False, default="RUB")
    probability = Column(Numeric(5, 2))
    knowledge_node_id = Column(Integer)
    area_id = Column(Integer, ForeignKey("areas.id", ondelete="SET NULL"))
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"))
    opened_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    closed_at = Column(DateTime(timezone=True))
    close_forecast_at = Column(DateTime(timezone=True))
    context = Column("metadata", JSON, default=dict, nullable=False)

    account = relationship("CRMAccount")
    pipeline = relationship("CRMPipeline")
    stage = relationship("CRMPipelineStage")
    product = relationship("CRMProduct")
    version = relationship("CRMProductVersion")
    tariff = relationship("CRMProductTariff")


class CRMTouchpoint(Base):
    __tablename__ = "crm_touchpoints"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    deal_id = Column(BigInteger, ForeignKey("crm_deals.id", ondelete="CASCADE"))
    account_id = Column(BigInteger, ForeignKey("crm_accounts.id", ondelete="CASCADE"))
    channel = Column(Enum(CRMTouchpointChannel, name="crm_touchpoint_channel"), nullable=False)
    direction = Column(Enum(CRMTouchpointDirection, name="crm_touchpoint_direction"), nullable=False)
    occurred_at = Column(DateTime(timezone=True), default=utcnow)
    summary = Column(Text)
    payload = Column("payload", JSON, default=dict, nullable=False)
    emotion_score = Column(Numeric(5, 2))
    created_by = Column(Integer, ForeignKey("users_web.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), default=utcnow)

    deal = relationship("CRMDeal")
    account = relationship("CRMAccount")


class CRMSubscription(Base):
    __tablename__ = "crm_subscriptions"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    web_user_id = Column(Integer, ForeignKey("users_web.id", ondelete="CASCADE"))
    product_id = Column(BigInteger, ForeignKey("crm_products.id", ondelete="CASCADE"))
    version_id = Column(BigInteger, ForeignKey("crm_product_versions.id", ondelete="SET NULL"))
    tariff_id = Column(BigInteger, ForeignKey("crm_product_tariffs.id", ondelete="SET NULL"))
    status = Column(Enum(CRMSubscriptionStatus, name="crm_subscription_status"), nullable=False)
    started_at = Column(DateTime(timezone=True), default=utcnow)
    activation_source = Column(String(64))
    ended_at = Column(DateTime(timezone=True))
    expires_at = Column(DateTime(timezone=True))
    area_id = Column(Integer, ForeignKey("areas.id", ondelete="SET NULL"))
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="SET NULL"))
    context = Column("metadata", JSON, default=dict, nullable=False)

    user = relationship("WebUser")
    product = relationship("CRMProduct")
    version = relationship("CRMProductVersion")
    tariff = relationship("CRMProductTariff")
    events = relationship(
        "CRMSubscriptionEvent",
        back_populates="subscription",
        cascade="all, delete-orphan",
    )


class CRMSubscriptionEvent(Base):
    __tablename__ = "crm_subscription_events"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    subscription_id = Column(BigInteger, ForeignKey("crm_subscriptions.id", ondelete="CASCADE"))
    event_type = Column(String(64), nullable=False)
    occurred_at = Column(DateTime(timezone=True), default=utcnow)
    details = Column(JSON, default=dict, nullable=False)
    created_by = Column(Integer, ForeignKey("users_web.id", ondelete="SET NULL"))

    subscription = relationship("CRMSubscription", back_populates="events")


class EntityProfileGrant(Base):
    """Audience grants defining who may view a profile and which sections are visible."""

    __tablename__ = "entity_profile_grants"

    id = Column(Integer, primary_key=True, autoincrement=True)
    profile_id = Column(
        Integer,
        ForeignKey("entity_profiles.id", ondelete="CASCADE"),
        nullable=False,
    )
    audience_type = Column(String(32), nullable=False)
    subject_id = Column(BigInteger)
    sections = Column(JSON)
    created_by = Column(Integer, ForeignKey("users_web.id"))
    expires_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)

    profile = relationship("EntityProfile", back_populates="grants")
    created_by_user = relationship("WebUser", foreign_keys=[created_by])

class WebTgLink(Base):
    """Link between web users and their Telegram accounts."""

    __tablename__ = "users_web_tg"

    id = Column(Integer, primary_key=True, autoincrement=True)
    web_user_id = Column(Integer, ForeignKey("users_web.id"), nullable=False)
    tg_user_id = Column(Integer, ForeignKey("users_tg.id"), unique=True, nullable=False)
    link_type = Column(String(50))
    created_at = Column(DateTime(timezone=True), default=utcnow)


class UserFavorite(Base):
    """Custom user navigation shortcuts."""

    __tablename__ = "users_favorites"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(Integer, ForeignKey("users_web.id"), nullable=False)
    label = Column(String(40))
    path = Column(String(128), nullable=False)
    position = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        UniqueConstraint("owner_id", "path"),
        Index("ix_users_favorites_owner_position", "owner_id", "position"),
    )


class UserSettings(Base):
    __tablename__ = "user_settings"

    id = sa.Column(
        sa.BigInteger().with_variant(sa.Integer, "sqlite"),
        primary_key=True,
        autoincrement=True,
    )
    user_id = sa.Column(
        sa.BigInteger, sa.ForeignKey("users_web.id", ondelete="CASCADE"), nullable=False
    )
    key = sa.Column(sa.String(64), nullable=False)
    value = sa.Column(
        sa.dialects.postgresql.JSONB().with_variant(sa.JSON(), "sqlite"),
        nullable=False,
    )
    updated_at = sa.Column(
        sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
    )

    __table_args__ = (
        sa.UniqueConstraint("user_id", "key", name="uq_user_settings_user_key"),
    )


class NavSidebarLayout(Base):
    __tablename__ = "nav_sidebar_layouts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    scope = Column(String(16), nullable=False)
    owner_id = Column(Integer, nullable=True)
    version = Column(Integer, nullable=False, server_default="1", default=1)
    payload = sa.Column(
        sa.dialects.postgresql.JSONB().with_variant(sa.JSON(), "sqlite"),
        nullable=False,
        server_default=sa.text("'{}'::jsonb"),
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        server_default=sa.func.now(),
    )
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
        onupdate=utcnow,
        server_default=sa.func.now(),
    )

    __table_args__ = (
        CheckConstraint("scope IN ('user', 'global')", name="ck_nav_sidebar_layouts_scope"),
        UniqueConstraint("scope", "owner_id", name="uq_nav_sidebar_layouts_scope_owner"),
        Index("ix_nav_sidebar_layouts_owner", "owner_id"),
    )

class Group(Base):  # Группа
    __tablename__ = "groups"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    telegram_id = Column(BigInteger, unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    type = Column(Enum(GroupType), default=GroupType.private)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    description = Column(String(500))
    participants_count = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class Channel(Base):  # Канал
    __tablename__ = "channels"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    telegram_id = Column(BigInteger, unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    type = Column(Enum(ChannelType), default=ChannelType.channel)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    username = Column(String(32))
    participants_count = Column(Integer, default=0)
    description = Column(String(500))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class UserGroup(Base):  # Связь пользователь-группа (многие ко многим)
    __tablename__ = "user_group"

    user_id = Column(
        BigInteger, ForeignKey("users_tg.telegram_id"), primary_key=True
    )
    group_id = Column(
        BigInteger, ForeignKey("groups.telegram_id"), primary_key=True
    )
    is_owner = Column(Boolean, default=False)
    is_moderator = Column(Boolean, default=False)
    joined_at = Column(DateTime(timezone=True), default=utcnow)
    crm_notes = Column(Text)
    trial_expires_at = Column(DateTime(timezone=True))
    crm_tags = Column(JSON, default=list)
    crm_metadata = Column(JSON, default=dict)


class Product(Base):
    """Продукт, который может быть привязан к участнику."""

    __tablename__ = "products"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(64), unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    active = Column(Boolean, nullable=False, default=True)
    attributes = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    user_links = relationship(
        "UserProduct",
        back_populates="product",
        cascade="all, delete-orphan",
        lazy="selectin",
    )


class UserProduct(Base):
    """Привязка покупки продукта конкретному Telegram-пользователю."""

    __tablename__ = "users_products"

    user_id = Column(
        BigInteger, ForeignKey("users_tg.telegram_id"), primary_key=True
    )
    product_id = Column(
        Integer, ForeignKey("products.id"), primary_key=True
    )
    status = Column(
        Enum(ProductStatus, name="product_status"),
        nullable=False,
        default=ProductStatus.paid,
    )
    source = Column(String(64))
    acquired_at = Column(DateTime(timezone=True), default=utcnow)
    notes = Column(Text)
    extra = Column(JSON, default=dict)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    product = relationship(
        "Product",
        back_populates="user_links",
        lazy="joined",
    )
    user = relationship("TgUser", backref="product_links")


class GroupActivityDaily(Base):
    """Ежедневная статистика активности пользователя в группе."""

    __tablename__ = "group_activity_daily"

    group_id = Column(
        BigInteger, ForeignKey("groups.telegram_id"), primary_key=True
    )
    user_id = Column(
        BigInteger, ForeignKey("users_tg.telegram_id"), primary_key=True
    )
    activity_date = Column(Date, primary_key=True)
    messages_count = Column(Integer, default=0, nullable=False)
    reactions_count = Column(Integer, default=0, nullable=False)
    last_activity_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class GroupRemovalLog(Base):
    """Журнал действий по удалению участников из групп."""

    __tablename__ = "group_removal_log"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    group_id = Column(
        BigInteger, ForeignKey("groups.telegram_id"), nullable=False
    )
    user_id = Column(
        BigInteger, ForeignKey("users_tg.telegram_id"), nullable=False
    )
    product_id = Column(Integer, ForeignKey("products.id"))
    initiator_web_id = Column(Integer, ForeignKey("users_web.id"))
    initiator_tg_id = Column(BigInteger)
    reason = Column(String(255))
    result = Column(String(32), default="queued", nullable=False)
    details = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        Index("ix_group_removal_group_created", "group_id", "created_at"),
        Index("ix_group_removal_product", "product_id"),
    )


# ---------------------------------------------------------------------------
# Task model
# ---------------------------------------------------------------------------

class TaskStatus(PyEnum):
    """Possible statuses for :class:`Task`."""

    todo = "todo"
    in_progress = "in_progress"
    done = "done"


class TaskControlStatus(PyEnum):
    """Lifecycle state for supervised tasks."""

    active = "active"
    done = "done"
    dropped = "dropped"


class TaskRefuseReason(PyEnum):
    """Explicit outcome fixed when supervision is stopped."""

    done = "done"
    wont_do = "wont_do"


class TaskWatcherState(PyEnum):
    """Current watcher subscription state."""

    active = "active"
    left = "left"


class TaskWatcherLeftReason(PyEnum):
    """Reason provided when watcher leaves."""

    done = "done"
    wont_do = "wont_do"
    manual = "manual"


# PARA/PKM enums
class ContainerType(PyEnum):
    project = "project"
    area = "area"
    resource = "resource"


class ProjectStatus(PyEnum):
    active = "active"
    paused = "paused"
    completed = "completed"


class ActivityType(PyEnum):
    work = "work"
    learning = "learning"
    admin = "admin"
    rest = "rest"
    break_ = "break"


class TimeSource(PyEnum):
    timer = "timer"
    manual = "manual"
    import_ = "import"


class Task(Base):
    """Basic task item owned by a telegram user."""

    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    title = Column(String(255), nullable=False)
    description = Column(String(500))
    due_date = Column(DateTime(timezone=True))
    status = Column(Enum(TaskStatus), default=TaskStatus.todo)

    # NexusCore-inspired поля
    cognitive_cost = Column(Integer)
    neural_priority = Column(Float)
    repeat_config = Column(JSON, default=dict)
    recurrence = Column(String(50))
    excluded_dates = Column(JSON, default=list)
    custom_properties = Column(JSON, default=dict)
    schedule_type = Column(String(50))
    reschedule_count = Column(Integer, default=0)
    control_enabled = Column(Boolean, default=False, nullable=False)
    control_frequency = Column(Integer)
    control_status = Column(
        Enum(TaskControlStatus), nullable=False, default=TaskControlStatus.active
    )
    control_next_at = Column(DateTime(timezone=True))
    refused_reason = Column(Enum(TaskRefuseReason))
    remind_policy = Column(JSON, default=dict)
    is_watched = Column(Boolean, default=False, nullable=False)

    checkpoints = relationship(
        "TaskCheckpoint", backref="task", cascade="all, delete-orphan"
    )
    exceptions = relationship(
        "ScheduleException", backref="task", cascade="all, delete-orphan"
    )
    # Link to time tracking entries (work logs)
    time_entries = relationship(
        "TimeEntry", backref="task", cascade="all, delete-orphan"
    )
    reminders = relationship(
        "TaskReminder", backref="task", cascade="all, delete-orphan"
    )
    watchers = relationship(
        "TaskWatcher", backref="task", cascade="all, delete-orphan"
    )

    # PARA links
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=True)
    estimate_minutes = Column(Integer)

    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    __table_args__ = (
        CheckConstraint(
            "(project_id IS NOT NULL) OR (area_id IS NOT NULL)",
            name="ck_tasks_single_container",
        ),
        Index("idx_tasks_owner_project", owner_id, project_id),
        Index("idx_tasks_owner_area", owner_id, area_id),
    )


class TaskReminder(Base):
    """Reminder schedule records for tasks."""

    __tablename__ = "task_reminders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"), nullable=False)
    kind = Column(String(32), nullable=False, default="custom")
    trigger_at = Column(DateTime(timezone=True), nullable=False)
    frequency_minutes = Column(Integer)
    is_active = Column(Boolean, nullable=False, default=True)
    last_triggered_at = Column(DateTime(timezone=True))
    payload = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    __table_args__ = (
        Index("ix_task_reminders_active", "task_id", "trigger_at"),
    )


class TaskWatcher(Base):
    """Subscribers tracking task lifecycle."""

    __tablename__ = "task_watchers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=False)
    watcher_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"), nullable=False)
    added_by = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    state = Column(
        Enum(TaskWatcherState), nullable=False, default=TaskWatcherState.active
    )
    left_reason = Column(Enum(TaskWatcherLeftReason))
    left_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    __table_args__ = (
        Index(
            "ux_task_watchers_active",
            "task_id",
            "watcher_id",
            unique=True,
            postgresql_where=sa.text("state = 'active'"),
        ),
    )

# ---------------------------------------------------------------------------
# CalendarEvent model
# ---------------------------------------------------------------------------

class CalendarEvent(Base):
    """Calendar event item owned by a telegram user."""

    __tablename__ = "calendar_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    title = Column(String(255), nullable=False)
    start_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    end_at = Column(DateTime(timezone=True))
    description = Column(String(500))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
 
 
# ---------------------------------------------------------------------------
# TimeEntry model
# ---------------------------------------------------------------------------

class TimeEntry(Base):
    """Time tracking entry for a telegram user."""

    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    # Optional link to a task: time tracking is work on a task
    task_id = Column(Integer, ForeignKey("tasks.id"), nullable=True)
    start_time = Column(
        DateTime(timezone=True), default=utcnow, nullable=False
    )
    end_time = Column(DateTime(timezone=True))
    description = Column(String(500))
    # PARA inheritance fields
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=True)
    activity_type = Column(Enum(ActivityType), default=ActivityType.work)
    billable = Column(Boolean, default=True)
    source = Column(Enum(TimeSource), default=TimeSource.timer)
    active_seconds = Column(Integer, nullable=False, default=0)
    last_started_at = Column(DateTime(timezone=True))
    paused_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    # Convenience: computed duration in seconds (Python-side)
    @property
    def duration_seconds(self) -> int | None:
        """Return duration in seconds if entry is finished, else None."""
        total = self.active_seconds or 0
        if self.end_time:
            if self.last_started_at:
                try:
                    total += int((self.end_time - self._normalize_tz(self.last_started_at)).total_seconds())
                except Exception:
                    pass
            elif total == 0 and self.start_time:
                try:
                    total = int((self.end_time - self._normalize_tz(self.start_time)).total_seconds())
                except Exception:
                    return None
            return max(total, 0)
        if self.last_started_at:
            try:
                total += int((utcnow_aware() - self._normalize_tz(self.last_started_at)).total_seconds())
            except Exception:
                return total
        elif total == 0 and self.start_time:
            try:
                total = int((utcnow_aware() - self._normalize_tz(self.start_time)).total_seconds())
            except Exception:
                return total
        return max(total, 0)

    @staticmethod
    def _normalize_tz(moment: datetime) -> datetime:
        if moment.tzinfo is None:
            return moment.replace(tzinfo=timezone.utc)
        return moment

    @property
    def is_running(self) -> bool:
        return self.end_time is None and self.last_started_at is not None

    @property
    def is_paused(self) -> bool:
        return self.end_time is None and self.last_started_at is None and self.paused_at is not None

    __table_args__ = (
        Index("idx_time_entries_owner_project", owner_id, project_id),
        Index("idx_time_entries_owner_area", owner_id, area_id),
    )


# ---------------------------------------------------------------------------
# Extended NexusCore-inspired models (сохранены целиком)
# ---------------------------------------------------------------------------

class AreaType(PyEnum):
    career = "CAREER"
    health = "HEALTH"
    education = "EDUCATION"
    finance = "FINANCE"
    personal = "PERSONAL"


class Area(Base):
    __tablename__ = "areas"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    name = Column(String(255), nullable=False)
    title = Column(String(255), nullable=False, default="")
    type = Column(Enum(AreaType))
    color = Column(String(7), nullable=False, default="#F1F5F9")
    context_map = Column(JSON, default=dict)
    review_interval = Column(Integer)
    review_interval_days = Column(Integer, default=7)
    is_active = Column(Boolean, default=True)
    archived_at = Column(DateTime(timezone=True))
    # Tree fields
    parent_id = Column(Integer, ForeignKey("areas.id", ondelete="SET NULL"))
    mp_path = Column(String, default="", nullable=False)
    depth = Column(Integer, default=0, nullable=False)
    slug = Column(String, nullable=False, default="")
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    name = Column(String(255), nullable=False)
    description = Column(String(500))
    cognitive_cost = Column(Integer)
    neural_priority = Column(Float)
    schedule = Column(JSON, default=dict)
    metrics = Column(JSON, default=dict)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    status = Column(Enum(ProjectStatus), default=ProjectStatus.active)
    slug = Column(String(255))
    archived_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Habit(Base):
    __tablename__ = "habits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"))
    title = Column(String(255), nullable=False)
    note = Column(Text)
    type = Column(String(8), nullable=False, default="positive")
    difficulty = Column(String(8), nullable=False, default="easy")
    frequency = Column(String(20), nullable=False, default="daily")
    progress = Column(JSON, default=dict)
    up_enabled = Column(Boolean, default=True)
    down_enabled = Column(Boolean, default=True)
    val = Column(Float, default=0.0)
    daily_limit = Column(Integer, server_default="10")
    cooldown_sec = Column(Integer, server_default="60")
    last_action_at = Column(DateTime(timezone=True))
    tags = Column(JSON)
    archived_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)

    area = relationship("Area")
    project = relationship("Project")

    __table_args__ = (
        CheckConstraint(
            "(project_id IS NOT NULL) OR (area_id IS NOT NULL)",
            name="ck_habits_single_container",
        ),
        Index("idx_habits_owner_project", owner_id, project_id),
        Index("idx_habits_owner_area", owner_id, area_id),
    )

    @property
    def name(self) -> str:
        return self.title

    @name.setter
    def name(self, value: str) -> None:
        self.title = value

    def toggle_progress(self, day: date) -> None:
        """Toggle completion status for a given day.

        HabitMinder/Nexus logic allowed only current day toggling. We retain
        that behaviour to avoid backfilling historical data accidentally.
        """

        today = date.today()
        if day != today:
            raise ValueError("Can only toggle progress for the current day")
        progress = self.progress or {}
        key = day.isoformat()
        progress[key] = not progress.get(key, False)
        self.progress = progress


class HabitLog(Base):
    __tablename__ = "habit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    habit_id = Column(Integer, ForeignKey("habits.id", ondelete="CASCADE"))
    owner_id = Column(BigInteger)
    at = Column(DateTime(timezone=True), default=utcnow)
    delta = Column(Integer)
    reward_xp = Column(Integer)
    reward_gold = Column(Integer)
    penalty_hp = Column(Integer)
    val_after = Column(Float)


class Daily(Base):
    __tablename__ = "dailies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users_web.id"))
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"))
    title = Column(String(255), nullable=False)
    note = Column(Text)
    rrule = Column(Text, nullable=False)
    difficulty = Column(String(8), nullable=False)
    streak = Column(Integer, default=0)
    frozen = Column(Boolean, default=False)
    archived_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)

    area = relationship("Area")
    project = relationship("Project")

    __table_args__ = (
        CheckConstraint(
            "(project_id IS NOT NULL) <> (area_id IS NOT NULL)",
            name="ck_dailies_single_container",
        ),
        Index("idx_dailies_owner_project", owner_id, project_id),
        Index("idx_dailies_owner_area", owner_id, area_id),
    )


class DailyLog(Base):
    __tablename__ = "daily_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    daily_id = Column(Integer, ForeignKey("dailies.id", ondelete="CASCADE"))
    owner_id = Column(BigInteger)
    date = Column(Date, nullable=False)
    done = Column(Boolean, nullable=False)
    reward_xp = Column(Integer)
    reward_gold = Column(Integer)
    penalty_hp = Column(Integer)
    __table_args__ = (UniqueConstraint("daily_id", "date", name="ux_daily_date"),)


class Reward(Base):
    __tablename__ = "rewards"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users_web.id"))
    title = Column(String(255), nullable=False)
    cost_gold = Column(Integer)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"))
    archived_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)

    area = relationship("Area")
    project = relationship("Project")

    __table_args__ = (
        CheckConstraint(
            "(project_id IS NOT NULL) <> (area_id IS NOT NULL)",
            name="ck_rewards_single_container",
        ),
        Index("idx_rewards_owner_project", owner_id, project_id),
        Index("idx_rewards_owner_area", owner_id, area_id),
    )


class UserStats(Base):
    __tablename__ = "user_stats"

    owner_id = Column(BigInteger, ForeignKey("users_web.id"), primary_key=True)
    level = Column(Integer, default=1)
    xp = Column(Integer, default=0)
    gold = Column(Integer, default=0)
    hp = Column(Integer, default=50)
    kp = Column(BigInteger, default=0)
    daily_xp = Column(Integer, server_default="0")
    daily_gold = Column(Integer, server_default="0")
    last_cron = Column(Date)


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    title = Column(String(255), nullable=False)
    content = Column(String(2000))
    type = Column(String(50))
    meta = Column(JSON, default=dict)
    archived_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


# ---------------------------------------------------------------------------
# Note model (сохранено из ветки main)
# ---------------------------------------------------------------------------

class Note(Base):
    """Simple note item owned by a telegram user."""

    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    title = Column(Text)
    content = Column(Text, nullable=False)
    area_id = Column(Integer, ForeignKey("areas.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"))
    container_type = Column(Enum(ContainerType))
    container_id = Column(Integer)
    # Deprecated: note color now inherited from Area.color
    color = Column(String(20))
    pinned = Column(Boolean, default=False)
    order_index = Column(Integer, default=0)
    archived_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    area = relationship("Area")
    project = relationship("Project")

    __table_args__ = (
        CheckConstraint(
            "(project_id IS NOT NULL) OR (area_id IS NOT NULL)",
            name="ck_notes_single_container",
        ),
        Index("idx_notes_owner_project", owner_id, project_id),
        Index("idx_notes_owner_area", owner_id, area_id),
    )


class Archive(Base):
    __tablename__ = "archives"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    source_type = Column(String(50))
    source_id = Column(Integer)
    archived_at = Column(DateTime, default=utcnow)


class TaskCheckpoint(Base):
    __tablename__ = "task_checkpoints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    name = Column(String(255))
    completed = Column(Boolean, default=False)
    completed_at = Column(DateTime)


class ScheduleException(Base):
    __tablename__ = "schedule_exceptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    task_id = Column(Integer, ForeignKey("tasks.id"))
    date = Column(Date)
    reason = Column(String(255))


class OKRStatus(PyEnum):
    pending = "pending"
    active = "active"
    completed = "completed"


class OKR(Base):
    __tablename__ = "okrs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    objective = Column(String(255), nullable=False)
    description = Column(String(500))
    status = Column(Enum(OKRStatus), default=OKRStatus.pending)
    period_start = Column(Date)
    period_end = Column(Date)
    confidence = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)
    key_results = relationship(
        "KeyResult", backref="okr", cascade="all, delete-orphan"
    )


class MetricType(PyEnum):
    count = "count"
    binary = "binary"
    percent = "percent"


class KeyResult(Base):
    __tablename__ = "key_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    okr_id = Column(Integer, ForeignKey("okrs.id"))
    description = Column(String(255), nullable=False)
    metric_type = Column(Enum(MetricType))
    weight = Column(Float, default=1.0)
    target_value = Column(Float)
    current_value = Column(Float, default=0.0)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Interface(Base):
    __tablename__ = "interfaces"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    name = Column(String(255), nullable=False)
    config = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Limit(Base):
    __tablename__ = "limits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    resource = Column(String(50), nullable=False)
    value = Column(Integer, nullable=False)
    expires_at = Column(DateTime)


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(50), nullable=False, unique=True)
    name = Column(String(50), unique=True, nullable=False)
    level = Column(Integer, default=0)
    description = Column(String(255))
    permissions_mask = Column(BigInteger, nullable=False, default=0)
    is_system = Column(Boolean, default=False, nullable=False)
    grants_all = Column(Boolean, default=False, nullable=False)


class AuthPermission(Base):
    __tablename__ = "auth_permissions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    code = Column(String(100), unique=True, nullable=False)
    name = Column(String(50), nullable=False)
    description = Column(String(255))
    category = Column(String(64))
    bit_position = Column(Integer, unique=True, nullable=False)
    mutable = Column(Boolean, default=True, nullable=False)


class UserRoleLink(Base):
    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users_web.id"))
    role_id = Column(Integer, ForeignKey("roles.id"))
    expires_at = Column(DateTime)
    scope_type = Column(String(20), nullable=False, default="global")
    scope_id = Column(Integer)
    granted_by = Column(Integer, ForeignKey("users_web.id"))
    created_at = Column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "role_id", "scope_type", "scope_id"),
    )


class AuthAuditEntry(Base):
    __tablename__ = "auth_audit_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    actor_user_id = Column(Integer, ForeignKey("users_web.id"))
    target_user_id = Column(Integer, ForeignKey("users_web.id"), nullable=False)
    action = Column(String(50), nullable=False)
    role_slug = Column(String(50))
    scope_type = Column(String(20), nullable=False, default="global")
    scope_id = Column(Integer)
    details = Column(JSON, default=dict)
    created_at = Column(DateTime(timezone=True), default=utcnow)


class LinkType(PyEnum):
    hierarchy = "hierarchy"
    reference = "reference"
    dependency = "dependency"
    attachment = "attachment"
    temporal = "temporal"
    metadata = "metadata"


class Link(Base):
    __tablename__ = "links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_type = Column(String(50))
    source_id = Column(Integer)
    target_type = Column(String(50))
    target_id = Column(Integer)
    link_type = Column(Enum(LinkType))
    weight = Column(Float, default=1.0)
    decay = Column(Float, default=1.0)
    created_at = Column(DateTime, default=utcnow)


    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)



# ---------------------------------------------------------------------------
# Diagnostics domain
# ---------------------------------------------------------------------------


class DiagnosticTemplate(Base):
    __tablename__ = "diagnostic_templates"

    id = Column(SmallInteger, primary_key=True)
    slug = Column(String(128), nullable=False, unique=True)
    title = Column(String(255), nullable=False)
    form_path = Column(String(255), nullable=False)
    sort_order = Column(
        SmallInteger,
        nullable=False,
        default=0,
        server_default=sa.text("0"),
    )
    is_active = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default=sa.true(),
    )
    config = Column(
        JSON,
        nullable=False,
        default=dict,
        server_default=sa.text("'{}'::jsonb"),
    )
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    results = relationship(
        "DiagnosticResult",
        back_populates="template",
        cascade="all, delete-orphan",
    )


class DiagnosticClient(Base):
    __tablename__ = "diagnostic_clients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(
        Integer,
        ForeignKey("users_web.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    specialist_id = Column(
        Integer,
        ForeignKey("users_web.id", ondelete="SET NULL"),
    )
    is_new = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default=sa.true(),
    )
    in_archive = Column(
        Boolean,
        nullable=False,
        default=False,
        server_default=sa.false(),
    )
    contact_permission = Column(
        Boolean,
        nullable=False,
        default=True,
        server_default=sa.true(),
    )
    last_result_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )

    user = relationship(
        "WebUser",
        foreign_keys=[user_id],
        back_populates="diagnostic_profile",
    )
    specialist = relationship(
        "WebUser",
        foreign_keys=[specialist_id],
        back_populates="diagnostics_clients",
    )
    results = relationship(
        "DiagnosticResult",
        back_populates="client",
        cascade="all, delete-orphan",
        order_by="DiagnosticResult.submitted_at.desc()",
    )


class DiagnosticResult(Base):
    __tablename__ = "diagnostic_results"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    client_id = Column(
        Integer,
        ForeignKey("diagnostic_clients.id", ondelete="CASCADE"),
        nullable=False,
    )
    specialist_id = Column(
        Integer,
        ForeignKey("users_web.id", ondelete="SET NULL"),
    )
    diagnostic_id = Column(
        SmallInteger,
        ForeignKey("diagnostic_templates.id"),
    )
    payload = Column(
        JSON,
        nullable=False,
        default=dict,
        server_default=sa.text("'{}'::jsonb"),
    )
    open_answer = Column(Text)
    submitted_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
    )
    created_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=utcnow,
    )

    client = relationship("DiagnosticClient", back_populates="results")
    specialist = relationship("WebUser", foreign_keys=[specialist_id])
    template = relationship("DiagnosticTemplate", back_populates="results")


# ---------------------------------------------------------------------------
# Модели для логгера
# ---------------------------------------------------------------------------

class LogLevel(IntEnum):
    """Уровни логирования по аналогии со стандартным ``logging``.

    Значения указаны численно, чтобы корректно сравнивать уровни
    между собой (``DEBUG`` < ``INFO`` < ``ERROR``).
    """

    DEBUG = 10
    INFO = 20
    ERROR = 40


class LogSettings(Base):
    __tablename__ = "log_settings"

    id = Column(BigInteger, primary_key=True)
    chat_id = Column(BigInteger, nullable=False)  # ID группы для логов
    level = Column(
        Enum(LogLevel), default=LogLevel.ERROR
    )  # Уровень логирования
    updated_at = Column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )
    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"<LogSettings(level='{self.level}', chat_id='{self.chat_id}')>"


# ---------------------------------------------------------------------------
# New PARA calendar and notification models
# ---------------------------------------------------------------------------


class CalendarItemStatus(PyEnum):
    """Lifecycle status for :class:`CalendarItem`."""

    planned = "planned"
    done = "done"
    cancelled = "cancelled"


class CalendarItem(Base):
    """Calendar event bound to an Area or Project."""

    __tablename__ = "calendar_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    title = Column(String(255), nullable=False)
    start_at = Column(DateTime(timezone=True), nullable=False)
    end_at = Column(DateTime(timezone=True))
    project_id = Column(Integer, ForeignKey("projects.id"))
    area_id = Column(Integer, ForeignKey("areas.id"))
    status = Column(Enum(CalendarItemStatus), default=CalendarItemStatus.planned)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    alarms = relationship(
        "Alarm", backref="item", cascade="all, delete-orphan"
    )

    __table_args__ = (
        CheckConstraint(
            "(project_id IS NOT NULL) <> (area_id IS NOT NULL)",
            name="ck_calendar_items_single_container",
        ),
        Index("idx_calendar_items_owner_project", owner_id, project_id),
        Index("idx_calendar_items_owner_area", owner_id, area_id),
    )


class Alarm(Base):
    """Reminder tied to a :class:`CalendarItem`."""

    __tablename__ = "alarms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    item_id = Column(Integer, ForeignKey("calendar_items.id"), nullable=False)
    trigger_at = Column(DateTime(timezone=True), nullable=False)
    is_sent = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class NotificationChannelKind(PyEnum):
    """Supported notification channel types."""

    telegram = "telegram"
    email = "email"


class NotificationChannel(Base):
    """User notification channel (e-mail, Telegram, ...)."""

    __tablename__ = "notification_channels"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    kind = Column(Enum(NotificationChannelKind), nullable=False)
    # Для Telegram address хранит JSON вида {"chat_id": -100123456}
    address = Column(JSON, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class ProjectNotification(Base):
    """Mapping of :class:`Project` to subscribed :class:`Channel`."""

    __tablename__ = "project_notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    channel_id = Column(Integer, ForeignKey("notification_channels.id"), nullable=False)
    rules = Column(JSON, default=dict)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class NotificationTrigger(Base):
    """Отложенный триггер отправки уведомления."""

    __tablename__ = "notification_triggers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    next_fire_at = Column(DateTime(timezone=True), nullable=False)
    alarm_id = Column(Integer, ForeignKey("alarms.id"))
    rule = Column(JSON)
    dedupe_key = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class NotificationDelivery(Base):
    """Лог отправленных уведомлений для идемпотентности."""

    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    dedupe_key = Column(String(255), unique=True, nullable=False)
    sent_at = Column(DateTime(timezone=True), default=utcnow)


class GCalLink(Base):
    """Link to an external Google Calendar."""

    __tablename__ = "gcal_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("users_tg.telegram_id"))
    calendar_id = Column(String(255), nullable=False)
    access_token = Column(String(255))
    refresh_token = Column(String(255))
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
