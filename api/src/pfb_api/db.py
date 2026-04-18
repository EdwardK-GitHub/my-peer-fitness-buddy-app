from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    # All ORM models inherit from this base class.
    pass


# Use one shared SQLAlchemy engine for the whole application process.
engine = create_engine(
    settings.database_url,
    future=True,
    pool_pre_ping=True,
)

# SessionLocal is the factory used by request handlers and scripts.
SessionLocal = sessionmaker(
    bind=engine,
    autoflush=False,
    autocommit=False,
    expire_on_commit=False,
)