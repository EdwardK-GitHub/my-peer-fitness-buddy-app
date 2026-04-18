from __future__ import annotations

from datetime import timedelta

from sqlalchemy import select

from pfb_api.db import SessionLocal
from pfb_api.models import Admin, BadgeType, Event, EventAttendance, Facility, User, utc_now
from pfb_api.security import hash_password, normalize_and_validate_email

# These accounts exist only for local development and team test runs.
SEED_USERS = [
    {
        "full_name": "Alex Rivera",
        "email": "alex@example.com",
        "password": "password123",
    },
    {
        "full_name": "Maya Chen",
        "email": "maya@example.com",
        "password": "password123",
    },
    {
        "full_name": "Jordan Kim",
        "email": "jordan@example.com",
        "password": "password123",
    },
]

SEED_ADMIN = {
    "full_name": "Campus Fitness Admin",
    "email": "admin@example.com",
    "password": "adminpass123",
}

SEED_FACILITIES = [
    {
        "name": "Brooklyn Athletic Facility",
        "slug": "brooklyn-athletic-facility",
        "address_line": "6 MetroTech Center, Brooklyn, NY",
        "description": "Primary indoor campus fitness space.",
    },
    {
        "name": "Campus Track",
        "slug": "campus-track",
        "address_line": "Near the recreation center",
        "description": "Outdoor running and conditioning track.",
    },
]


def upsert_user(db, *, full_name: str, email: str, password: str) -> User:
    normalized_email, email_lookup = normalize_and_validate_email(email)
    existing = db.scalar(select(User).where(User.email_normalized == email_lookup))
    if existing is not None:
        existing.full_name = full_name
        existing.password_hash = hash_password(password)
        existing.email = normalized_email
        return existing

    user = User(
        full_name=full_name,
        email=normalized_email,
        email_normalized=email_lookup,
        password_hash=hash_password(password),
        is_active=True,
    )
    db.add(user)
    return user


def upsert_admin(db, *, full_name: str, email: str, password: str) -> Admin:
    normalized_email, email_lookup = normalize_and_validate_email(email)
    existing = db.scalar(select(Admin).where(Admin.email_normalized == email_lookup))
    if existing is not None:
        existing.full_name = full_name
        existing.password_hash = hash_password(password)
        existing.email = normalized_email
        return existing

    admin = Admin(
        full_name=full_name,
        email=normalized_email,
        email_normalized=email_lookup,
        password_hash=hash_password(password),
        is_active=True,
    )
    db.add(admin)
    return admin


def upsert_facility(db, *, name: str, slug: str, address_line: str, description: str) -> Facility:
    existing = db.scalar(select(Facility).where(Facility.slug == slug))
    if existing is not None:
        existing.name = name
        existing.address_line = address_line
        existing.description = description
        existing.is_active = True
        return existing

    facility = Facility(
        name=name,
        slug=slug,
        address_line=address_line,
        description=description,
        is_active=True,
    )
    db.add(facility)
    return facility


def ensure_peer_trainer_badge(db) -> BadgeType:
    existing = db.scalar(select(BadgeType).where(BadgeType.code == "peer_trainer"))
    if existing is not None:
        existing.display_name = "Peer Trainer"
        existing.description = "Approved student who can display a Peer Trainer badge on events."
        existing.is_active = True
        return existing

    badge = BadgeType(
        code="peer_trainer",
        display_name="Peer Trainer",
        description="Approved student who can display a Peer Trainer badge on events.",
        is_active=True,
    )
    db.add(badge)
    return badge


def ensure_sample_event(db, host: User, attendee: User, facility: Facility) -> None:
    # Seed one realistic event so the list pages are not empty on first run.
    existing = db.scalar(select(Event).where(Event.host_user_id == host.id))
    if existing is not None:
        return

    event = Event(
        host=host,
        activity_type="Gym Session",
        scheduled_at=utc_now() + timedelta(days=3),
        capacity=4,
        status="active",
        location_type="facility",
        facility=facility,
        location_label=facility.name,
        location_details=facility.address_line,
        notes="Bring water and arrive 10 minutes early.",
    )
    db.add(event)
    db.flush()

    db.add(EventAttendance(event=event, user=attendee))


def main() -> None:
    with SessionLocal() as db:
        users = [upsert_user(db, **user_payload) for user_payload in SEED_USERS]
        admin = upsert_admin(db, **SEED_ADMIN)
        facilities = [upsert_facility(db, **facility_payload) for facility_payload in SEED_FACILITIES]
        ensure_peer_trainer_badge(db)
        ensure_sample_event(db, users[0], users[1], facilities[0])

        db.commit()

        print("Seed complete.")
        print(f"Admin login: {admin.email} / {SEED_ADMIN['password']}")
        for user_payload in SEED_USERS:
            print(f"User login: {user_payload['email']} / {user_payload['password']}")


if __name__ == "__main__":
    main()