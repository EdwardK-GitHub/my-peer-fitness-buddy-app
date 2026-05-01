from __future__ import annotations

import json
from datetime import datetime, timezone
from http import HTTPStatus
from typing import Any

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session as DbSession
from sqlalchemy.orm import joinedload

from ..http import HTTPError, Request, json_response
from ..models import Event, EventAttendance, EventLike, Facility, User, UserBadge, utc_now
from ..security import load_auth_context, require_user

# These limits keep student-created events realistic and easy to manage.
# FReq 1.1: Every event has a capacity.
MIN_EVENT_CAPACITY = 2
MAX_EVENT_CAPACITY = 50

# FReq 1.1: Activity type is required and should stay readable in event cards.
MAX_ACTIVITY_TYPE_LENGTH = 80

# Notes are optional, but keeping them bounded protects the UI and database.
MAX_NOTES_LENGTH = 1000

# Running location labels can come from map search results, so they may be longer than facility names.
MAX_LOCATION_LABEL_LENGTH = 255


def _single_query_value(request: Request, key: str) -> str | None:
    """Return the first query-string value for a key.

    The lightweight WSGI request object stores query parameters as lists. This helper keeps all
    route handlers consistent when reading optional filters.
    """
    value = request.query_params.get(key, [None])[0]
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _as_utc(value: datetime) -> datetime:
    """Normalize datetimes so comparisons never mix naive and aware values.

    FReq 1.1, FReq 2.1, and FReq 3 depend on reliable event time comparisons. Browser inputs may
    arrive with or without timezone information, so the API normalizes everything to UTC.
    """
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _parse_iso_datetime(value: str | None, field_name: str) -> datetime:
    """Parse an ISO datetime sent by the frontend.

    A clear HTTP 400 response is returned when the user enters an invalid date/time.
    """
    if not value:
        raise HTTPError(HTTPStatus.BAD_REQUEST, f"{field_name} is required")

    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise HTTPError(HTTPStatus.BAD_REQUEST, f"{field_name} must be a valid date and time") from exc

    return _as_utc(parsed)


def _event_is_past(event: Event, now: datetime | None = None) -> bool:
    """Return whether an event has already occurred."""
    reference_time = now or utc_now()
    return _as_utc(event.scheduled_at) < reference_time


def _event_is_active(event: Event) -> bool:
    """Return whether the event is currently active."""
    return event.status == "active"


def _attendee_user_ids(event: Event) -> set[str]:
    """Return the user IDs of students who joined as attendees."""
    return {attendance.user_id for attendance in event.attendees}


def _participant_count(event: Event) -> int:
    """Count the host plus all joined attendees.

    FReq 2.2 requires showing current attendance versus capacity. In the product behavior, the
    host is already participating, so capacity is measured as host + attendees.
    """
    return 1 + len(event.attendees)


def _spots_remaining(event: Event) -> int:
    """Return how many participant spots are still open."""
    return max(event.capacity - _participant_count(event), 0)


def _serialize_event(
    event: Event,
    *,
    current_user_id: str | None = None,
    include_attendees: bool = False,
) -> dict[str, Any]:
    """Serialize an event for the frontend.

    FReq 1: exposes created event details.
    FReq 2: exposes browsing/joining state and attendance versus capacity.
    FReq 3: exposes upcoming/past management state and host attendee lists when appropriate.
    """
    attendee_ids = _attendee_user_ids(event)
    participant_count = _participant_count(event)
    is_host = current_user_id == event.host_user_id if current_user_id else False
    joined = current_user_id in attendee_ids if current_user_id else False
    is_past = _event_is_past(event)
    is_active = _event_is_active(event)

    # FReq 6.5 is included here because approved host badges are displayed on event cards.
    host_badges = [badge.badge_type.code for badge in event.host.badges]

    has_liked = (
        any(like.user_id == current_user_id for like in event.likes)
        if current_user_id
        else False
    )

    can_join = bool(
        current_user_id
        and is_active
        and not is_past
        and not is_host
        and not joined
        and participant_count < event.capacity
    )
    can_withdraw = bool(current_user_id and is_active and not is_past and joined and not is_host)
    can_cancel = bool(current_user_id and is_active and not is_past and is_host)

    payload: dict[str, Any] = {
        "id": event.id,
        "activityType": event.activity_type,
        "scheduledAt": _as_utc(event.scheduled_at).isoformat(),
        "capacity": event.capacity,
        "status": event.status,
        "locationType": event.location_type,
        "locationLabel": event.location_label,
        "locationDetails": event.location_details,
        "notes": event.notes,
        "facility": {"id": event.facility.id, "name": event.facility.name}
        if event.facility
        else None,
        "host": {
            "id": event.host.id,
            "fullName": event.host.full_name,
            "badges": host_badges,
        },
        "attendeeCount": len(event.attendees),
        "participantCount": participant_count,
        "attendanceCount": participant_count,
        "spotsRemaining": _spots_remaining(event),
        "joined": joined,
        "isHost": is_host,
        "isPast": is_past,
        "liked": has_liked,
        "likeCount": len(event.likes),
        "canJoin": can_join,
        "canWithdraw": can_withdraw,
        "canCancel": can_cancel,
    }

    # FReq 3.4: Hosts can see who signed up for their hosted events.
    # Attendee lists are not included in public browse responses unless the current user is the host.
    if include_attendees and is_host:
        payload["attendees"] = [
            {"id": attendance.user.id, "fullName": attendance.user.full_name}
            for attendance in event.attendees
        ]
    else:
        payload["attendees"] = []

    return payload


