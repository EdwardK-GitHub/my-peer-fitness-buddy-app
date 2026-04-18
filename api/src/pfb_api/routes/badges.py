from __future__ import annotations

from http import HTTPStatus

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from ..http import Request, json_response
from ..models import BadgeApplication, BadgeType
from ..security import require_admin, require_user


def list_badge_types(request: Request, start_response, db: DbSession):
    badge_types = db.scalars(
        select(BadgeType).where(BadgeType.is_active.is_(True)).order_by(BadgeType.display_name.asc())
    ).all()

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "badgeTypes": [
                {
                    "id": badge_type.id,
                    "code": badge_type.code,
                    "displayName": badge_type.display_name,
                    "description": badge_type.description,
                }
                for badge_type in badge_types
            ]
        },
    )


def list_applications_admin(request: Request, start_response, db: DbSession):
    require_admin(db, request)
    applications = db.scalars(select(BadgeApplication).order_by(BadgeApplication.created_at.desc())).all()

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "applications": [
                {
                    "id": application.id,
                    "status": application.status,
                    "badgeTypeId": application.badge_type_id,
                    "userId": application.user_id,
                    "createdAt": application.created_at.isoformat(),
                }
                for application in applications
            ]
        },
    )


def submit_placeholder(request: Request, start_response, db: DbSession):
    require_user(db, request)
    return json_response(
        start_response,
        HTTPStatus.NOT_IMPLEMENTED,
        {
            "message": "Badge application submission is reserved for the next development step.",
            "todo": [
                "Validate form fields",
                "Prevent duplicate pending applications",
                "Create a submitted application row",
            ],
        },
    )