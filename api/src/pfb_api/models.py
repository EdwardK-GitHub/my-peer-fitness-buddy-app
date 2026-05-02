from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base

def utc_now() -> datetime:
    return datetime.now(timezone.utc)

class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utc_now, onupdate=utc_now
    )

class User(TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("email_normalized", name="uq_users_email_normalized"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_normalized: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    sessions: Mapped[list[Session]] = relationship(back_populates="user", cascade="all, delete-orphan")
    hosted_events: Mapped[list[Event]] = relationship(back_populates="host")
    attendances: Mapped[list[EventAttendance]] = relationship(back_populates="user")
    likes: Mapped[list[EventLike]] = relationship(back_populates="user")
    badge_applications: Mapped[list[BadgeApplication]] = relationship(back_populates="user")
    badges: Mapped[list[UserBadge]] = relationship(back_populates="user")

class Admin(TimestampMixin, Base):
    __tablename__ = "admins"
    __table_args__ = (UniqueConstraint("email_normalized", name="uq_admins_email_normalized"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    email_normalized: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(512), nullable=False)
    full_name: Mapped[str] = mapped_column(String(120), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    sessions: Mapped[list[Session]] = relationship(back_populates="admin", cascade="all, delete-orphan")
    reviewed_badge_applications: Mapped[list[BadgeApplication]] = relationship(back_populates="reviewer_admin")
    granted_badges: Mapped[list[UserBadge]] = relationship(back_populates="granted_by_admin")

class Session(TimestampMixin, Base):
    __tablename__ = "sessions"
    __table_args__ = (UniqueConstraint("token_hash", name="uq_sessions_token_hash"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    actor_type: Mapped[str] = mapped_column(String(16), nullable=False)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    admin_id: Mapped[str | None] = mapped_column(ForeignKey("admins.id", ondelete="CASCADE"))
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    csrf_token: Mapped[str] = mapped_column(String(64), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    user: Mapped[User | None] = relationship(back_populates="sessions")
    admin: Mapped[Admin | None] = relationship(back_populates="sessions")

# FReq 4: Facilities management model
class Facility(TimestampMixin, Base):
    __tablename__ = "facilities"
    __table_args__ = (UniqueConstraint("slug", name="uq_facilities_slug"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    slug: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text())
    address_line: Mapped[str | None] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    events: Mapped[list[Event]] = relationship(back_populates="facility")

# FReq 1 & 3: Events Core Data model
class Event(TimestampMixin, Base):
    __tablename__ = "events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    host_user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    activity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    capacity: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="active")
    location_type: Mapped[str] = mapped_column(String(24), nullable=False)
    facility_id: Mapped[str | None] = mapped_column(ForeignKey("facilities.id", ondelete="SET NULL"))
    location_label: Mapped[str | None] = mapped_column(String(255))
    location_details: Mapped[str | None] = mapped_column(Text())
    notes: Mapped[str | None] = mapped_column(Text())

    host: Mapped[User] = relationship(back_populates="hosted_events")
    facility: Mapped[Facility | None] = relationship(back_populates="events")
    attendees: Mapped[list[EventAttendance]] = relationship(back_populates="event")
    likes: Mapped[list[EventLike]] = relationship(back_populates="event")

class EventAttendance(TimestampMixin, Base):
    __tablename__ = "event_attendees"
    __table_args__ = (UniqueConstraint("event_id", "user_id", name="uq_event_attendees_event_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    event: Mapped[Event] = relationship(back_populates="attendees")
    user: Mapped[User] = relationship(back_populates="attendances")

# FReq 5: Social Validation 'like' model
class EventLike(TimestampMixin, Base):
    __tablename__ = "event_likes"
    __table_args__ = (UniqueConstraint("event_id", "user_id", name="uq_event_likes_event_user"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    event_id: Mapped[str] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    event: Mapped[Event] = relationship(back_populates="likes")
    user: Mapped[User] = relationship(back_populates="likes")

# FReq 6: Trust Badges models
class BadgeType(TimestampMixin, Base):
    __tablename__ = "badge_types"
    __table_args__ = (UniqueConstraint("code", name="uq_badge_types_code"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text())
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    applications: Mapped[list[BadgeApplication]] = relationship(back_populates="badge_type")
    user_badges: Mapped[list[UserBadge]] = relationship(back_populates="badge_type")

class BadgeApplication(TimestampMixin, Base):
    __tablename__ = "badge_applications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    badge_type_id: Mapped[str] = mapped_column(ForeignKey("badge_types.id", ondelete="CASCADE"), nullable=False)
    status: Mapped[str] = mapped_column(String(24), nullable=False, default="submitted")
    applicant_message: Mapped[str | None] = mapped_column(Text())
    reviewer_admin_id: Mapped[str | None] = mapped_column(ForeignKey("admins.id", ondelete="SET NULL"))
    decision_notes: Mapped[str | None] = mapped_column(Text())
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped[User] = relationship(back_populates="badge_applications")
    badge_type: Mapped[BadgeType] = relationship(back_populates="applications")
    reviewer_admin: Mapped[Admin | None] = relationship(back_populates="reviewed_badge_applications")

class UserBadge(TimestampMixin, Base):
    __tablename__ = "user_badges"
    __table_args__ = (UniqueConstraint("user_id", "badge_type_id", name="uq_user_badges_user_badge_type"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    badge_type_id: Mapped[str] = mapped_column(ForeignKey("badge_types.id", ondelete="CASCADE"), nullable=False)
    granted_by_admin_id: Mapped[str | None] = mapped_column(ForeignKey("admins.id", ondelete="SET NULL"))
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utc_now)

    user: Mapped[User] = relationship(back_populates="badges")
    badge_type: Mapped[BadgeType] = relationship(back_populates="user_badges")
    granted_by_admin: Mapped[Admin | None] = relationship(back_populates="granted_badges")


# FReq 4: Admin settings for running region limits
class AppSetting(TimestampMixin, Base):
    __tablename__ = "app_settings"
    
    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value: Mapped[str] = mapped_column(String(255), nullable=False)