def _validate_activity_type(value: Any) -> str:
    """Validate and normalize an event activity type.

    FReq 1.1 requires each event to have an activity type.
    """
    activity_type = str(value or "").strip()
    if not activity_type:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Activity type is required")
    if len(activity_type) > MAX_ACTIVITY_TYPE_LENGTH:
        raise HTTPError(
            HTTPStatus.BAD_REQUEST,
            f"Activity type must be {MAX_ACTIVITY_TYPE_LENGTH} characters or fewer",
        )
    return activity_type


def _validate_capacity(value: Any) -> int:
    """Validate event capacity.

    The host counts as one participant, so capacity must allow at least one additional student.
    """
    try:
        capacity = int(value)
    except (TypeError, ValueError) as exc:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Capacity must be a whole number") from exc

    if capacity < MIN_EVENT_CAPACITY:
        raise HTTPError(
            HTTPStatus.BAD_REQUEST,
            f"Capacity must be at least {MIN_EVENT_CAPACITY} because the host is included",
        )
    if capacity > MAX_EVENT_CAPACITY:
        raise HTTPError(
            HTTPStatus.BAD_REQUEST,
            f"Capacity cannot be greater than {MAX_EVENT_CAPACITY}",
        )
    return capacity


def _validate_notes(value: Any) -> str | None:
    """Validate optional event notes."""
    notes = str(value or "").strip()
    if not notes:
        return None
    if len(notes) > MAX_NOTES_LENGTH:
        raise HTTPError(
            HTTPStatus.BAD_REQUEST,
            f"Notes must be {MAX_NOTES_LENGTH} characters or fewer",
        )
    return notes


def _validate_location_type(value: Any) -> str:
    """Validate event location type.

    FReq 1.2 requires each event to be either facility-based or running-based.
    """
    location_type = str(value or "").strip()
    if location_type not in {"facility", "running"}:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Choose either a facility event or a running event")
    return location_type


def _validate_running_location(label_value: Any, details_value: Any) -> tuple[str, str]:
    """Validate the detailed location for running events.

    FReq 1.4 requires running-based events to include a detailed location description.
    """
    location_label = str(label_value or "").strip()
    location_details = str(details_value or "").strip()

    if not location_label or not location_details:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Select a running location before posting the event")

    if len(location_label) > MAX_LOCATION_LABEL_LENGTH:
        raise HTTPError(
            HTTPStatus.BAD_REQUEST,
            f"Running location label must be {MAX_LOCATION_LABEL_LENGTH} characters or fewer",
        )

    # The current frontend stores selected map coordinates as JSON. The backend accepts that shape
    # and validates latitude/longitude when JSON coordinates are provided.
    try:
        parsed = json.loads(location_details)
    except json.JSONDecodeError:
        return location_label, location_details

    if isinstance(parsed, dict) and {"lat", "lng"}.issubset(parsed):
        try:
            lat = float(parsed["lat"])
            lng = float(parsed["lng"])
        except (TypeError, ValueError) as exc:
            raise HTTPError(HTTPStatus.BAD_REQUEST, "Running map coordinates are invalid") from exc

        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise HTTPError(HTTPStatus.BAD_REQUEST, "Running map coordinates are outside valid bounds")

    return location_label, location_details


