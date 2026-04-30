from __future__ import annotations
from datetime import datetime
from http import HTTPStatus
from sqlalchemy import or_, select, and_, func
from sqlalchemy.orm import Session as DbSession, joinedload

from ..http import Request, json_response, HTTPError
from ..models import Event, EventAttendance, EventLike, Facility, User, UserBadge, utc_now
from ..security import require_user

def _serialize_event(event: Event, *, current_user_id: str | None = None) -> dict:
    attendee_user_ids = [attendance.user_id for attendance in event.attendees]
    
    # FReq 6.5: Display approved trust badges on posted events
    host_badges = [b.badge_type.code for b in event.host.badges] 
    
    # Check if the current user has liked this event (FReq 5.4)
    has_liked = any(like.user_id == current_user_id for like in event.likes) if current_user_id else False

    return {
        "id": event.id,
        "activityType": event.activity_type,
        "scheduledAt": event.scheduled_at.isoformat(),
        "capacity": event.capacity,
        "status": event.status,
        "locationType": event.location_type,
        "locationLabel": event.location_label,
        "locationDetails": event.location_details,
        "facility": {"id": event.facility.id, "name": event.facility.name} if event.facility else None,
        "host": {"id": event.host.id, "fullName": event.host.full_name, "badges": host_badges},
        "attendanceCount": len(event.attendees),
        "joined": current_user_id in attendee_user_ids if current_user_id else False,
        "attendees": [{"id": att.user.id, "fullName": att.user.full_name} for att in event.attendees], # FReq 3.4 Host sees attendees
        "liked": has_liked,
        "likeCount": len(event.likes)
    }

def list_events(request: Request, start_response, db: DbSession):
    # FReq 2: Allow users to browse and join events
    filters = []

    # FReq 2.1: Search by user-specified time range
    from_value = request.query_params.get("from", [None])[0]
    to_value = request.query_params.get("to", [None])[0]
    if from_value:
        filters.append(Event.scheduled_at >= datetime.fromisoformat(from_value.replace("Z", "+00:00")))
    if to_value:
        filters.append(Event.scheduled_at <= datetime.fromisoformat(to_value.replace("Z", "+00:00")))

    # Filter by location type
    location_type = request.query_params.get("locationType", [None])[0]
    if location_type in ("facility", "running"):
        filters.append(Event.location_type == location_type)

    q = (request.query_params.get("q", [None])[0] or "").strip()
    if q:
        like = f"%{q}%"
        filters.append(or_(
            Event.activity_type.ilike(like),
            Event.location_label.ilike(like),
            Event.host.has(User.full_name.ilike(like)),
        ))

    # Pagination 
    try:
        limit = min(max(int(request.query_params.get("limit", ["20"])[0]), 1), 100)
    except (TypeError, ValueError):
        limit = 20
    try:
        offset = max(int(request.query_params.get("offset", ["0"])[0]), 0)
    except (TypeError, ValueError):
        offset = 0

    
    count_stmt = select(func.count()).select_from(Event)
    if filters:
        count_stmt = count_stmt.where(*filters)
    total = db.scalar(count_stmt) or 0

    query = select(Event).options(
        joinedload(Event.host).joinedload(User.badges).joinedload(UserBadge.badge_type),
        joinedload(Event.facility),
        joinedload(Event.attendees).joinedload(EventAttendance.user),
        joinedload(Event.likes),
    ).order_by(Event.scheduled_at.asc())

    if filters:
        query = query.where(*filters)

    query = query.limit(limit).offset(offset)
    events = db.scalars(query).unique().all()

    return json_response(start_response, HTTPStatus.OK, {
        "events": [_serialize_event(event) for event in events],
        "total": total,
    })

def my_events(request: Request, start_response, db: DbSession):
    # FReq 3.1 & 3.2: View upcoming and past events (hosted and joined)
    auth = require_user(db, request)
    query = select(Event).options(joinedload(Event.host).joinedload(User.badges).joinedload(UserBadge.badge_type), joinedload(Event.facility), joinedload(Event.attendees).joinedload(EventAttendance.user), joinedload(Event.likes)).where(
        or_(Event.host_user_id == auth.user.id, Event.id.in_(select(EventAttendance.event_id).where(EventAttendance.user_id == auth.user.id)))
    ).order_by(Event.scheduled_at.asc())

    events = db.scalars(query).unique().all()
    now = utc_now()
    upcoming = [_serialize_event(event, current_user_id=auth.user.id) for event in events if event.scheduled_at >= now]
    past = [_serialize_event(event, current_user_id=auth.user.id) for event in events if event.scheduled_at < now]
    
    return json_response(start_response, HTTPStatus.OK, {"upcoming": upcoming, "past": past})

