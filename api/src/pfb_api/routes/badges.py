from __future__ import annotations

import re
from http import HTTPStatus
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession, joinedload

from ..http import HTTPError, Request, json_response
from ..models import BadgeApplication, BadgeType, UserBadge, utc_now
from ..security import require_admin, require_user

DEFAULT_BADGE_CODE = "peer_trainer"

MIN_APPLICATION_MESSAGE_LENGTH = 20
MAX_APPLICATION_MESSAGE_LENGTH = 2000
MAX_DECISION_NOTES_LENGTH = 1000

MAX_BADGE_DISPLAY_NAME_LENGTH = 120
MAX_BADGE_DESCRIPTION_LENGTH = 1000

VALID_REVIEW_STATUSES = {"approved", "denied"}


def _badge_code_from_display_name(display_name: str) -> str:
    """Create a stable badge code from the admin-facing badge display name.

    FReq 6 uses badge types as selectable trust-badge options. The code is an internal stable
    identifier, while display_name is what students and admins see on the screen.
    """
    code = re.sub(r"[^a-z0-9]+", "_", display_name.lower()).strip("_")
    return code[:64]


def _serialize_badge_type(badge_type: BadgeType) -> dict[str, Any]:
    """Serialize a badge type for user and admin screens.

    FReq 6.1: users need selectable active badge types before submitting an application.
    Admin screens also use isActive so deleted badge types can be managed safely.
    """
    return {
        "id": badge_type.id,
        "code": badge_type.code,
        "displayName": badge_type.display_name,
        "description": badge_type.description,
        "isActive": badge_type.is_active,
        "isDefault": badge_type.code == DEFAULT_BADGE_CODE,
    }


def _serialize_application(
    application: BadgeApplication,
    *,
    include_applicant: bool,
) -> dict[str, Any]:
    """Serialize a badge application for student or admin screens.

    FReq 6.2: every application exposes its status.
    FReq 6.3: admins can view submitted applications and their details.
    """
    payload: dict[str, Any] = {
        "id": application.id,
        "status": application.status,
        "badgeTypeId": application.badge_type_id,
        "badgeTypeCode": application.badge_type.code,
        "badgeName": application.badge_type.display_name,
        "badgeTypeActive": application.badge_type.is_active,
        "message": application.applicant_message or "",
        "decisionNotes": application.decision_notes,
        "createdAt": application.created_at.isoformat(),
        "reviewedAt": application.reviewed_at.isoformat() if application.reviewed_at else None,
    }

    if include_applicant:
        payload["applicantName"] = application.user.full_name
        payload["applicantEmail"] = application.user.email

    return payload


def _validate_badge_display_name(value: Any) -> tuple[str, str]:
    """Validate a badge type name and generate its internal code.

    FReq 6.1: badge types must be understandable for students before they apply.
    """
    display_name = str(value or "").strip()

    if not display_name:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Badge name is required")

    if len(display_name) > MAX_BADGE_DISPLAY_NAME_LENGTH:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Badge name is too long")

    code = _badge_code_from_display_name(display_name)
    if not code:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Badge name must include letters or numbers")

    return display_name, code


def _validate_badge_description(value: Any) -> str | None:
    """Validate optional badge-type description text."""
    description = str(value or "").strip()
    if not description:
        return None

    if len(description) > MAX_BADGE_DESCRIPTION_LENGTH:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Badge description is too long")

    return description


def _ensure_unique_badge_code(
    db: DbSession,
    *,
    code: str,
    current_badge_type_id: str | None = None,
) -> None:
    """Prevent duplicate badge types after name normalization."""
    existing = db.scalar(select(BadgeType).where(BadgeType.code == code))

    if existing is not None and existing.id != current_badge_type_id:
        raise HTTPError(
            HTTPStatus.CONFLICT,
            "A badge type with this name already exists. Edit or restore the existing badge type.",
        )


def _validate_application_message(value: Any) -> str:
    """Validate the student's trust badge application explanation.

    FReq 6.1: users submit forms for trust badges. A short but meaningful explanation helps admins
    make a manual review decision.
    """
    message = str(value or "").strip()

    if len(message) < MIN_APPLICATION_MESSAGE_LENGTH:
        raise HTTPError(
            HTTPStatus.BAD_REQUEST,
            f"Application message must be at least {MIN_APPLICATION_MESSAGE_LENGTH} characters",
        )

    if len(message) > MAX_APPLICATION_MESSAGE_LENGTH:
        raise HTTPError(
            HTTPStatus.BAD_REQUEST,
            f"Application message must be {MAX_APPLICATION_MESSAGE_LENGTH} characters or fewer",
        )

    return message


def _validate_decision_notes(value: Any) -> str | None:
    """Validate optional admin notes for the application decision."""
    notes = str(value or "").strip()
    if not notes:
        return None

    if len(notes) > MAX_DECISION_NOTES_LENGTH:
        raise HTTPError(
            HTTPStatus.BAD_REQUEST,
            f"Decision notes must be {MAX_DECISION_NOTES_LENGTH} characters or fewer",
        )

    return notes


