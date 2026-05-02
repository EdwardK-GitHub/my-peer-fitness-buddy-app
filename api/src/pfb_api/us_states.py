from __future__ import annotations

# FReq 4: Admin-managed location settings use U.S. state codes so the UI avoids free-text
# boundary mistakes and the backend can validate outdoor-run locations consistently.

ALLOWED_RUNNING_STATE_CODES_KEY = "allowed_running_state_codes"
DEFAULT_ALLOWED_RUNNING_STATE_CODES = ("NY",)

US_STATES: tuple[dict[str, str], ...] = (
    {"code": "AL", "name": "Alabama"},
    {"code": "AK", "name": "Alaska"},
    {"code": "AZ", "name": "Arizona"},
    {"code": "AR", "name": "Arkansas"},
    {"code": "CA", "name": "California"},
    {"code": "CO", "name": "Colorado"},
    {"code": "CT", "name": "Connecticut"},
    {"code": "DE", "name": "Delaware"},
    {"code": "FL", "name": "Florida"},
    {"code": "GA", "name": "Georgia"},
    {"code": "HI", "name": "Hawaii"},
    {"code": "ID", "name": "Idaho"},
    {"code": "IL", "name": "Illinois"},
    {"code": "IN", "name": "Indiana"},
    {"code": "IA", "name": "Iowa"},
    {"code": "KS", "name": "Kansas"},
    {"code": "KY", "name": "Kentucky"},
    {"code": "LA", "name": "Louisiana"},
    {"code": "ME", "name": "Maine"},
    {"code": "MD", "name": "Maryland"},
    {"code": "MA", "name": "Massachusetts"},
    {"code": "MI", "name": "Michigan"},
    {"code": "MN", "name": "Minnesota"},
    {"code": "MS", "name": "Mississippi"},
    {"code": "MO", "name": "Missouri"},
    {"code": "MT", "name": "Montana"},
    {"code": "NE", "name": "Nebraska"},
    {"code": "NV", "name": "Nevada"},
    {"code": "NH", "name": "New Hampshire"},
    {"code": "NJ", "name": "New Jersey"},
    {"code": "NM", "name": "New Mexico"},
    {"code": "NY", "name": "New York"},
    {"code": "NC", "name": "North Carolina"},
    {"code": "ND", "name": "North Dakota"},
    {"code": "OH", "name": "Ohio"},
    {"code": "OK", "name": "Oklahoma"},
    {"code": "OR", "name": "Oregon"},
    {"code": "PA", "name": "Pennsylvania"},
    {"code": "RI", "name": "Rhode Island"},
    {"code": "SC", "name": "South Carolina"},
    {"code": "SD", "name": "South Dakota"},
    {"code": "TN", "name": "Tennessee"},
    {"code": "TX", "name": "Texas"},
    {"code": "UT", "name": "Utah"},
    {"code": "VT", "name": "Vermont"},
    {"code": "VA", "name": "Virginia"},
    {"code": "WA", "name": "Washington"},
    {"code": "WV", "name": "West Virginia"},
    {"code": "WI", "name": "Wisconsin"},
    {"code": "WY", "name": "Wyoming"},
)

STATE_CODE_TO_NAME = {state["code"]: state["name"] for state in US_STATES}
STATE_NAME_TO_CODE = {state["name"].lower(): state["code"] for state in US_STATES}
VALID_STATE_CODES = set(STATE_CODE_TO_NAME)


def state_options() -> list[dict[str, str]]:
    """Return all U.S. states for admin selection UIs."""
    return list(US_STATES)


def state_name_for(code: str) -> str:
    """Return a user-facing state name for a state code."""
    return STATE_CODE_TO_NAME[code.upper()]


def state_code_from_name(name: str | None) -> str | None:
    """Convert a provider-returned state name into a two-letter state code."""
    if not name:
        return None
    return STATE_NAME_TO_CODE.get(name.strip().lower())


def normalize_state_codes(values: list[str] | tuple[str, ...]) -> list[str]:
    """Normalize and validate state codes submitted by admins or location APIs."""
    seen: set[str] = set()
    normalized: list[str] = []

    for value in values:
        code = str(value or "").strip().upper()
        if not code:
            continue
        if code not in VALID_STATE_CODES:
            raise ValueError(f"Invalid state code: {code}")
        if code not in seen:
            normalized.append(code)
            seen.add(code)

    if not normalized:
        raise ValueError("At least one state must be selected")

    return normalized


def parse_state_codes(value: str | None) -> list[str]:
    """Parse the comma-separated allowed-state setting from the database."""
    if not value:
        return list(DEFAULT_ALLOWED_RUNNING_STATE_CODES)

    codes = [part.strip() for part in value.split(",")]
    try:
        return normalize_state_codes(codes)
    except ValueError:
        return list(DEFAULT_ALLOWED_RUNNING_STATE_CODES)


def serialize_state_codes(codes: list[str] | tuple[str, ...]) -> str:
    """Serialize allowed state codes for AppSetting storage."""
    return ",".join(normalize_state_codes(list(codes)))
