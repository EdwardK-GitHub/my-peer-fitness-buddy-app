from __future__ import annotations

from http import HTTPStatus

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from ..http import HTTPError, Request, json_response
from ..models import AppSetting
from ..security import require_admin
from ..us_states import (
    ALLOWED_RUNNING_STATE_CODES_KEY,
    parse_state_codes,
    serialize_state_codes,
    state_name_for,
    state_options,
)


def _get_allowed_state_codes(db: DbSession) -> list[str]:
    """Read allowed outdoor-run state codes from application settings.

    FReq 4: admins manage location settings. These state codes are the source of truth for outdoor
    run location search and backend event validation.
    """
    setting = db.scalar(select(AppSetting).where(AppSetting.key == ALLOWED_RUNNING_STATE_CODES_KEY))
    return parse_state_codes(setting.value if setting else None)


def _region_label_for_states(codes: list[str]) -> str:
    """Return a readable region label for compatibility with older UI text."""
    return ", ".join(state_name_for(code) for code in codes)


def _validate_allowed_states(value) -> list[str]:
    """Validate the admin-submitted state list."""
    if not isinstance(value, list):
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Allowed states must be a list")

    try:
        return parse_state_codes(",".join(str(item) for item in value))
    except ValueError as exc:
        raise HTTPError(HTTPStatus.BAD_REQUEST, str(exc)) from exc


def get_settings(request: Request, start_response, db: DbSession):
    """Return public settings needed by student event creation screens."""
    allowed_states = _get_allowed_state_codes(db)

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "allowedStates": allowed_states,
            "stateOptions": state_options(),
            "regionLimit": _region_label_for_states(allowed_states),
        },
    )


def update_settings(request: Request, start_response, db: DbSession):
    """Update admin-managed app settings.

    FReq 4.1 and FReq 4.5: only admins can manage event-location settings.
    """
    require_admin(db, request)

    body = request.json_body or {}
    allowed_states = _validate_allowed_states(body.get("allowedStates"))

    setting = db.scalar(select(AppSetting).where(AppSetting.key == ALLOWED_RUNNING_STATE_CODES_KEY))
    if setting is None:
        setting = AppSetting(
            key=ALLOWED_RUNNING_STATE_CODES_KEY,
            value=serialize_state_codes(allowed_states),
        )
        db.add(setting)
    else:
        setting.value = serialize_state_codes(allowed_states)

    db.commit()

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "message": "Settings updated",
            "allowedStates": allowed_states,
            "stateOptions": state_options(),
            "regionLimit": _region_label_for_states(allowed_states),
        },
    )