def _deactivate_badge_type(
    db: DbSession,
    *,
    badge_type: BadgeType,
    reviewer_admin_id: str,
) -> None:
    """Safely delete a badge type by marking it inactive.

    FReq 6 remains consistent because inactive badge types are hidden from new applications and
    event badges. Submitted applications for the deleted badge are closed so admins do not approve
    applications for a badge that is no longer available.
    """
    if badge_type.code == DEFAULT_BADGE_CODE:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "The default Peer Trainer badge cannot be deleted")

    badge_type.is_active = False

    submitted_applications = db.scalars(
        select(BadgeApplication).where(
            BadgeApplication.badge_type_id == badge_type.id,
            BadgeApplication.status == "submitted",
        )
    ).all()

    for application in submitted_applications:
        application.status = "denied"
        application.reviewer_admin_id = reviewer_admin_id
        application.decision_notes = "This badge type is no longer available."
        application.reviewed_at = utc_now()


def list_badge_types(request: Request, start_response, db: DbSession):
    """Return active badge types available for applications.

    FReq 6.1: users can choose an active trust badge type from the application form.
    Deleted badge types are intentionally hidden from regular users.
    """
    badge_types = db.scalars(
        select(BadgeType)
        .where(BadgeType.is_active.is_(True))
        .order_by(BadgeType.display_name.asc())
    ).all()

    return json_response(
        start_response,
        HTTPStatus.OK,
        {"badgeTypes": [_serialize_badge_type(badge_type) for badge_type in badge_types]},
    )


def list_badge_types_admin(request: Request, start_response, db: DbSession):
    """Return all badge types for admin management.

    FReq 6.6: badge-type management is restricted to admins.
    """
    require_admin(db, request)

    badge_types = db.scalars(
        select(BadgeType).order_by(BadgeType.is_active.desc(), BadgeType.display_name.asc())
    ).all()

    return json_response(
        start_response,
        HTTPStatus.OK,
        {"badgeTypes": [_serialize_badge_type(badge_type) for badge_type in badge_types]},
    )


def create_badge_type(request: Request, start_response, db: DbSession):
    """Create a new badge type that students can apply for.

    FReq 6.1: users can submit trust badge applications for active badge types.
    FReq 6.6: only admins can create badge types.
    """
    require_admin(db, request)

    body = request.json_body or {}
    display_name, code = _validate_badge_display_name(body.get("displayName"))
    description = _validate_badge_description(body.get("description"))

    _ensure_unique_badge_code(db, code=code)

    badge_type = BadgeType(
        code=code,
        display_name=display_name,
        description=description,
        is_active=True,
    )
    db.add(badge_type)
    db.commit()
    db.refresh(badge_type)

    return json_response(
        start_response,
        HTTPStatus.CREATED,
        {
            "message": "Badge type created",
            "badgeType": _serialize_badge_type(badge_type),
        },
    )


def update_badge_type(request: Request, start_response, db: DbSession):
    """Update or restore an existing badge type.

    FReq 6.6: only admins can update badge types.
    The default Peer Trainer badge remains protected so it always exists as the baseline badge.
    """
    require_admin(db, request)

    badge_type_id = request.path_params.get("id")
    body = request.json_body or {}

    badge_type = db.scalar(select(BadgeType).where(BadgeType.id == badge_type_id))
    if badge_type is None:
        raise HTTPError(HTTPStatus.NOT_FOUND, "Badge type not found")

    if "displayName" in body:
        display_name, code = _validate_badge_display_name(body.get("displayName"))

        if badge_type.code == DEFAULT_BADGE_CODE and display_name != badge_type.display_name:
            raise HTTPError(
                HTTPStatus.BAD_REQUEST,
                "The default Peer Trainer badge name cannot be changed",
            )

        if badge_type.code != DEFAULT_BADGE_CODE:
            _ensure_unique_badge_code(db, code=code, current_badge_type_id=badge_type.id)
            badge_type.code = code
            badge_type.display_name = display_name

    if "description" in body:
        badge_type.description = _validate_badge_description(body.get("description"))

    if "isActive" in body:
        requested_active = bool(body.get("isActive"))

        if not requested_active and badge_type.code == DEFAULT_BADGE_CODE:
            raise HTTPError(HTTPStatus.BAD_REQUEST, "The default Peer Trainer badge cannot be deleted")

        badge_type.is_active = requested_active

    db.commit()
    db.refresh(badge_type)

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "message": "Badge type updated",
            "badgeType": _serialize_badge_type(badge_type),
        },
    )


def deactivate_badge_type(request: Request, start_response, db: DbSession):
    """Safely delete a custom badge type.

    FReq 6 stays consistent because the badge type is hidden from user application options and from
    event badge displays, while historical application records remain preserved.
    """
    auth = require_admin(db, request)

    badge_type_id = request.path_params.get("id")
    badge_type = db.scalar(select(BadgeType).where(BadgeType.id == badge_type_id))
    if badge_type is None:
        raise HTTPError(HTTPStatus.NOT_FOUND, "Badge type not found")

    _deactivate_badge_type(db, badge_type=badge_type, reviewer_admin_id=auth.admin.id)
    db.commit()
    db.refresh(badge_type)

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "message": "Badge type deleted",
            "badgeType": _serialize_badge_type(badge_type),
        },
    )


