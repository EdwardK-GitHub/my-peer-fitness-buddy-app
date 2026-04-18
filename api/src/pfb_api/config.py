from __future__ import annotations

import os
# Load configuration from the local .env file so every teammate uses the same keys.
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")


def _read_bool(name: str, default: bool) -> bool:
    # Keep boolean parsing centralized so environment handling stays consistent.
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    app_env: str = os.getenv("APP_ENV", "development")
    api_host: str = os.getenv("API_HOST", "localhost")
    api_port: int = int(os.getenv("API_PORT", "8000"))
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg://peer_fitness_buddy:peer_fitness_buddy@127.0.0.1:5432/peer_fitness_buddy",
    )
    web_origin: str = os.getenv("WEB_ORIGIN", "http://localhost:5173")
    session_cookie_name: str = os.getenv("SESSION_COOKIE_NAME", "pfb_user_session")
    admin_session_cookie_name: str = os.getenv(
        "ADMIN_SESSION_COOKIE_NAME", "pfb_admin_session"
    )
    session_ttl_hours: int = int(os.getenv("SESSION_TTL_HOURS", "336"))
    cookie_secure: bool = _read_bool("COOKIE_SECURE", False)

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"


settings = Settings()