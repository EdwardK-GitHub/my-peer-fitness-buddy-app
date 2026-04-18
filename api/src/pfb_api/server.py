from __future__ import annotations

from wsgiref.simple_server import make_server

from .app import application
from .config import settings


def main() -> None:
    with make_server(settings.api_host, settings.api_port, application) as httpd:
        print(f"API server listening on http://{settings.api_host}:{settings.api_port}")
        httpd.serve_forever()


if __name__ == "__main__":
    main()