def list_applications_user(request: Request, start_response, db: DbSession):
    """Return the signed-in user's badge applications.

    FReq 6.2: students can see whether each application is submitted, approved, or denied.
    """
    auth = require_user(db, request)

    applications = db.scalars(
        select(BadgeApplication)
        .options(joinedload(BadgeApplication.badge_type))
        .where(BadgeApplication.user_id == auth.user.id)
        .order_by(BadgeApplication.created_at.desc())
    ).all()

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "applications": [
                _serialize_application(application, include_applicant=False)
                for application in applications
            ]
        },
    )


def list_applications_admin(request: Request, start_response, db: DbSession):
    """Return badge applications for admin review.

    FReq 6.3: admins can view submitted applications and their details.
    FReq 6.6: this route is restricted to admin users only.
    """
    require_admin(db, request)

    applications = db.scalars(
        select(BadgeApplication)
        .options(
            joinedload(BadgeApplication.user),
            joinedload(BadgeApplication.badge_type),
        )
        .order_by(BadgeApplication.created_at.desc())
    ).all()

    applications = sorted(
        applications,
        key=lambda application: (
            application.status != "submitted",
            -application.created_at.timestamp(),
        ),
    )

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "applications": [
                _serialize_application(application, include_applicant=True)
                for application in applications
            ]
        },
    )


def submit_application(request: Request, start_response, db: DbSession):
    """Submit a trust badge application for the signed-in student.

    FReq 6.1: the route stores a student's badge application form.
    FReq 6.2: new applications are recorded with status submitted.
    """
    auth = require_user(db, request)
    body = request.json_body or {}

    badge_type_id = str(body.get("badgeTypeId") or "").strip()
    message = _validate_application_message(body.get("message"))

    if not badge_type_id:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Choose a badge before submitting the application")

    badge_type = db.scalar(
        select(BadgeType).where(
            BadgeType.id == badge_type_id,
            BadgeType.is_active.is_(True),
        )
    )
    if badge_type is None:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Selected badge type is not available")

    existing_pending = db.scalar(
        select(BadgeApplication.id).where(
            BadgeApplication.user_id == auth.user.id,
            BadgeApplication.badge_type_id == badge_type_id,
            BadgeApplication.status == "submitted",
        )
    )
    if existing_pending is not None:
        raise HTTPError(
            HTTPStatus.CONFLICT,
            "You already have a submitted application for this badge",
        )

    existing_badge = db.scalar(
        select(UserBadge.id).where(
            UserBadge.user_id == auth.user.id,
            UserBadge.badge_type_id == badge_type_id,
        )
    )
    if existing_badge is not None:
        raise HTTPError(HTTPStatus.CONFLICT, "You already have this trust badge")

    application = BadgeApplication(
        user_id=auth.user.id,
        badge_type_id=badge_type.id,
        status="submitted",
        applicant_message=message,
    )
    db.add(application)
    db.commit()
    db.refresh(application)

    return json_response(
        start_response,
        HTTPStatus.CREATED,
        {
            "message": "Application submitted",
            "status": application.status,
            "applicationId": application.id,
        },
    )


def review_application(request: Request, start_response, db: DbSession):
    """Approve or deny a submitted badge application.

    FReq 6.4: admins manually approve or deny each submitted application.
    FReq 6.5: approved applications grant a badge that appears on that user's events.
    FReq 6.6: review actions are restricted to admin users only.
    """
    auth = require_admin(db, request)
    app_id = request.path_params.get("id")
    body = request.json_body or {}

    decision = str(body.get("status") or "").strip().lower()
    decision_notes = _validate_decision_notes(body.get("decisionNotes"))

    if decision not in VALID_REVIEW_STATUSES:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Review decision must be approved or denied")

    application = db.scalar(
        select(BadgeApplication)
        .options(joinedload(BadgeApplication.badge_type))
        .where(BadgeApplication.id == app_id)
    )
    if application is None:
        raise HTTPError(HTTPStatus.NOT_FOUND, "Application not found")

    if application.status != "submitted":
        raise HTTPError(HTTPStatus.BAD_REQUEST, "This application has already been reviewed")

    if decision == "approved" and not application.badge_type.is_active:
        raise HTTPError(
            HTTPStatus.BAD_REQUEST,
            "This badge type has been deleted and cannot be approved",
        )

    application.status = decision
    application.reviewer_admin_id = auth.admin.id
    application.decision_notes = decision_notes
    application.reviewed_at = utc_now()

    if decision == "approved":
        existing_badge = db.scalar(
            select(UserBadge).where(
                UserBadge.user_id == application.user_id,
                UserBadge.badge_type_id == application.badge_type_id,
            )
        )

        if existing_badge is None:
            db.add(
                UserBadge(
                    user_id=application.user_id,
                    badge_type_id=application.badge_type_id,
                    granted_by_admin_id=auth.admin.id,
                )
            )

    db.commit()

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "message": f"Application {decision}",
            "status": decision,
        },
    )