def list_events(request: Request, start_response, db: DbSession):
    """List upcoming active events for browsing.

    FReq 2.1: supports a user-specified time range.
    FReq 2.2: displays key event details, host, and participant count versus capacity.
    """
    auth = load_auth_context(db, request, "user")
    current_user_id = auth.user.id if auth and auth.user else None

    now = utc_now()
    filters = [Event.status == "active"]

    from_value = _single_query_value(request, "from")
    to_value = _single_query_value(request, "to")
    from_dt = _parse_iso_datetime(from_value, "Start time") if from_value else None
    to_dt = _parse_iso_datetime(to_value, "End time") if to_value else None

    if from_dt and to_dt and from_dt > to_dt:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Start time must be before end time")

    # Browse/discovery should only show upcoming events. Past events belong in My Events history.
    effective_from = max(from_dt, now) if from_dt else now
    filters.append(Event.scheduled_at >= effective_from)

    if to_dt:
        filters.append(Event.scheduled_at <= to_dt)

    location_type = _single_query_value(request, "locationType")
    if location_type:
        if location_type not in {"facility", "running"}:
            raise HTTPError(HTTPStatus.BAD_REQUEST, "Invalid location type filter")
        filters.append(Event.location_type == location_type)

    q = _single_query_value(request, "q")
    if q:
        like = f"%{q}%"
        filters.append(
            or_(
                Event.activity_type.ilike(like),
                Event.location_label.ilike(like),
                Event.notes.ilike(like),
                Event.host.has(User.full_name.ilike(like)),
            )
        )

    try:
        limit = min(max(int(_single_query_value(request, "limit") or "20"), 1), 100)
    except ValueError:
        limit = 20

    try:
        offset = max(int(_single_query_value(request, "offset") or "0"), 0)
    except ValueError:
        offset = 0

    count_stmt = select(func.count(Event.id)).where(*filters)
    total = db.scalar(count_stmt) or 0

    query = (
        select(Event)
        .options(
            joinedload(Event.host).joinedload(User.badges).joinedload(UserBadge.badge_type),
            joinedload(Event.facility),
            joinedload(Event.attendees).joinedload(EventAttendance.user),
            joinedload(Event.likes),
        )
        .where(*filters)
        .order_by(Event.scheduled_at.asc())
        .limit(limit)
        .offset(offset)
    )
    events = db.scalars(query).unique().all()

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "events": [
                _serialize_event(event, current_user_id=current_user_id)
                for event in events
            ],
            "total": total,
        },
    )


def my_events(request: Request, start_response, db: DbSession):
    """Return upcoming and past events for the signed-in user.

    FReq 3.1: upcoming hosted and joined events.
    FReq 3.2: past hosted and joined events.
    FReq 3.3: each event includes active/canceled status.
    FReq 3.4: hosts receive attendee lists for hosted events.
    """
    auth = require_user(db, request)

    query = (
        select(Event)
        .options(
            joinedload(Event.host).joinedload(User.badges).joinedload(UserBadge.badge_type),
            joinedload(Event.facility),
            joinedload(Event.attendees).joinedload(EventAttendance.user),
            joinedload(Event.likes),
        )
        .where(
            or_(
                Event.host_user_id == auth.user.id,
                Event.id.in_(
                    select(EventAttendance.event_id).where(EventAttendance.user_id == auth.user.id)
                ),
            )
        )
        .order_by(Event.scheduled_at.asc())
    )

    events = db.scalars(query).unique().all()
    now = utc_now()

    upcoming = [
        _serialize_event(event, current_user_id=auth.user.id, include_attendees=True)
        for event in events
        if not _event_is_past(event, now)
    ]
    past = [
        _serialize_event(event, current_user_id=auth.user.id, include_attendees=True)
        for event in events
        if _event_is_past(event, now)
    ]

    return json_response(start_response, HTTPStatus.OK, {"upcoming": upcoming, "past": past})


def create_event(request: Request, start_response, db: DbSession):
    """Create a new event hosted by the signed-in student.

    FReq 1.1: date/time, capacity, and activity type are required.
    FReq 1.2: location type must be facility-based or running-based.
    FReq 1.3: facility events must use an active admin-managed facility.
    FReq 1.4: running events must include a detailed selected running location.
    FReq 1.5: host is stored as the event creator.
    FReq 1.6: missing or invalid required fields are rejected.
    """
    auth = require_user(db, request)
    body = request.json_body or {}

    activity_type = _validate_activity_type(body.get("activityType"))
    scheduled_at = _parse_iso_datetime(body.get("scheduledAt"), "Event date and time")
    capacity = _validate_capacity(body.get("capacity"))
    location_type = _validate_location_type(body.get("locationType"))
    notes = _validate_notes(body.get("notes"))

    if scheduled_at <= utc_now():
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Event date and time must be in the future")

    event = Event(
        host_user_id=auth.user.id,
        activity_type=activity_type,
        scheduled_at=scheduled_at,
        capacity=capacity,
        location_type=location_type,
        status="active",
        notes=notes,
    )

    if location_type == "facility":
        facility_id = str(body.get("facilityId") or "").strip()
        if not facility_id:
            raise HTTPError(HTTPStatus.BAD_REQUEST, "Select a facility before posting the event")

        facility = db.scalar(
            select(Facility).where(Facility.id == facility_id, Facility.is_active.is_(True))
        )
        if facility is None:
            raise HTTPError(HTTPStatus.BAD_REQUEST, "Selected facility is not available")

        event.facility_id = facility.id
        event.location_label = facility.name
        event.location_details = facility.address_line

    if location_type == "running":
        location_label, location_details = _validate_running_location(
            body.get("locationLabel"),
            body.get("locationDetails"),
        )
        event.location_label = location_label
        event.location_details = location_details

    db.add(event)
    db.commit()
    db.refresh(event)

    return json_response(
        start_response,
        HTTPStatus.CREATED,
        {
            "message": "Event created",
            "eventId": event.id,
        },
    )


