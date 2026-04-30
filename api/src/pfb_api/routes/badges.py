from __future__ import annotations
from http import HTTPStatus
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession, joinedload

from ..http import Request, json_response, HTTPError
from ..models import BadgeApplication, BadgeType, UserBadge, utc_now
from ..security import require_admin, require_user

def list_badge_types(request: Request, start_response, db: DbSession):
    badge_types = db.scalars(select(BadgeType).where(BadgeType.is_active.is_(True)).order_by(BadgeType.display_name.asc())).all()
    return json_response(start_response, HTTPStatus.OK, {
        "badgeTypes": [{"id": bt.id, "code": bt.code, "displayName": bt.display_name, "description": bt.description} for bt in badge_types]
    })

def list_applications_admin(request: Request, start_response, db: DbSession):
    # FReq 6.3: Admins view submitted applications
    require_admin(db, request)
    applications = db.scalars(select(BadgeApplication).options(joinedload(BadgeApplication.user), joinedload(BadgeApplication.badge_type)).order_by(BadgeApplication.created_at.desc())).all()
    return json_response(start_response, HTTPStatus.OK, {
        "applications": [{"id": a.id, "status": a.status, "applicantName": a.user.full_name, "badgeName": a.badge_type.display_name, "message": a.applicant_message, "createdAt": a.created_at.isoformat()} for a in applications]
    })

def submit_application(request: Request, start_response, db: DbSession):
    # FReq 6.1: User submits trust badge application
    auth = require_user(db, request)
    body = request.json_body or {}
    badge_type_id = body.get("badgeTypeId")
    message = body.get("message", "")
    
    if not badge_type_id: raise HTTPError(HTTPStatus.BAD_REQUEST, "Badge type required")
        
    existing_pending = db.scalar(select(BadgeApplication).where(BadgeApplication.user_id == auth.user.id, BadgeApplication.badge_type_id == badge_type_id, BadgeApplication.status == "submitted"))
    if existing_pending: raise HTTPError(HTTPStatus.CONFLICT, "You already have a pending application for this badge")
        
    app = BadgeApplication(user_id=auth.user.id, badge_type_id=badge_type_id, applicant_message=message)
    db.add(app)
    db.commit()
    return json_response(start_response, HTTPStatus.CREATED, {"message": "Application submitted"})

def review_application(request: Request, start_response, db: DbSession):
    # FReq 6.4: Admin manually reviews (approves or denies) applications
    auth = require_admin(db, request)
    app_id = request.path_params.get("id")
    body = request.json_body or {}
    decision = body.get("status") # 'approved' or 'denied'
    
    if decision not in ["approved", "denied"]: raise HTTPError(HTTPStatus.BAD_REQUEST, "Invalid decision")
        
    application = db.scalar(select(BadgeApplication).where(BadgeApplication.id == app_id))
    if not application or application.status != "submitted": raise HTTPError(HTTPStatus.BAD_REQUEST, "Application not found or already reviewed")
        
    application.status = decision
    application.reviewer_admin_id = auth.admin.id
    application.reviewed_at = utc_now()
    
    if decision == "approved":
        db.add(UserBadge(user_id=application.user_id, badge_type_id=application.badge_type_id, granted_by_admin_id=auth.admin.id))
        
    db.commit()
    return json_response(start_response, HTTPStatus.OK, {"message": f"Application {decision}"})