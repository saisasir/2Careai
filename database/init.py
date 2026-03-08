"""
Database initialization — async connection pool, table creation, seed data.
"""

import logging
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy import text

from backend.config import get_settings
from scheduler.appointment_engine.models import Base

logger = logging.getLogger("careai.db")
settings = get_settings()

# Global engine and session factory
_engine = None
_session_factory = None


async def init_database():
    """Initialize database engine, create tables, and seed data."""
    global _engine, _session_factory

    _engine = create_async_engine(
        settings.database_url,
        echo=settings.debug,
        pool_size=10,
        max_overflow=20,
        pool_pre_ping=True,
    )

    _session_factory = async_sessionmaker(
        _engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    # Create all tables
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    logger.info("Database tables created/verified")

    # Seed data if empty
    await _seed_if_empty()


async def _seed_if_empty():
    """Insert seed data if the doctors table is empty."""
    async with get_db_session() as session:
        result = await session.execute(text("SELECT COUNT(*) FROM doctors"))
        count = result.scalar()
        logger.info(f"Database check: {count} doctors found in table")

        if count == 0:
            logger.info("Seeding database with initial data...")
            schema_path = Path(__file__).parent / "schema.sql"
            logger.info(f"Looking for schema at: {schema_path.absolute()}")

            if schema_path.exists():
                logger.info(f"Schema file found. Reading content...")
                sql = schema_path.read_text(encoding="utf-8")
                statements = [s.strip() for s in sql.split(";") if s.strip().upper().startswith("INSERT")]
                logger.info(f"Found {len(statements)} INSERT statements to execute")
                
                for stmt in statements:
                    try:
                        await session.execute(text(stmt))
                        logger.info(f"Executed statement: {stmt[:50]}...")
                    except Exception as se:
                        logger.error(f"Error executing seed statement: {se}")
                
                await session.commit()
                logger.info("Seed data committed successfully")
            else:
                logger.warning(f"Schema file NOT FOUND at: {schema_path.absolute()}")
        else:
            logger.info(f"Database already has {count} doctors — skipping seed")


async def close_database():
    """Dispose database engine."""
    global _engine
    if _engine:
        await _engine.dispose()
        logger.info("Database connection closed")


def get_session_factory() -> async_sessionmaker:
    """Get the session factory."""
    if _session_factory is None:
        raise RuntimeError("Database not initialized. Call init_database() first.")
    return _session_factory


class get_db_session:
    """Async context manager for database sessions."""

    async def __aenter__(self) -> AsyncSession:
        factory = get_session_factory()
        self._session = factory()
        return self._session

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            await self._session.rollback()
        await self._session.close()
