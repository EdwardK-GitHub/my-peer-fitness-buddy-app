from __future__ import annotations

import json
from datetime import timedelta

from sqlalchemy import and_, select

from pfb_api.db import SessionLocal
from pfb_api.models import (
    Admin,
    AppSetting,
    BadgeApplication,
    BadgeType,
    Event,
    EventAttendance,
    EventLike,
    Facility,
    User,
    UserBadge,
    utc_now,
)
from pfb_api.security import hash_password, normalize_and_validate_email

# These accounts are for local development and class demonstration only.
SEED_USERS = [
    {"full_name": "Alex Rivera", "email": "alex@example.com", "password": "password123"},
    {"full_name": "Maya Chen", "email": "maya@example.com", "password": "password123"},
    {"full_name": "Jordan Kim", "email": "jordan@example.com", "password": "password123"},
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
    {
        "name": "Weight Room",
        "slug": "weight-room",
        "address_line": "Athletic center lower level",
        "description": "Strength training area with racks and free weights.",
    },
]


def upsert_user(db, *, full_name: str, email: str, password: str) -> User:
    """Create or update a local student account."""
    normalized_email, email_lookup = normalize_and_validate_email(email)
    existing = db.scalar(select(User).where(User.email_normalized == email_lookup))
    if existing is not None:
        existing.full_name = full_name
        existing.password_hash = hash_password(password)
        existing.email = normalized_email
        existing.is_active = True
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
    """Create or update a local admin account."""
    normalized_email, email_lookup = normalize_and_validate_email(email)
    existing = db.scalar(select(Admin).where(Admin.email_normalized == email_lookup))
    if existing is not None:
        existing.full_name = full_name
        existing.password_hash = hash_password(password)
        existing.email = normalized_email
        existing.is_active = True
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
    """Create or update an active facility for FReq 1.3 and FReq 4."""
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
    """Create the default Peer Trainer badge type used by the project."""
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


def ensure_settings(db) -> None:
    """Create default application settings used by the running-location selector."""
    existing = db.scalar(select(AppSetting).where(AppSetting.key == "running_region_limit"))
    if existing is None:
        db.add(AppSetting(key="running_region_limit", value="New York State, US"))
    else:
        existing.value = "New York State, US"


def add_attendee_if_missing(db, event: Event, user: User) -> None:
    """Attach a student attendee to an event if that attendance does not already exist."""
    exists = db.scalar(
        select(EventAttendance).where(
            EventAttendance.event_id == event.id,
            EventAttendance.user_id == user.id,
        )
    )
    if exists is None:
        db.add(EventAttendance(event=event, user=user))


def add_like_if_missing(db, event: Event, user: User) -> None:
    """Add a local FReq 5 like only when it does not already exist."""
    exists = db.scalar(
        select(EventLike).where(
            and_(
                EventLike.event_id == event.id,
                EventLike.user_id == user.id,
            )
        )
    )

    if exists is None:
        db.add(EventLike(event=event, user=user))


def upsert_event(
    db,
    *,
    host: User,
    activity_type: str,
    scheduled_offset: timedelta,
    capacity: int,
    status: str,
    location_type: str,
    facility: Facility | None = None,
    location_label: str | None = None,
    location_details: str | None = None,
    notes: str | None = None,
    attendees: list[User] | None = None,
) -> Event:
    """Create predictable local events that cover FReq 1, FReq 2, and FReq 3 flows."""
    event = db.scalar(
        select(Event).where(
            Event.host_user_id == host.id,
            Event.activity_type == activity_type,
        )
    )

    if event is None:
        event = Event(host=host, activity_type=activity_type)
        db.add(event)

    event.scheduled_at = utc_now() + scheduled_offset
    event.capacity = capacity
    event.status = status
    event.location_type = location_type
    event.facility = facility
    event.facility_id = facility.id if facility else None
    event.location_label = location_label or (facility.name if facility else None)
    event.location_details = location_details or (facility.address_line if facility else None)
    event.notes = notes

    db.flush()

    for attendee in attendees or []:
        add_attendee_if_missing(db, event, attendee)

    return event


