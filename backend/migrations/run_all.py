"""
Run all database migrations.

These migrations handle upgrading an existing database to match the current
model definitions. For fresh databases, init_db() creates all tables with
the correct schema automatically.

Usage:
    cd backend && python -m migrations.run_all
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine, SessionLocal
from app.config import get_settings


def add_column_if_missing(conn, table: str, column: str, col_type: str, default=None):
    """Add a column to a table if it doesn't already exist."""
    default_clause = f" DEFAULT {default}" if default is not None else ""
    try:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}{default_clause}"))
        conn.commit()
        print(f"  + Added {table}.{column}")
    except Exception as e:
        if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
            print(f"  = {table}.{column} already exists")
        else:
            raise


def migrate():
    """Run all migrations in order."""
    print("Running database migrations...")

    with engine.connect() as conn:
        add_column_if_missing(conn, "variants", "starred", "BOOLEAN", default=0)
        add_column_if_missing(conn, "variants", "thesis", "TEXT")

    print("Migrations complete.")


if __name__ == "__main__":
    migrate()
