from __future__ import annotations

import re
from http import HTTPStatus
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from ..http import HTTPError, Request, json_response
from ..models import Facility
from ..security import require_admin

MAX_FACILITY_NAME_LENGTH = 120
MAX_FACILITY_ADDRESS_LENGTH = 255
MAX_FACILITY_DESCRIPTION_LENGTH = 1000


def slugify(text: str) -> str:
    """Create a stable URL-safe identifier from a facility name.

    FReq 4.2 and FReq 4.3 use this slug to prevent duplicate facility entries.
    """
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def _serialize_facility(facility: Facility, *, include_status: bool) -> dict[str, Any]:
    """Serialize a facility for public user screens or admin management screens."""
    payload: dict[str, Any] = {
        "id": facility.id,
        "name": facility.name,
        "slug": facility.slug,
        "description": facility.description,
        "addressLine": facility.address_line,
    }

    if include_status:
        payload["isActive"] = facility.is_active

    return payload


def _clean_optional_text(value: Any, *, max_length: int, field_name: str) -> str | None:
    """Normalize optional text fields and reject values that are too long."""
    cleaned = str(value or "").strip()
    if not cleaned:
        return None

    if len(cleaned) > max_length:
        raise HTTPError(HTTPStatus.BAD_REQUEST, f"{field_name} is too long")

    return cleaned


def _validate_facility_name(value: Any) -> tuple[str, str]:
    """Validate the required facility name and generate its slug.

    FReq 4.2: admins can add facilities.
    FReq 4.3: admins can update facility details.
    """
    name = str(value or "").strip()

    if not name:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Facility name is required")

    if len(name) > MAX_FACILITY_NAME_LENGTH:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Facility name is too long")

    slug = slugify(name)
    if not slug:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Facility name must include letters or numbers")

    return name, slug


def _validate_facility_payload(body: dict[str, Any], *, require_name: bool) -> dict[str, Any]:
    """Validate admin-provided facility data.

    The returned payload is safe to assign to the SQLAlchemy model.
    """
    payload: dict[str, Any] = {}

    if require_name or "name" in body:
        name, slug = _validate_facility_name(body.get("name"))
        payload["name"] = name
        payload["slug"] = slug

    if "addressLine" in body:
        payload["address_line"] = _clean_optional_text(
            body.get("addressLine"),
            max_length=MAX_FACILITY_ADDRESS_LENGTH,
            field_name="Facility address",
        )

    if "description" in body:
        payload["description"] = _clean_optional_text(
            body.get("description"),
            max_length=MAX_FACILITY_DESCRIPTION_LENGTH,
            field_name="Facility description",
        )

    if "isActive" in body:
        payload["is_active"] = bool(body.get("isActive"))

    return payload


def _ensure_unique_slug(db: DbSession, *, slug: str, current_facility_id: str | None = None) -> None:
    """Prevent duplicate facility names after slug normalization."""
    existing = db.scalar(select(Facility).where(Facility.slug == slug))

    if existing is not None and existing.id != current_facility_id:
        raise HTTPError(
            HTTPStatus.CONFLICT,
            "A facility with this name already exists. Edit or reactivate the existing facility.",
        )


def list_public(request: Request, start_response, db: DbSession):
    """Return active facilities students may select for facility-based events.

    FReq 1.3 and FReq 4.4: deactivated facilities are hidden from new event creation.
    """
    facilities = db.scalars(
        select(Facility).where(Facility.is_active.is_(True)).order_by(Facility.name.asc())
    ).all()

    return json_response(
        start_response,
        HTTPStatus.OK,
        {"facilities": [_serialize_facility(facility, include_status=False) for facility in facilities]},
    )


def list_admin(request: Request, start_response, db: DbSession):
    """Return all facilities for admin management.

    FReq 4.1 and FReq 4.5: only admins can access facility management data.
    """
    require_admin(db, request)

    facilities = db.scalars(select(Facility).order_by(Facility.name.asc())).all()

    return json_response(
        start_response,
        HTTPStatus.OK,
        {"facilities": [_serialize_facility(facility, include_status=True) for facility in facilities]},
    )


def create_facility(request: Request, start_response, db: DbSession):
    """Create a facility that students can choose for facility-based events.

    FReq 4.2: admins can add a new athletic facility.
    FReq 4.5: this action is restricted to admin users.
    """
    require_admin(db, request)

    body = request.json_body or {}
    payload = _validate_facility_payload(body, require_name=True)
    _ensure_unique_slug(db, slug=payload["slug"])

    facility = Facility(
        name=payload["name"],
        slug=payload["slug"],
        address_line=payload.get("address_line"),
        description=payload.get("description"),
        is_active=True,
    )
    db.add(facility)
    db.commit()
    db.refresh(facility)

    return json_response(
        start_response,
        HTTPStatus.CREATED,
        {
            "message": "Facility created",
            "facility": _serialize_facility(facility, include_status=True),
        },
    )


def update_facility(request: Request, start_response, db: DbSession):
    """Update an existing facility.

    FReq 4.3: admins can update facility details.
    FReq 4.4: admins can reactivate a deactivated facility by setting isActive true.
    FReq 4.5: this action is restricted to admin users.
    """
    require_admin(db, request)

    facility_id = request.path_params.get("id")
    body = request.json_body or {}

    facility = db.scalar(select(Facility).where(Facility.id == facility_id))
    if facility is None:
        raise HTTPError(HTTPStatus.NOT_FOUND, "Facility not found")

    payload = _validate_facility_payload(body, require_name=False)

    if "slug" in payload:
        _ensure_unique_slug(db, slug=payload["slug"], current_facility_id=facility.id)
        facility.slug = payload["slug"]

    if "name" in payload:
        facility.name = payload["name"]
    if "address_line" in payload:
        facility.address_line = payload["address_line"]
    if "description" in payload:
        facility.description = payload["description"]
    if "is_active" in payload:
        facility.is_active = payload["is_active"]

    db.commit()
    db.refresh(facility)

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "message": "Facility updated",
            "facility": _serialize_facility(facility, include_status=True),
        },
    )


def deactivate_facility(request: Request, start_response, db: DbSession):
    """Deactivate a facility for future event creation.

    FReq 4.4: deactivated facilities are no longer available for new facility-based events.
    Existing events remain unchanged because they may reference historical facility details.
    FReq 4.5: this action is restricted to admin users.
    """
    require_admin(db, request)

    facility_id = request.path_params.get("id")
    facility = db.scalar(select(Facility).where(Facility.id == facility_id))
    if facility is None:
        raise HTTPError(HTTPStatus.NOT_FOUND, "Facility not found")

    facility.is_active = False
    db.commit()
    db.refresh(facility)

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "message": "Facility deactivated",
            "facility": _serialize_facility(facility, include_status=True),
        },
    )
