from __future__ import annotations

from http import HTTPStatus

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from ..http import HTTPError, Request, json_response
from ..models import AppSetting
from ..security import require_admin

RUNNING_REGION_SETTING_KEY = "running_region_limit"
DEFAULT_RUNNING_REGION_LIMIT = "New York State, US"
MAX_REGION_LIMIT_LENGTH = 120


def _validate_region_limit(value: str) -> str:
    """Validate the admin-managed boundary used for outdoor running location searches.

    FReq 4: admins can manage event location settings. The region limit keeps running-location
    searches understandable and campus-oriented without hardcoding a single boundary in the UI.
    """
    cleaned = value.strip()

    if not cleaned:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Outdoor run region limit is required")

    if len(cleaned) > MAX_REGION_LIMIT_LENGTH:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Outdoor run region limit is too long")

    if any(character in cleaned for character in "\n\r\t"):
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Outdoor run region limit must be one line")

    return cleaned


def get_settings(request: Request, start_response, db: DbSession):
    """Return public settings needed by student event creation screens."""
    setting = db.scalar(select(AppSetting).where(AppSetting.key == RUNNING_REGION_SETTING_KEY))
    limit = setting.value if setting else DEFAULT_RUNNING_REGION_LIMIT

    return json_response(start_response, HTTPStatus.OK, {"regionLimit": limit})


def update_settings(request: Request, start_response, db: DbSession):
    """Update admin-managed app settings.

    FReq 4.1 and FReq 4.5: only admins can manage event-location settings.
    """
    require_admin(db, request)

    body = request.json_body or {}
    new_limit = _validate_region_limit(str(body.get("regionLimit", "")))

    setting = db.scalar(select(AppSetting).where(AppSetting.key == RUNNING_REGION_SETTING_KEY))
    if setting is None:
        setting = AppSetting(key=RUNNING_REGION_SETTING_KEY, value=new_limit)
        db.add(setting)
    else:
        setting.value = new_limit

    db.commit()

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "message": "Settings updated",
            "regionLimit": setting.value,
        },
    )
