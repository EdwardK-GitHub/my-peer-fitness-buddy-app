from __future__ import annotations

from http import HTTPStatus

from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from ..config import settings
from ..http import HTTPError, Request, empty_response, json_response
from ..models import User
from ..security import (
    build_clear_cookie_header,
    build_session_cookie_header,
    create_session,
    hash_password,
    load_auth_context,
    normalize_and_validate_email,
    require_csrf,
    require_user,
    verify_password,
)


def _serialize_user(user: User, csrf_token: str | None = None) -> dict:
    payload = {
        "id": user.id,
        "email": user.email,
        "fullName": user.full_name,
    }
    if csrf_token is not None:
        payload["csrfToken"] = csrf_token
    return payload


def register(request: Request, start_response, db: DbSession):
    body = request.json_body or {}
    full_name = str(body.get("fullName", "")).strip()
    email = str(body.get("email", "")).strip()
    password = str(body.get("password", ""))

    if not full_name:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Full name is required")
    if len(full_name) > 120:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Full name is too long")
    if len(password) < 8:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Password must be at least 8 characters long")

    normalized_email, email_lookup = normalize_and_validate_email(email)

    existing_user = db.scalar(select(User).where(User.email_normalized == email_lookup))
    if existing_user is not None:
        raise HTTPError(HTTPStatus.CONFLICT, "An account with that email already exists")

    user = User(
        email=normalized_email,
        email_normalized=email_lookup,
        password_hash=hash_password(password),
        full_name=full_name,
        is_active=True,
    )
    db.add(user)
    db.flush()

    session, raw_token = create_session(db, "user", user=user)
    db.commit()
    db.refresh(user)

    return json_response(
        start_response,
        HTTPStatus.CREATED,
        {"user": _serialize_user(user, csrf_token=session.csrf_token)},
        extra_headers=[build_session_cookie_header(settings.session_cookie_name, raw_token)],
    )


def login(request: Request, start_response, db: DbSession):
    body = request.json_body or {}
    email = str(body.get("email", "")).strip()
    password = str(body.get("password", ""))

    if not email or not password:
        raise HTTPError(HTTPStatus.BAD_REQUEST, "Email and password are required")

    _, email_lookup = normalize_and_validate_email(email)
    user = db.scalar(select(User).where(User.email_normalized == email_lookup))

    if user is None or not verify_password(password, user.password_hash):
        raise HTTPError(HTTPStatus.UNAUTHORIZED, "Invalid email or password")
    if not user.is_active:
        raise HTTPError(HTTPStatus.FORBIDDEN, "This account is inactive")

    session, raw_token = create_session(db, "user", user=user)
    db.commit()

    return json_response(
        start_response,
        HTTPStatus.OK,
        {"user": _serialize_user(user, csrf_token=session.csrf_token)},
        extra_headers=[build_session_cookie_header(settings.session_cookie_name, raw_token)],
    )


def me(request: Request, start_response, db: DbSession):
    auth = load_auth_context(db, request, "user")
    if auth is None or auth.user is None:
        return json_response(start_response, HTTPStatus.OK, {"authenticated": False, "user": None})

    return json_response(
        start_response,
        HTTPStatus.OK,
        {
            "authenticated": True,
            "user": _serialize_user(auth.user, csrf_token=auth.session.csrf_token),
        },
    )


def logout(request: Request, start_response, db: DbSession):
    auth = require_user(db, request)
    require_csrf(request, auth.session)
    db.delete(auth.session)
    db.commit()

    return empty_response(
        start_response,
        HTTPStatus.NO_CONTENT,
        extra_headers=[build_clear_cookie_header(settings.session_cookie_name)],
    )