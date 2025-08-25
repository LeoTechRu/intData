"""Database models used by the application."""
from enum import IntEnum, Enum as PyEnum

from .utils import utcnow

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
    String,
    JSON,
)
from sqlalchemy.orm import relationship

from base import Base

__mapper_args__ = {
    "confirm_deleted_rows": False  # Для PostgreSQL
}


class UserRole(IntEnum):  # Числовая иерархия ролей
    ban = 0
    single = 1
    multiplayer = 2
    moderator = 3
    admin = 4


class GroupType(PyEnum):  # Типы групп и каналов
    private = "private"
    public = "public"
    group = "group"
    supergroup = "supergroup"
    channel = "channel"


class ChannelType(PyEnum):
    channel = "channel"
    supergroup = "supergroup"


class TgUser(Base):
    """Telegram user data stored separately from web accounts."""

    __tablename__ = "tg_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    telegram_id = Column(BigInteger, unique=True, nullable=False)
    username = Column(String(32), unique=True)
    first_name = Column(String(255))
    last_name = Column(String(255))
    language_code = Column(String(10))
    role = Column(String(20), default=UserRole.single.name)
    bot_settings = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class WebUser(Base):
    """User registered via web interface."""

    __tablename__ = "web_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(String(64), unique=True, nullable=False)
    email = Column(String(255))
    phone = Column(String(20))
    full_name = Column(String(255))
    password_hash = Column(String(255))
    role = Column(String(20), default=UserRole.single.name)
    privacy_settings = Column(JSON, default=dict)
    telegram_user_id = Column(Integer, ForeignKey("tg_users.id"))
    birthday = Column(Date)
    language = Column(String(10))
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Group(Base):  # Группа
    __tablename__ = "groups"

    id = Column(BigInteger, primary_key=True)
    telegram_id = Column(BigInteger, unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    type = Column(Enum(GroupType), default=GroupType.private)
    owner_id = Column(BigInteger, ForeignKey("tg_users.telegram_id"))
    description = Column(String(500))
    participants_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Channel(Base):  # Канал
    __tablename__ = "channels"

    id = Column(BigInteger, primary_key=True)
    telegram_id = Column(BigInteger, unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    type = Column(Enum(ChannelType), default=ChannelType.channel)
    owner_id = Column(BigInteger, ForeignKey("tg_users.telegram_id"))
    username = Column(String(32))
    participants_count = Column(Integer, default=0)
    description = Column(String(500))
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class UserGroup(Base):  # Связь пользователь-группа (многие ко многим)
    __tablename__ = "user_group"

    user_id = Column(
        BigInteger, ForeignKey("tg_users.telegram_id"), primary_key=True
    )
    group_id = Column(
        BigInteger, ForeignKey("groups.telegram_id"), primary_key=True
    )
    is_owner = Column(Boolean, default=False)
    is_moderator = Column(Boolean, default=False)
    joined_at = Column(DateTime, default=utcnow)


# ---------------------------------------------------------------------------
# Task model
# ---------------------------------------------------------------------------

class TaskStatus(PyEnum):
    """Possible statuses for :class:`Task`."""
    todo = "todo"
    in_progress = "in_progress"
    done = "done"


class Task(Base):
    """Basic task item owned by a telegram user."""

    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("tg_users.telegram_id"))
    title = Column(String(255), nullable=False)
    description = Column(String(500))
    due_date = Column(DateTime)
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

    checkpoints = relationship(
        "TaskCheckpoint", backref="task", cascade="all, delete-orphan"
    )
    exceptions = relationship(
        "ScheduleException", backref="task", cascade="all, delete-orphan"
    )

    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


# ---------------------------------------------------------------------------
# Reminder model
# ---------------------------------------------------------------------------

class Reminder(Base):
    """Simple reminder item owned by a telegram user."""

    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("tg_users.telegram_id"))
    task_id = Column(Integer, ForeignKey("tasks.id"))
    message = Column(String(500), nullable=False)
    remind_at = Column(DateTime, nullable=False)
    is_done = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


# ---------------------------------------------------------------------------
# CalendarEvent model
# ---------------------------------------------------------------------------

class CalendarEvent(Base):
    """Calendar event item owned by a telegram user."""

    __tablename__ = "calendar_events"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("tg_users.telegram_id"))
    title = Column(String(255), nullable=False)
    start_at = Column(DateTime, default=utcnow, nullable=False)
    end_at = Column(DateTime)
    description = Column(String(500))
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


# ---------------------------------------------------------------------------
# TimeEntry model
# ---------------------------------------------------------------------------

class TimeEntry(Base):
    """Time tracking entry for a telegram user."""

    __tablename__ = "time_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("tg_users.telegram_id"))
    start_time = Column(DateTime, default=utcnow, nullable=False)
    end_time = Column(DateTime)
    description = Column(String(500))
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


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
    owner_id = Column(BigInteger, ForeignKey("tg_users.telegram_id"))
    name = Column(String(255), nullable=False)
    type = Column(Enum(AreaType))
    color = Column(String(7))
    context_map = Column(JSON, default=dict)
    review_interval = Column(Integer)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, autoincrement=True)
    area_id = Column(Integer, ForeignKey("areas.id"))
    owner_id = Column(BigInteger, ForeignKey("tg_users.telegram_id"))
    name = Column(String(255), nullable=False)
    description = Column(String(500))
    cognitive_cost = Column(Integer)
    neural_priority = Column(Float)
    schedule = Column(JSON, default=dict)
    metrics = Column(JSON, default=dict)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Habit(Base):
    __tablename__ = "habits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("tg_users.telegram_id"))
    name = Column(String(255), nullable=False)
    description = Column(String(500))
    schedule = Column(JSON, default=dict)
    metrics = Column(JSON, default=dict)
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Resource(Base):
    __tablename__ = "resources"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("tg_users.telegram_id"))
    title = Column(String(255), nullable=False)
    content = Column(String(2000))
    type = Column(String(50))
    meta = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


# ---------------------------------------------------------------------------
# Note model (сохранено из ветки main)
# ---------------------------------------------------------------------------

class Note(Base):
    """Simple note item owned by a telegram user."""

    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("tg_users.telegram_id"))
    content = Column(String(1000), nullable=False)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Archive(Base):
    __tablename__ = "archives"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("tg_users.telegram_id"))
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
    owner_id = Column(BigInteger, ForeignKey("tg_users.telegram_id"))
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
    owner_id = Column(BigInteger, ForeignKey("tg_users.telegram_id"))
    name = Column(String(255), nullable=False)
    config = Column(JSON, default=dict)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)


class Limit(Base):
    __tablename__ = "limits"

    id = Column(Integer, primary_key=True, autoincrement=True)
    owner_id = Column(BigInteger, ForeignKey("tg_users.telegram_id"))
    resource = Column(String(50), nullable=False)
    value = Column(Integer, nullable=False)
    expires_at = Column(DateTime)


class Role(Base):
    __tablename__ = "roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False)
    level = Column(Integer, default=0)
    description = Column(String(255))


class Perm(Base):
    __tablename__ = "perms"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(50), unique=True, nullable=False)
    description = Column(String(255))


class UserRoleLink(Base):
    __tablename__ = "user_roles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("web_users.id"))
    role_id = Column(Integer, ForeignKey("roles.id"))
    expires_at = Column(DateTime)


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
    level = Column(Enum(LogLevel), default=LogLevel.ERROR)  # Уровень логирования
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    def __repr__(self) -> str:  # pragma: no cover - debug aid
        return f"<LogSettings(level='{self.level}', chat_id='{self.chat_id}')>"
