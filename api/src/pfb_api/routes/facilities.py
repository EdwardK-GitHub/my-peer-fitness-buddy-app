from __future__ import annotations
from http import HTTPStatus
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession
import re

from ..http import Request, json_response, HTTPError
from ..models import Facility
from ..security import require_admin

def slugify(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-')

def list_public(request: Request, start_response, db: DbSession):
    facilities = db.scalars(select(Facility).where(Facility.is_active.is_(True)).order_by(Facility.name.asc())).all()
    return json_response(start_response, HTTPStatus.OK, {
        "facilities": [{"id": f.id, "name": f.name, "slug": f.slug, "description": f.description, "addressLine": f.address_line} for f in facilities]
    })

def list_admin(request: Request, start_response, db: DbSession):
    require_admin(db, request)
    facilities = db.scalars(select(Facility).order_by(Facility.name.asc())).all()
    return json_response(start_response, HTTPStatus.OK, {
        "facilities": [{"id": f.id, "name": f.name, "slug": f.slug, "description": f.description, "addressLine": f.address_line, "isActive": f.is_active} for f in facilities]
    })

# FReq 4.2: Admin dashboard let admins add new athletic facilities
def create_facility(request: Request, start_response, db: DbSession):
    require_admin(db, request)
    body = request.json_body or {}
    name = str(body.get("name", "")).strip()
    address = str(body.get("addressLine", "")).strip()
    
    if not name:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Name is required")
        
    slug = slugify(name)
    existing = db.scalar(select(Facility).where(Facility.slug == slug))
    if existing:
        raise HTTPError(HTTPStatus.CONFLICT, "Facility with this name already exists")
        
    facility = Facility(name=name, slug=slug, address_line=address, description=body.get("description", ""))
    db.add(facility)
    db.commit()
    db.refresh(facility)
    return json_response(start_response, HTTPStatus.CREATED, {"message": "Facility created"})

# FReq 4.3: Admin dashboard let admins update facility details
def update_facility(request: Request, start_response, db: DbSession):
    require_admin(db, request)
    facility_id = request.path_params.get("id")
    body = request.json_body or {}
    
    facility = db.scalar(select(Facility).where(Facility.id == facility_id))
    if not facility:
        raise HTTPError(HTTPStatus.NOT_FOUND, "Facility not found")
        
    if "name" in body: facility.name = str(body["name"]).strip()
    if "addressLine" in body: facility.address_line = str(body["addressLine"]).strip()
    if "description" in body: facility.description = str(body["description"])
    if "isActive" in body: facility.is_active = bool(body["isActive"])
    
    db.commit()
    return json_response(start_response, HTTPStatus.OK, {"message": "Facility updated"})

# FReq 4.4: Admin remove/deactivate a facility
def deactivate_facility(request: Request, start_response, db: DbSession):
    require_admin(db, request)
    facility_id = request.path_params.get("id")
    facility = db.scalar(select(Facility).where(Facility.id == facility_id))
    if facility:
        facility.is_active = False
        db.commit()
    return json_response(start_response, HTTPStatus.OK, {"message": "Facility deactivated"})