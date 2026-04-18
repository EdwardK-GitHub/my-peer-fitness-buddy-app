from __future__ import annotations

import json
from dataclasses import dataclass, field
from http import HTTPStatus
from http.cookies import SimpleCookie
from typing import Any
from urllib.parse import parse_qs


@dataclass
class Request:
    # This lightweight request object gives us framework-like ergonomics without using a framework.
    environ: dict[str, Any]
    method: str
    path: str
    query_params: dict[str, list[str]]
    headers: dict[str, str]
    cookies: dict[str, str]
    raw_body: bytes
    json_body: dict[str, Any] | None
    path_params: dict[str, str] = field(default_factory=dict)


class HTTPError(Exception):
    # Raise this from handlers whenever you want a controlled JSON error response.
    def __init__(self, status: int, message: str, details: dict[str, Any] | None = None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.details = details or {}


def load_request(environ: dict[str, Any]) -> Request:
    # Convert the raw WSGI environment into a small, typed request structure.
    method = environ.get("REQUEST_METHOD", "GET").upper()
    path = environ.get("PATH_INFO", "/")
    query_string = environ.get("QUERY_STRING", "")
    query_params = parse_qs(query_string, keep_blank_values=True)

    headers = {
        key[5:].replace("_", "-").title(): value
        for key, value in environ.items()
        if key.startswith("HTTP_")
    }
    if environ.get("CONTENT_TYPE"):
        headers["Content-Type"] = environ["CONTENT_TYPE"]

    cookie_header = environ.get("HTTP_COOKIE", "")
    parsed_cookies = SimpleCookie()
    parsed_cookies.load(cookie_header)
    cookies = {name: morsel.value for name, morsel in parsed_cookies.items()}

    body_length = int(environ.get("CONTENT_LENGTH") or 0)
    raw_body = environ["wsgi.input"].read(body_length) if body_length else b""

    json_body = None
    if raw_body and "application/json" in headers.get("Content-Type", ""):
        try:
            json_body = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError as exc:
            raise HTTPError(HTTPStatus.BAD_REQUEST, "Request body must be valid JSON") from exc

    return Request(
        environ=environ,
        method=method,
        path=path,
        query_params=query_params,
        headers=headers,
        cookies=cookies,
        raw_body=raw_body,
        json_body=json_body,
    )


def json_response(
    start_response,
    status: int,
    payload: dict[str, Any],
    extra_headers: list[tuple[str, str]] | None = None,
):
    body = json.dumps(payload, default=str).encode("utf-8")
    headers = [
        ("Content-Type", "application/json; charset=utf-8"),
        ("Content-Length", str(len(body))),
    ]
    if extra_headers:
        headers.extend(extra_headers)
    start_response(f"{status} {HTTPStatus(status).phrase}", headers)
    return [body]


def empty_response(
    start_response,
    status: int = HTTPStatus.NO_CONTENT,
    extra_headers: list[tuple[str, str]] | None = None,
):
    headers = [("Content-Length", "0")]
    if extra_headers:
        headers.extend(extra_headers)
    start_response(f"{status} {HTTPStatus(status).phrase}", headers)
    return [b""]