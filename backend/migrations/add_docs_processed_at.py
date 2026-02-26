"""Migration: Add docs_last_processed_at column to campaigns table."""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine

def migrate():
    """Add docs_last_processed_at column to track when documents were last processed."""
    with engine.connect() as conn:
        try:
            try:
                conn.execute(text("ALTER TABLE campaigns ADD COLUMN docs_last_processed_at DATETIME"))
                print("✓ Added docs_last_processed_at column")
            except Exception as e:
                if "duplicate column" not in str(e).lower():
                    print(f"  docs_last_processed_at column: {e}")
                else:
                    print("  docs_last_processed_at column already exists")
            
            conn.commit()
            print("\n✅ Migration complete: docs_last_processed_at column added")
            
        except Exception as e:
            print(f"\n✗ Migration error: {e}")
            conn.rollback()
            raise
        finally:
            conn.close()

if __name__ == "__main__":
    migrate()
