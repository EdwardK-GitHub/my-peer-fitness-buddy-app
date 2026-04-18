from __future__ import annotations

from datetime import datetime
from http import HTTPStatus

from sqlalchemy import or_, select
from sqlalchemy.orm import Session as DbSession, joinedload

from ..http import Request, json_response
from ..models import Event, EventAttendance, utc_now
from ..security import require_user


def _serialize_event(event: Event, *, current_user_id: str | None = None) -> dict:
    attendee_user_ids = [attendance.user_id for attendance in event.attendees]
    return {
        "id": event.id,
        "activityType": event.activity_type,
        "scheduledAt": event.scheduled_at.isoformat(),
        "capacity": event.capacity,
        "status": event.status,
        "locationType": event.location_type,
        "locationLabel": event.location_label,
        "locationDetails": event.location_details,
        "facility": (
            {
                "id": event.facility.id,
                "name": event.facility.name,
            }
            if event.facility is not None
            else None
        ),
        "host": {
            "id": event.host.id,
            "fullName": event.host.full_name,
        },
        "attendanceCount": len(event.attendees),
        "joined": current_user_id in attendee_user_ids if current_user_id else False,
    }


def list_events(request: Request, start_response, db: DbSession):
    query = (
        select(Event)
        .options(joinedload(Event.host), joinedload(Event.facility), joinedload(Event.attendees))
        .order_by(Event.scheduled_at.asc())
    )

    from_value = request.query_params.get("from", [None])[0]
    to_value = request.query_params.get("to", [None])[0]

    if from_value:
        query = query.where(Event.scheduled_at >= datetime.fromisoformat(from_value))
    if to_value:
        query = query.where(Event.scheduled_at <= datetime.fromisoformat(to_value))

    events = db.scalars(query).unique().all()
    return json_response(
        start_response,
        HTTPStatus.OK,
        {"events": [_serialize_event(event) for event in events]},
    )


def my_events(request: Request, start_response, db: DbSession):
    auth = require_user(db, request)

    query = (
        select(Event)
        .options(joinedload(Event.host), joinedload(Event.facility), joinedload(Event.attendees))
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
        _serialize_event(event, current_user_id=auth.user.id)
        for event in events
        if event.scheduled_at >= now
    ]
    past = [
        _serialize_event(event, current_user_id=auth.user.id)
        for event in events
        if event.scheduled_at < now
    ]

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "upcoming": upcoming,
            "past": past,
        },
    )


def create_placeholder(request: Request, start_response, db: DbSession):
    require_user(db, request)
    return json_response(
        start_response,
        HTTPStatus.NOT_IMPLEMENTED,
        {
            "message": "Event creation will be added in the next development step.",
            "todo": [
                "Validate date, time, capacity, and activity type",
                "Validate location type and facility lookup",
                "Insert the event and host relationship",
            ],
        },
    )