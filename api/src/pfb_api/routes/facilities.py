from __future__ import annotations

from http import HTTPStatus

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from ..http import Request, json_response
from ..models import Facility
from ..security import require_admin


def list_public(request: Request, start_response, db: DbSession):
    facilities = db.scalars(
        select(Facility).where(Facility.is_active.is_(True)).order_by(Facility.name.asc())
    ).all()

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "facilities": [
                {
                    "id": facility.id,
                    "name": facility.name,
                    "slug": facility.slug,
                    "description": facility.description,
                    "addressLine": facility.address_line,
                }
                for facility in facilities
            ]
        },
    )


def list_admin(request: Request, start_response, db: DbSession):
    require_admin(db, request)
    facilities = db.scalars(select(Facility).order_by(Facility.name.asc())).all()

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "facilities": [
                {
                    "id": facility.id,
                    "name": facility.name,
                    "slug": facility.slug,
                    "description": facility.description,
                    "addressLine": facility.address_line,
                    "isActive": facility.is_active,
                }
                for facility in facilities
            ]
        },
    )


def create_placeholder(request: Request, start_response, db: DbSession):
    require_admin(db, request)
    return json_response(
        start_response,
        HTTPStatus.NOT_IMPLEMENTED,
        {
            "message": "Facility creation is reserved for the next development step.",
            "todo": [
                "Validate facility payload",
                "Create facility row",
                "Record an audit log entry",
            ],
        },
    )