"""Migration: Add thesis column to variants table."""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine

def migrate():
    """Add thesis column to variants table."""
    with engine.connect() as conn:
        try:
            conn.execute(text("ALTER TABLE variants ADD COLUMN thesis TEXT"))
            conn.commit()
            print("✓ Added thesis column to variants table")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("✓ Thesis column already exists")
            else:
                print(f"✗ Error: {e}")
                raise
        finally:
            conn.close()

if __name__ == "__main__":
    migrate()
