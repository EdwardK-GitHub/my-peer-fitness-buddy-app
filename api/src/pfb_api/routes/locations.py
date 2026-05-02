from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from http import HTTPStatus
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from ..config import settings
from ..http import HTTPError, Request, json_response
from ..models import AppSetting
from ..us_states import (
    ALLOWED_RUNNING_STATE_CODES_KEY,
    parse_state_codes,
    state_code_from_name,
    state_name_for,
)

NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search"
MIN_AUTOCOMPLETE_QUERY_LENGTH = 3
AUTOCOMPLETE_LIMIT = 8
CACHE_TTL_SECONDS = 300

_CACHE: dict[tuple[str, tuple[str, ...]], tuple[float, list[dict[str, Any]]]] = {}


def _query_value(request: Request, key: str) -> str:
    """Read one query-string value from the lightweight request object."""
    return request.query_params.get(key, [""])[0].strip()


def _allowed_state_codes(db: DbSession) -> list[str]:
    """Read admin-selected allowed states for outdoor-run searches."""
    setting = db.scalar(select(AppSetting).where(AppSetting.key == ALLOWED_RUNNING_STATE_CODES_KEY))
    return parse_state_codes(setting.value if setting else None)


def _state_code_from_nominatim_address(address: dict[str, Any]) -> str | None:
    """Extract a U.S. state code from a Nominatim address payload."""
    iso_code = str(address.get("ISO3166-2-lvl4") or "").upper()
    if iso_code.startswith("US-"):
        return iso_code.replace("US-", "", 1)

    return state_code_from_name(str(address.get("state") or ""))


def _normalize_place(place: dict[str, Any], allowed_states: set[str]) -> dict[str, Any] | None:
    """Normalize one Nominatim place into the frontend's autocomplete shape."""
    address = place.get("address") if isinstance(place.get("address"), dict) else {}

    if str(address.get("country_code") or "").lower() != "us":
        return None

    state_code = _state_code_from_nominatim_address(address)
    if not state_code or state_code not in allowed_states:
        return None

    try:
        lat = float(place["lat"])
        lng = float(place["lon"])
    except (KeyError, TypeError, ValueError):
        return None

    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None

    label = str(place.get("display_name") or "").strip()
    if not label:
        return None

    return {
        "label": label,
        "lat": lat,
        "lng": lng,
        "stateCode": state_code,
        "stateName": state_name_for(state_code),
    }


def _fetch_nominatim(query: str) -> list[dict[str, Any]]:
    """Call the existing OpenStreetMap/Nominatim provider from the backend.

    The frontend no longer calls geocoding directly. This keeps provider interaction centralized,
    lets us enforce state restrictions consistently, and avoids exposing provider-specific behavior
    throughout the React code.
    """
    params = urllib.parse.urlencode(
        {
            "format": "json",
            "addressdetails": "1",
            "limit": str(AUTOCOMPLETE_LIMIT),
            "countrycodes": "us",
            "q": query,
        }
    )

    request = urllib.request.Request(
        f"{NOMINATIM_SEARCH_URL}?{params}",
        headers={
            "User-Agent": settings.geocoding_user_agent,
            "Accept": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=6) as response:
            payload = response.read().decode("utf-8")
    except (TimeoutError, urllib.error.URLError) as exc:
        raise HTTPError(
            HTTPStatus.BAD_GATEWAY,
            "Location autocomplete is temporarily unavailable",
        ) from exc

    try:
        data = json.loads(payload)
    except json.JSONDecodeError as exc:
        raise HTTPError(
            HTTPStatus.BAD_GATEWAY,
            "Location autocomplete returned an invalid response",
        ) from exc

    if not isinstance(data, list):
        raise HTTPError(
            HTTPStatus.BAD_GATEWAY,
            "Location autocomplete returned an unexpected response",
        )

    return data


def autocomplete(request: Request, start_response, db: DbSession):
    """Return debounced location suggestions for outdoor-run event creation.

    FReq 1.4: running events require detailed locations.
    FReq 4: admin-selected allowed states restrict which locations users can select.
    """
    query = _query_value(request, "q")

    if len(query) < MIN_AUTOCOMPLETE_QUERY_LENGTH:
        return json_response(start_response, HTTPStatus.OK, {"suggestions": []})

    allowed_codes = _allowed_state_codes(db)
    cache_key = (query.lower(), tuple(sorted(allowed_codes)))
    cached = _CACHE.get(cache_key)

    if cached and time.time() - cached[0] <= CACHE_TTL_SECONDS:
        return json_response(start_response, HTTPStatus.OK, {"suggestions": cached[1]})

    places = _fetch_nominatim(query)
    allowed_set = set(allowed_codes)

    suggestions = []
    seen: set[tuple[str, str]] = set()

    for place in places:
        suggestion = _normalize_place(place, allowed_set)
        if suggestion is None:
            continue

        dedupe_key = (suggestion["label"], suggestion["stateCode"])
        if dedupe_key in seen:
            continue

        suggestions.append(suggestion)
        seen.add(dedupe_key)

    _CACHE[cache_key] = (time.time(), suggestions)

    return json_response(start_response, HTTPStatus.OK, {"suggestions": suggestions})
