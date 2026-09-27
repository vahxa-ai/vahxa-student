from sqlalchemy import Enum as SAEnum, inspect, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

_is_sqlite = settings.database_url.startswith("sqlite")

engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    future=True,
    # Postgres (Cloud SQL): drop connections that went stale while the Cloud Run instance was idle,
    # and keep the pool small — the smallest Cloud SQL tier allows only ~25 connections.
    **({} if _is_sqlite else {"pool_pre_ping": True, "pool_size": 5, "max_overflow": 2, "pool_recycle": 1800}),
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


def _add_missing_columns(conn) -> None:
    """Lightweight additive migration: ADD COLUMN for nullable model columns missing from existing tables.
    (create_all only creates missing tables; it never alters existing ones.)"""
    inspector = inspect(conn)
    existing_tables = set(inspector.get_table_names())
    for table in Base.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue
        present = {c["name"] for c in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name in present or not column.nullable:
                continue
            if isinstance(column.type, SAEnum):
                # Postgres needs the enum type to exist before a column can use it (no-op on SQLite)
                column.type.create(conn, checkfirst=True)
            col_type = column.type.compile(dialect=conn.dialect)
            conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type}'))


def _backfill_owners(conn) -> None:
    """Rows created before multi-student support belong to the original (lowest-id) student. Idempotent."""
    for table in ("activities", "subjects", "deadlines"):
        conn.execute(text(
            f'UPDATE "{table}" SET student_id = (SELECT MIN(id) FROM student) WHERE student_id IS NULL'
        ))


async def init_db():
    """Create all tables on startup, add any new nullable columns to existing tables, backfill owners."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_missing_columns)
        await conn.run_sync(_backfill_owners)
