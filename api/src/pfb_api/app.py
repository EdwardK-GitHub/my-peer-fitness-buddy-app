from __future__ import annotations

import re
from collections.abc import Callable
from http import HTTPStatus
from typing import Any

from sqlalchemy.orm import Session as DbSession

from .db import SessionLocal
from .http import HTTPError, Request, json_response, load_request
from .routes import admin_auth, auth, badges, events, facilities

Handler = Callable[[Request, Any, DbSession], list[bytes]]

# A small regex-based router keeps the backend framework-free while still being easy to extend.
ROUTES: list[tuple[str, re.Pattern[str], Handler]] = [
    ("GET", re.compile(r"^/api/health$"), lambda request, start_response, db: json_response(start_response, HTTPStatus.OK, {"status": "ok"})),
    ("POST", re.compile(r"^/api/auth/register$"), auth.register),
    ("POST", re.compile(r"^/api/auth/login$"), auth.login),
    ("GET", re.compile(r"^/api/auth/me$"), auth.me),
    ("POST", re.compile(r"^/api/auth/logout$"), auth.logout),
    ("POST", re.compile(r"^/api/admin/session/login$"), admin_auth.login),
    ("GET", re.compile(r"^/api/admin/session/me$"), admin_auth.me),
    ("POST", re.compile(r"^/api/admin/session/logout$"), admin_auth.logout),
    ("GET", re.compile(r"^/api/facilities$"), facilities.list_public),
    ("GET", re.compile(r"^/api/admin/facilities$"), facilities.list_admin),
    ("POST", re.compile(r"^/api/admin/facilities$"), facilities.create_placeholder),
    ("GET", re.compile(r"^/api/events$"), events.list_events),
    ("GET", re.compile(r"^/api/my-events$"), events.my_events),
    ("POST", re.compile(r"^/api/events$"), events.create_placeholder),
    ("GET", re.compile(r"^/api/badge-types$"), badges.list_badge_types),
    ("GET", re.compile(r"^/api/admin/badge-applications$"), badges.list_applications_admin),
    ("POST", re.compile(r"^/api/badge-applications$"), badges.submit_placeholder),
]


def application(environ, start_response):
    # WSGI entrypoint used by the local dev server and future production server.
    db = SessionLocal()
    try:
        request = load_request(environ)
        for method, pattern, handler in ROUTES:
            if request.method != method:
                continue
            match = pattern.match(request.path)
            if match is None:
                continue

            request.path_params = match.groupdict()
            return handler(request, start_response, db)

        return json_response(
            start_response,
            HTTPStatus.NOT_FOUND,
            {"message": f"Route not found: {request.method} {request.path}"},
        )
    except HTTPError as exc:
        return json_response(
            start_response,
            exc.status,
            {
                "message": exc.message,
                "details": exc.details,
            },
        )
    except Exception:
        db.rollback()
        return json_response(
            start_response,
            HTTPStatus.INTERNAL_SERVER_ERROR,
            {"message": "Unexpected server error"},
        )
    finally:
        db.close()