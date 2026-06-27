import enum
from datetime import datetime, date
from typing import List, Optional, Any
from sqlalchemy import String, Integer, Boolean, DateTime, Date, ForeignKey, Enum, JSON, Text, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from pgvector.sqlalchemy import Vector

class Base(DeclarativeBase):
    pass

# ==========================================
# ENUMS
# ==========================================
class RoleEnum(str, enum.Enum):
    parent = "parent"
    child = "child"
    admin = "admin"

class LocaleEnum(str, enum.Enum):
    ar = "ar"
    fr = "fr"
    en = "en"
    darija = "darija"

class VisibilityEnum(str, enum.Enum):
    private = "private"
    family = "family"

class TaskStatusEnum(str, enum.Enum):
    pending = "pending"
    in_progress = "in_progress"
    completed = "completed"
    cancelled = "cancelled"

class ActionStatusEnum(str, enum.Enum):
    proposed = "proposed"
    confirmed = "confirmed"
    executed = "executed"
    reverted = "reverted"

class ReminderChannelEnum(str, enum.Enum):
    push = "push"
    whatsapp = "whatsapp"

class ReminderStatusEnum(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"
    cancelled = "cancelled"


# ==========================================
# USERS & FAMILY
# ==========================================
class Family(Base):
    __tablename__ = "families"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    
    users: Mapped[List["User"]] = relationship(back_populates="family")
    invites: Mapped[List["FamilyInvite"]] = relationship(back_populates="family")
    tasks: Mapped[List["TaskEvent"]] = relationship(back_populates="family")


class User(Base):
    __tablename__ = "users"
    # Using string ID to easily map to Auth.js (NextAuth) UUIDs/Provider IDs
    id: Mapped[str] = mapped_column(String(255), primary_key=True) 
    family_id: Mapped[Optional[int]] = mapped_column(ForeignKey("families.id"), nullable=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    
    # Settings & Preferences
    role: Mapped[RoleEnum] = mapped_column(Enum(RoleEnum), default=RoleEnum.parent)
    timezone: Mapped[str] = mapped_column(String(100), default="UTC")
    locale: Mapped[LocaleEnum] = mapped_column(Enum(LocaleEnum), default=LocaleEnum.en)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    family: Mapped[Optional["Family"]] = relationship(back_populates="users")
    gamification_profile: Mapped["GamificationProfile"] = relationship(back_populates="user", uselist=False)
    xp_ledger: Mapped[List["XPLedger"]] = relationship(back_populates="user")
    tasks: Mapped[List["TaskEvent"]] = relationship(back_populates="user")
    wellness_logs: Mapped[List["WellnessLog"]] = relationship(back_populates="user")
    agent_logs: Mapped[List["AgentActionLog"]] = relationship(back_populates="user")
    agent_memory: Mapped[List["AgentMemory"]] = relationship(back_populates="user")


class FamilyInvite(Base):
    __tablename__ = "family_invites"
    id: Mapped[int] = mapped_column(primary_key=True)
    family_id: Mapped[int] = mapped_column(ForeignKey("families.id"))
    token: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), index=True)
    role: Mapped[RoleEnum] = mapped_column(Enum(RoleEnum), default=RoleEnum.child)
    status: Mapped[str] = mapped_column(String(50), default="pending") # pending, accepted, expired
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    family: Mapped["Family"] = relationship(back_populates="invites")


# ==========================================
# UNIFIED SCHEDULING (TASKS & EVENTS)
# ==========================================
class TaskEvent(Base):
    """
    Unified model for Tasks (todos) and Events (calendar blocks).
    If start_time and end_time are set, it occupies calendar time (Event).
    If only due_date is set, it's a floating Task.
    """
    __tablename__ = "task_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    family_id: Mapped[Optional[int]] = mapped_column(ForeignKey("families.id"), nullable=True, index=True)
    
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    is_task: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[TaskStatusEnum] = mapped_column(Enum(TaskStatusEnum), default=TaskStatusEnum.pending)
    priority: Mapped[int] = mapped_column(Integer, default=0) # 0=Low, 1=Med, 2=High
    tags: Mapped[Optional[list[str]]] = mapped_column(JSON, nullable=True) # Array of tags/categories
    
    # Timing (Timezone aware)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    origin_timezone: Mapped[str] = mapped_column(String(100), default="UTC")
    
    # Recurrence & AI Flags
    rrule: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    is_movable: Mapped[bool] = mapped_column(Boolean, default=True) # AI can reschedule this
    visibility: Mapped[VisibilityEnum] = mapped_column(Enum(VisibilityEnum), default=VisibilityEnum.private)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user: Mapped["User"] = relationship(back_populates="tasks")
    family: Mapped[Optional["Family"]] = relationship(back_populates="tasks")
    reminders: Mapped[List["Reminder"]] = relationship(back_populates="task_event", cascade="all, delete-orphan")


