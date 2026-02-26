"""Migration: Add source_type and additional_context columns to documents table."""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine

def migrate():
    """Add source_type and additional_context columns to documents table."""
    with engine.connect() as conn:
        try:
            # Add source_type column
            conn.execute(text("ALTER TABLE documents ADD COLUMN source_type VARCHAR(50)"))
            conn.commit()
            print("✓ Added source_type column to documents table")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("✓ source_type column already exists")
            else:
                print(f"✗ Error adding source_type: {e}")
                raise
        
        try:
            # Add additional_context column
            conn.execute(text("ALTER TABLE documents ADD COLUMN additional_context TEXT"))
            conn.commit()
            print("✓ Added additional_context column to documents table")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("✓ additional_context column already exists")
            else:
                print(f"✗ Error adding additional_context: {e}")
                raise
        finally:
            conn.close()

if __name__ == "__main__":
    migrate()
