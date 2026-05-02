from __future__ import annotations

from http import HTTPStatus
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession, joinedload

from ..http import HTTPError, Request, json_response
from ..models import BadgeApplication, BadgeType, UserBadge, utc_now
from ..security import require_admin, require_user

MIN_APPLICATION_MESSAGE_LENGTH = 20
MAX_APPLICATION_MESSAGE_LENGTH = 2000
MAX_DECISION_NOTES_LENGTH = 1000
VALID_REVIEW_STATUSES = {"approved", "denied"}


def _serialize_badge_type(badge_type: BadgeType) -> dict[str, Any]:
    """Serialize a badge type that students can apply for.

    FReq 6.1: students need selectable badge types before submitting an application.
    """
    return {
        "id": badge_type.id,
        "code": badge_type.code,
        "displayName": badge_type.display_name,
        "description": badge_type.description,
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
        "message": application.applicant_message or "",
        "decisionNotes": application.decision_notes,
        "createdAt": application.created_at.isoformat(),
        "reviewedAt": application.reviewed_at.isoformat() if application.reviewed_at else None,
    }

    if include_applicant:
        payload["applicantName"] = application.user.full_name
        payload["applicantEmail"] = application.user.email

    return payload


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


def list_badge_types(request: Request, start_response, db: DbSession):
    """Return active badge types available for applications.

    FReq 6.1: users can choose a trust badge type from the application form.
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
