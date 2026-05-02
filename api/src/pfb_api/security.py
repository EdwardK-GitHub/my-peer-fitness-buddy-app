from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import timedelta
from http import HTTPStatus
from http.cookies import SimpleCookie
from typing import Literal

from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from email_validator import EmailNotValidError, validate_email
from sqlalchemy import select
from sqlalchemy.orm import Session as DbSession

from .config import settings
from .http import HTTPError, Request
from .models import Admin, Session, User, utc_now

# Argon2id is the password hashing baseline used for user and admin credentials.
password_hasher = PasswordHasher()
ActorType = Literal["user", "admin"]


@dataclass
class AuthContext:
    session: Session
    actor_type: ActorType
    user: User | None = None
    admin: Admin | None = None


def normalize_and_validate_email(value: str) -> tuple[str, str]:
    """Normalize and validate email addresses before account lookup or account creation."""
    try:
        validated = validate_email(value.strip(), check_deliverability=False)
    except EmailNotValidError as exc:
        raise HTTPError(HTTPStatus.BAD_REQUEST, str(exc)) from exc

    return validated.email, validated.email.lower()


def hash_password(password: str) -> str:
    """Hash a password using Argon2id."""
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a plain password against the stored Argon2 password hash."""
    try:
        return password_hasher.verify(password_hash, password)
    except VerifyMismatchError:
        return False


def create_session(
    db: DbSession,
    actor_type: ActorType,
    *,
    user: User | None = None,
    admin: Admin | None = None,
) -> tuple[Session, str]:
    """Create a browser session for either a student user or an admin.

    The raw token is only returned once to the browser. The database stores only the token hash.
    """
    raw_token = secrets.token_urlsafe(48)
    csrf_token = secrets.token_urlsafe(32)
    expires_at = utc_now() + timedelta(hours=settings.session_ttl_hours)

    session = Session(
        actor_type=actor_type,
        user=user,
        admin=admin,
        token_hash=hash_token(raw_token),
        csrf_token=csrf_token,
        expires_at=expires_at,
        last_seen_at=utc_now(),
    )
    db.add(session)
    db.flush()
    return session, raw_token


def hash_token(raw_token: str) -> str:
    """Hash a browser session token before storing or looking it up."""
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def build_session_cookie_header(cookie_name: str, raw_token: str) -> tuple[str, str]:
    """Build the secure HTTP-only session cookie header."""
    cookie = SimpleCookie()
    cookie[cookie_name] = raw_token
    cookie[cookie_name]["path"] = "/"
    cookie[cookie_name]["httponly"] = True
    cookie[cookie_name]["samesite"] = "Lax"
    cookie[cookie_name]["max-age"] = str(settings.session_ttl_hours * 60 * 60)
    if settings.cookie_secure:
        cookie[cookie_name]["secure"] = True
    return ("Set-Cookie", cookie.output(header="").strip())


def build_clear_cookie_header(cookie_name: str) -> tuple[str, str]:
    """Build a cookie header that clears a session cookie from the browser."""
    cookie = SimpleCookie()
    cookie[cookie_name] = ""
    cookie[cookie_name]["path"] = "/"
    cookie[cookie_name]["httponly"] = True
    cookie[cookie_name]["samesite"] = "Lax"
    cookie[cookie_name]["max-age"] = "0"
    cookie[cookie_name]["expires"] = "Thu, 01 Jan 1970 00:00:00 GMT"
    if settings.cookie_secure:
        cookie[cookie_name]["secure"] = True
    return ("Set-Cookie", cookie.output(header="").strip())


def load_auth_context(db: DbSession, request: Request, actor_type: ActorType) -> AuthContext | None:
    """Resolve the current browser session for one actor type.

    This function intentionally stays usable for both role checks and the session-status endpoints.
    """
    cookie_name = (
        settings.session_cookie_name if actor_type == "user" else settings.admin_session_cookie_name
    )
    raw_token = request.cookies.get(cookie_name)
    if not raw_token:
        return None

    session = db.scalar(select(Session).where(Session.token_hash == hash_token(raw_token)))
    if session is None or session.actor_type != actor_type:
        return None

    if session.expires_at <= utc_now():
        db.delete(session)
        db.commit()
        return None

    session.last_seen_at = utc_now()
    db.commit()
    db.refresh(session)

    if actor_type == "user" and session.user is not None:
        return AuthContext(session=session, actor_type="user", user=session.user)
    if actor_type == "admin" and session.admin is not None:
        return AuthContext(session=session, actor_type="admin", admin=session.admin)
    return None


def require_user(
    db: DbSession,
    request: Request,
    *,
    allow_cross_role: bool = False,
) -> AuthContext:
    """Require an authenticated student user.

    FReq 1, FReq 2, FReq 3, FReq 5, and the student side of FReq 6 are student actions.
    Admin sessions are intentionally blocked from these user-only actions.
    """
    if not allow_cross_role:
        admin_auth = load_auth_context(db, request, "admin")
        if admin_auth is not None and admin_auth.admin is not None:
            raise HTTPError(
                HTTPStatus.FORBIDDEN,
                "Sign out of the admin account before using student features",
            )

    auth = load_auth_context(db, request, "user")
    if auth is None or auth.user is None:
        raise HTTPError(HTTPStatus.UNAUTHORIZED, "Authentication required")
    return auth


def require_admin(
    db: DbSession,
    request: Request,
    *,
    allow_cross_role: bool = False,
) -> AuthContext:
    """Require an authenticated admin.

    FReq 4 and the admin-review side of FReq 6 are admin-only actions.
    Student sessions are intentionally blocked from these admin-only actions.
    """
    if not allow_cross_role:
        user_auth = load_auth_context(db, request, "user")
        if user_auth is not None and user_auth.user is not None:
            raise HTTPError(
                HTTPStatus.FORBIDDEN,
                "Sign out of the student account before using admin features",
            )

    auth = load_auth_context(db, request, "admin")
    if auth is None or auth.admin is None:
        raise HTTPError(HTTPStatus.UNAUTHORIZED, "Admin authentication required")
    return auth


def require_csrf(request: Request, session: Session) -> None:
    """Require a matching CSRF token for protected session-changing actions."""
    csrf_header = request.headers.get("X-Csrf-Token")
    if not csrf_header or csrf_header != session.csrf_token:
        raise HTTPError(HTTPStatus.FORBIDDEN, "Missing or invalid CSRF token")