class Reminder(Base):
    __tablename__ = "reminders"
    id: Mapped[int] = mapped_column(primary_key=True)
    task_event_id: Mapped[int] = mapped_column(ForeignKey("task_events.id", ondelete="CASCADE"))
    
    channel: Mapped[ReminderChannelEnum] = mapped_column(Enum(ReminderChannelEnum), default=ReminderChannelEnum.push)
    fire_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[ReminderStatusEnum] = mapped_column(Enum(ReminderStatusEnum), default=ReminderStatusEnum.pending)

    task_event: Mapped["TaskEvent"] = relationship(back_populates="reminders")


# ==========================================
# GAMIFICATION
# ==========================================
class GamificationProfile(Base):
    """
    Cached/Aggregated gamification state for fast UI reads.
    """
    __tablename__ = "gamification_profiles"
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    
    level: Mapped[int] = mapped_column(Integer, default=1)
    current_xp: Mapped[int] = mapped_column(Integer, default=0)
    streak_days: Mapped[int] = mapped_column(Integer, default=0)
    streak_freezes_available: Mapped[int] = mapped_column(Integer, default=0)
    last_active_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    user: Mapped["User"] = relationship(back_populates="gamification_profile")


class XPLedger(Base):
    """
    Event-sourced ledger of all XP transactions to prevent tampering/farming.
    """
    __tablename__ = "xp_ledger"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    amount: Mapped[int] = mapped_column(Integer) # Can be negative for penalties
    reason: Mapped[str] = mapped_column(String(255)) # e.g., "completed_chore", "daily_sleep_logged"
    source_ref_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True) # Optional link to a task ID
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="xp_ledger")


# ==========================================
# WELLNESS
# ==========================================
class WellnessLog(Base):
    """
    Daily sleep and wellness logs. Serves as context for the proactive AI engine.
    """
    __tablename__ = "wellness_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    
    log_date: Mapped[date] = mapped_column(Date, index=True)
    sleep_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    sleep_quality: Mapped[Optional[int]] = mapped_column(Integer, nullable=True) # 1-5 scale
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source: Mapped[str] = mapped_column(String(100), default="manual") # manual, apple_health, oura

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    user: Mapped["User"] = relationship(back_populates="wellness_logs")


# ==========================================
# AI AUDIT & MEMORY
# ==========================================
class AgentActionLog(Base):
    """
    Strict audit trail for all AI-proposed actions. Stores the generated plan
    and the pre-execution database state to allow 1-click reverts.
    """
    __tablename__ = "agent_action_logs"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    
    action_type: Mapped[str] = mapped_column(String(100)) # e.g., "reschedule_day", "create_task"
    plan_payload: Mapped[dict] = mapped_column(JSON) # The structured Pydantic output from Gemini
    before_state: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True) # Snapshot of rows before mutation
    
    status: Mapped[ActionStatusEnum] = mapped_column(Enum(ActionStatusEnum), default=ActionStatusEnum.proposed)
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    executed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="agent_logs")


class AgentMemory(Base):
    """
    Long-term pgvector memory for the AI. Stores learned preferences, routines,
    and user facts to inject into the RAG context window.
    """
    __tablename__ = "agent_memory"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    
    content: Mapped[str] = mapped_column(Text) # e.g., "User prefers to workout before 8 AM"
    embedding: Mapped[Any] = mapped_column(Vector(768)) # Gemini 3 Pro embedding dimension
    importance: Mapped[int] = mapped_column(Integer, default=1) # 1-10 scale
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_accessed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="agent_memory")
