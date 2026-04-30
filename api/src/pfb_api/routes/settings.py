from __future__ import annotations
from http import HTTPStatus
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from ..http import Request, json_response, HTTPError
from ..models import AppSetting
from ..security import require_admin

# FReq 4 & Geographic Limit Default
def get_settings(request: Request, start_response, db: DbSession):
    # This is publicly accessible so the map component knows where to search
    setting = db.scalar(select(AppSetting).where(AppSetting.key == "running_region_limit"))
    limit = setting.value if setting else "New York State, US"
    return json_response(start_response, HTTPStatus.OK, {"regionLimit": limit})

def update_settings(request: Request, start_response, db: DbSession):
    # FReq 4: Admins can edit system settings
    require_admin(db, request)
    body = request.json_body or {}
    new_limit = str(body.get("regionLimit", "")).strip()
    
    if not new_limit:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Region limit cannot be empty")
        
    setting = db.scalar(select(AppSetting).where(AppSetting.key == "running_region_limit"))
    if not setting:
        setting = AppSetting(key="running_region_limit", value=new_limit)
        db.add(setting)
    else:
        setting.value = new_limit
        
    db.commit()
    return json_response(start_response, HTTPStatus.OK, {"message": "Settings updated", "regionLimit": setting.value})