def create_event(request: Request, start_response, db: DbSession):
    # FReq 1: Let users create or post events to find workout partners
    auth = require_user(db, request)
    body = request.json_body or {}
    
    activity_type = body.get("activityType")
    scheduled_at_str = body.get("scheduledAt")
    capacity = body.get("capacity")
    location_type = body.get("locationType") # 'facility' or 'running'
    
    if not all([activity_type, scheduled_at_str, capacity, location_type]):
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Missing required fields")
        
    try:
        scheduled_at = datetime.fromisoformat(scheduled_at_str.replace("Z", "+00:00"))
        if scheduled_at < utc_now(): raise ValueError()
    except ValueError:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Invalid or past date/time")

    event = Event(host_user_id=auth.user.id, activity_type=activity_type, scheduled_at=scheduled_at, capacity=int(capacity), location_type=location_type, status="active")

    if location_type == "facility":
        # FReq 1.3: Choose from admin-managed facility list
        facility_id = body.get("facilityId")
        facility = db.scalar(select(Facility).where(Facility.id == facility_id, Facility.is_active == True))
        if not facility: raise HTTPError(HTTPStatus.BAD_REQUEST, "Invalid or inactive facility")
        event.facility_id = facility.id
        event.location_label = facility.name
    elif location_type == "running":
        # FReq 1.4: Detailed location description for running
        event.location_label = body.get("locationLabel") 
        event.location_details = body.get("locationDetails") # Store map JSON coords
    else:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Invalid location type")

    db.add(event)
    db.commit()
    db.refresh(event)
    return json_response(start_response, HTTPStatus.CREATED, {"message": "Event created"})

def join_event(request: Request, start_response, db: DbSession):
    # FReq 2.3 & 2.4: Join an event with capacity validation and prevent duplicate joins
    auth = require_user(db, request)
    event_id = request.path_params.get("id")
    event = db.scalar(select(Event).options(joinedload(Event.attendees)).where(Event.id == event_id))
    
    if not event: raise HTTPError(HTTPStatus.NOT_FOUND, "Event not found")
    if event.status == "canceled": raise HTTPError(HTTPStatus.BAD_REQUEST, "Cannot join a canceled event")
    if len(event.attendees) >= event.capacity: raise HTTPError(HTTPStatus.BAD_REQUEST, "Event is at full capacity")
    if any(att.user_id == auth.user.id for att in event.attendees): raise HTTPError(HTTPStatus.BAD_REQUEST, "Already joined")

    db.add(EventAttendance(event_id=event.id, user_id=auth.user.id))
    db.commit()
    return json_response(start_response, HTTPStatus.OK, {"message": "Joined successfully"})

def withdraw_event(request: Request, start_response, db: DbSession):
    # FReq 3.5: Attendee withdraws from an event
    auth = require_user(db, request)
    event_id = request.path_params.get("id")
    attendance = db.scalar(select(EventAttendance).where(and_(EventAttendance.event_id == event_id, EventAttendance.user_id == auth.user.id)))
    
    if not attendance: raise HTTPError(HTTPStatus.BAD_REQUEST, "Not an attendee")
    db.delete(attendance)
    db.commit()
    return json_response(start_response, HTTPStatus.OK, {"message": "Withdrawn successfully"})

def cancel_event(request: Request, start_response, db: DbSession):
    # FReq 3.6: Host cancels the event
    auth = require_user(db, request)
    event_id = request.path_params.get("id")
    event = db.scalar(select(Event).where(and_(Event.id == event_id, Event.host_user_id == auth.user.id)))
    
    if not event: raise HTTPError(HTTPStatus.FORBIDDEN, "Only host can cancel")
    event.status = "canceled"
    db.commit()
    return json_response(start_response, HTTPStatus.OK, {"message": "Event canceled"})

def like_event(request: Request, start_response, db: DbSession):
    # FReq 5.1 & 5.2: Unary "like" on past events they joined
    auth = require_user(db, request)
    event_id = request.path_params.get("id")
    event = db.scalar(select(Event).options(joinedload(Event.attendees)).where(Event.id == event_id))
    
    if not event or event.scheduled_at > utc_now(): raise HTTPError(HTTPStatus.BAD_REQUEST, "Can only like past events")
    if not any(att.user_id == auth.user.id for att in event.attendees): raise HTTPError(HTTPStatus.FORBIDDEN, "Must have attended as an attendee")
    
    existing_like = db.scalar(select(EventLike).where(and_(EventLike.event_id == event_id, EventLike.user_id == auth.user.id)))
    if existing_like: raise HTTPError(HTTPStatus.BAD_REQUEST, "Already liked")
        
    db.add(EventLike(event_id=event.id, user_id=auth.user.id))
    db.commit()
    return json_response(start_response, HTTPStatus.OK, {"message": "Event liked"})