def join_event(request: Request, start_response, db: DbSession):
    """Join an upcoming active event as an attendee.

    FReq 2.3: users can join only if the event is active and not full.
    FReq 2.4: users cannot join the same event more than once.
    """
    auth = require_user(db, request)
    event_id = request.path_params.get("id")

    event = db.scalar(
        select(Event)
        .options(joinedload(Event.attendees))
        .where(Event.id == event_id)
    )
    if event is None:
        raise HTTPError(HTTPStatus.NOT_FOUND, "Event not found")

    if event.host_user_id == auth.user.id:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "You are already the host of this event")

    if not _event_is_active(event):
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Canceled events cannot be joined")

    if _event_is_past(event):
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Past events cannot be joined")

    if any(attendance.user_id == auth.user.id for attendance in event.attendees):
        raise HTTPError(HTTPStatus.BAD_REQUEST, "You have already joined this event")

    if _participant_count(event) >= event.capacity:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "This event is already full")

    db.add(EventAttendance(event_id=event.id, user_id=auth.user.id))
    db.commit()

    return json_response(start_response, HTTPStatus.OK, {"message": "Joined event"})


def withdraw_event(request: Request, start_response, db: DbSession):
    """Withdraw from an upcoming active event.

    FReq 3.5: attendees can withdraw from events they joined.
    """
    auth = require_user(db, request)
    event_id = request.path_params.get("id")

    event = db.scalar(
        select(Event)
        .options(joinedload(Event.attendees))
        .where(Event.id == event_id)
    )
    if event is None:
        raise HTTPError(HTTPStatus.NOT_FOUND, "Event not found")

    if event.host_user_id == auth.user.id:
        raise HTTPError(
            HTTPStatus.BAD_REQUEST,
            "Hosts cannot withdraw from their own events. Cancel the event instead.",
        )

    if not _event_is_active(event):
        raise HTTPError(HTTPStatus.BAD_REQUEST, "You cannot withdraw from a canceled event")

    if _event_is_past(event):
        raise HTTPError(HTTPStatus.BAD_REQUEST, "You cannot withdraw from a past event")

    attendance = next(
        (item for item in event.attendees if item.user_id == auth.user.id),
        None,
    )
    if attendance is None:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "You are not an attendee of this event")

    db.delete(attendance)
    db.commit()

    return json_response(start_response, HTTPStatus.OK, {"message": "Withdrawn from event"})


def cancel_event(request: Request, start_response, db: DbSession):
    """Cancel an upcoming active event hosted by the signed-in student.

    FReq 3.6: only the host can cancel the event they created.
    """
    auth = require_user(db, request)
    event_id = request.path_params.get("id")

    event = db.scalar(select(Event).where(Event.id == event_id))
    if event is None:
        raise HTTPError(HTTPStatus.NOT_FOUND, "Event not found")

    if event.host_user_id != auth.user.id:
        raise HTTPError(HTTPStatus.FORBIDDEN, "Only the host can cancel this event")

    if not _event_is_active(event):
        raise HTTPError(HTTPStatus.BAD_REQUEST, "This event is already canceled")

    if _event_is_past(event):
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Past events cannot be canceled")

    event.status = "canceled"
    db.commit()

    return json_response(start_response, HTTPStatus.OK, {"message": "Event canceled"})


def like_event(request: Request, start_response, db: DbSession):
    """Like a past attended event.

    FReq 5 support remains here because My Events displays past attended event likes.
    """
    auth = require_user(db, request)
    event_id = request.path_params.get("id")

    event = db.scalar(
        select(Event)
        .options(joinedload(Event.attendees))
        .where(Event.id == event_id)
    )

    if event is None or not _event_is_past(event):
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Only past events can be liked")

    if not any(attendance.user_id == auth.user.id for attendance in event.attendees):
        raise HTTPError(HTTPStatus.FORBIDDEN, "Only attendees can like this event")

    existing_like = db.scalar(
        select(EventLike).where(
            and_(EventLike.event_id == event_id, EventLike.user_id == auth.user.id)
        )
    )
    if existing_like is not None:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "You already liked this event")

    db.add(EventLike(event_id=event.id, user_id=auth.user.id))
    db.commit()

    return json_response(start_response, HTTPStatus.OK, {"message": "Event liked"})
