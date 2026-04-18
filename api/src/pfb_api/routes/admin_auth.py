from __future__ import annotations

from http import HTTPStatus

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from ..config import settings
from ..http import HTTPError, Request, empty_response, json_response
from ..models import Admin
from ..security import (
    build_clear_cookie_header,
    build_session_cookie_header,
    create_session,
    load_auth_context,
    normalize_and_validate_email,
    require_admin,
    require_csrf,
    verify_password,
)


def _serialize_admin(admin: Admin, csrf_token: str | None = None) -> dict:
    payload = {
        "id": admin.id,
        "email": admin.email,
        "fullName": admin.full_name,
    }
    if csrf_token is not None:
        payload["csrfToken"] = csrf_token
    return payload


def login(request: Request, start_response, db: DbSession):
    body = request.json_body or {}
    email = str(body.get("email", "")).strip()
    password = str(body.get("password", ""))

    if not email or not password:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Email and password are required")

    _, email_lookup = normalize_and_validate_email(email)
    admin = db.scalar(select(Admin).where(Admin.email_normalized == email_lookup))

    if admin is None or not verify_password(password, admin.password_hash):
        raise HTTPError(HTTPStatus.UNAUTHORIZED, "Invalid email or password")
    if not admin.is_active:
        raise HTTPError(HTTPStatus.FORBIDDEN, "This admin account is inactive")

    session, raw_token = create_session(db, "admin", admin=admin)
    db.commit()

    return json_response(
        start_response,
        HTTPStatus.OK,
        {"admin": _serialize_admin(admin, csrf_token=session.csrf_token)},
        extra_headers=[build_session_cookie_header(settings.admin_session_cookie_name, raw_token)],
    )


def me(request: Request, start_response, db: DbSession):
    auth = load_auth_context(db, request, "admin")
    if auth is None or auth.admin is None:
        return json_response(start_response, HTTPStatus.OK, {"authenticated": False, "admin": None})

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "authenticated": True,
            "admin": _serialize_admin(auth.admin, csrf_token=auth.session.csrf_token),
        },
    )


def logout(request: Request, start_response, db: DbSession):
    auth = require_admin(db, request)
    require_csrf(request, auth.session)
    db.delete(auth.session)
    db.commit()

    return empty_response(
        start_response,
        HTTPStatus.NO_CONTENT,
        extra_headers=[build_clear_cookie_header(settings.admin_session_cookie_name)],
    )