def ensure_sample_events(db, users: dict[str, User], facilities: dict[str, Facility]) -> None:
    """Seed event states needed for a complete local FReq 1-5 test run."""
    alex = users["alex@example.com"]
    maya = users["maya@example.com"]
    jordan = users["jordan@example.com"]

    brooklyn_gym = facilities["brooklyn-athletic-facility"]
    weight_room = facilities["weight-room"]

    # FReq 1 + FReq 2: A normal upcoming facility event with open spots.
    upsert_event(
        db,
        host=alex,
        activity_type="Upper Body Gym Session",
        scheduled_offset=timedelta(days=3),
        capacity=4,
        status="active",
        location_type="facility",
        facility=brooklyn_gym,
        notes="Beginner-friendly strength session. Bring water and arrive 10 minutes early.",
        attendees=[maya],
    )

    # FReq 1 + FReq 2: A normal upcoming running event with map-style location details.
    upsert_event(
        db,
        host=maya,
        activity_type="Morning Campus Run",
        scheduled_offset=timedelta(days=4),
        capacity=5,
        status="active",
        location_type="running",
        location_label="Brooklyn Bridge Park, Brooklyn, NY",
        location_details=json.dumps({"lat": 40.7003, "lng": -73.9967}),
        notes="Easy pace run near campus. Good for beginners.",
        attendees=[jordan],
    )

    # FReq 2 edge case: Full event because capacity includes the host plus one attendee.
    upsert_event(
        db,
        host=jordan,
        activity_type="Beginner Strength Circuit",
        scheduled_offset=timedelta(days=5),
        capacity=2,
        status="active",
        location_type="facility",
        facility=weight_room,
        notes="This event is intentionally full for local testing.",
        attendees=[alex],
    )

    # FReq 3 edge case: Canceled upcoming event remains visible in My Events but is not joinable.
    upsert_event(
        db,
        host=alex,
        activity_type="Canceled Mobility Session",
        scheduled_offset=timedelta(days=6),
        capacity=6,
        status="canceled",
        location_type="facility",
        facility=brooklyn_gym,
        notes="Canceled event used to verify status display.",
        attendees=[maya],
    )

    # FReq 3 + FReq 5: Past joined event for history display and like testing.
    upsert_event(
        db,
        host=maya,
        activity_type="Past Campus Track Run",
        scheduled_offset=timedelta(days=-2),
        capacity=4,
        status="active",
        location_type="running",
        location_label="Campus Track",
        location_details=json.dumps({"lat": 40.6943, "lng": -73.9866}),
        notes="Past attended run used for My Events history.",
        attendees=[alex],
    )

    # FReq 3 + FReq 5: Past hosted event so hosts can see history and likes received.
    past_weight_room = upsert_event(
        db,
        host=alex,
        activity_type="Past Weight Room Session",
        scheduled_offset=timedelta(days=-4),
        capacity=4,
        status="active",
        location_type="facility",
        facility=weight_room,
        notes="Past hosted event used for host history.",
        attendees=[maya, jordan],
    )

    # FReq 5.3: Store a unary like associated with one attendee and one past event.
    add_like_if_missing(db, past_weight_room, maya)


def ensure_user_badge(db, *, user: User, badge_type: BadgeType, admin: Admin) -> None:
    """Grant a badge if the user does not already have it."""
    exists = db.scalar(
        select(UserBadge).where(
            UserBadge.user_id == user.id,
            UserBadge.badge_type_id == badge_type.id,
        )
    )

    if exists is None:
        db.add(
            UserBadge(
                user=user,
                badge_type=badge_type,
                granted_by_admin=admin,
            )
        )


def upsert_badge_application(
    db,
    *,
    user: User,
    badge_type: BadgeType,
    status: str,
    message: str,
    admin: Admin | None = None,
) -> BadgeApplication:
    """Create predictable FReq 6 application states for local testing."""
    application = db.scalar(
        select(BadgeApplication).where(
            BadgeApplication.user_id == user.id,
            BadgeApplication.badge_type_id == badge_type.id,
            BadgeApplication.status == status,
        )
    )

    if application is None:
        application = BadgeApplication(
            user=user,
            badge_type=badge_type,
            status=status,
        )
        db.add(application)

    application.applicant_message = message

    if status in {"approved", "denied"} and admin is not None:
        application.reviewer_admin = admin
        application.reviewed_at = utc_now() - timedelta(days=1)

    return application


def ensure_sample_badge_data(
    db,
    *,
    users: dict[str, User],
    admin: Admin,
    peer_trainer_badge: BadgeType,
) -> None:
    """Seed FReq 6 states: approved, submitted, and denied badge applications."""
    alex = users["alex@example.com"]
    maya = users["maya@example.com"]
    jordan = users["jordan@example.com"]

    # FReq 6.5: Alex has an approved badge that displays on his posted events.
    upsert_badge_application(
        db,
        user=alex,
        badge_type=peer_trainer_badge,
        status="approved",
        message="I regularly help classmates with safe beginner strength routines.",
        admin=admin,
    )
    ensure_user_badge(db, user=alex, badge_type=peer_trainer_badge, admin=admin)

    # FReq 6.2 + FReq 6.3: Maya has a pending submitted application in the admin queue.
    upsert_badge_application(
        db,
        user=maya,
        badge_type=peer_trainer_badge,
        status="submitted",
        message="I have completed campus fitness safety training and want to help peers.",
    )

    # FReq 6.2: Jordan has a denied historical application and can submit again later.
    upsert_badge_application(
        db,
        user=jordan,
        badge_type=peer_trainer_badge,
        status="denied",
        message="I want to be recognized as a peer trainer.",
        admin=admin,
    )


def main() -> None:
    with SessionLocal() as db:
        users_list = [upsert_user(db, **user_payload) for user_payload in SEED_USERS]
        admin = upsert_admin(db, **SEED_ADMIN)
        facilities_list = [
            upsert_facility(db, **facility_payload) for facility_payload in SEED_FACILITIES
        ]

        users = {user.email_normalized: user for user in users_list}
        facilities = {facility.slug: facility for facility in facilities_list}

        peer_trainer_badge = ensure_peer_trainer_badge(db)
        ensure_settings(db)

        db.flush()

        ensure_sample_events(db, users, facilities)
        ensure_sample_badge_data(
            db,
            users=users,
            admin=admin,
            peer_trainer_badge=peer_trainer_badge,
        )

        db.commit()

        print("Seed complete.")
        print(f"Admin login: {admin.email} / {SEED_ADMIN['password']}")
        for user_payload in SEED_USERS:
            print(f"User login: {user_payload['email']} / {user_payload['password']}")


if __name__ == "__main__":
    main()
