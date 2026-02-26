"""Migration: Add archive and variable tracking columns to variants table."""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine

def migrate():
    """Add archive and variable tracking columns to variants table."""
    with engine.connect() as conn:
        try:
            # Add archived column
            conn.execute(text("ALTER TABLE variants ADD COLUMN archived BOOLEAN DEFAULT 0"))
            conn.commit()
            print("✓ Added archived column to variants table")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("✓ Archived column already exists")
            else:
                print(f"✗ Error adding archived column: {e}")
                raise
        
        try:
            # Add archived_at column
            conn.execute(text("ALTER TABLE variants ADD COLUMN archived_at DATETIME"))
            conn.commit()
            print("✓ Added archived_at column to variants table")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("✓ Archived_at column already exists")
            else:
                print(f"✗ Error adding archived_at column: {e}")
                raise
        
        try:
            # Add archive_reason column
            conn.execute(text("ALTER TABLE variants ADD COLUMN archive_reason TEXT"))
            conn.commit()
            print("✓ Added archive_reason column to variants table")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("✓ Archive_reason column already exists")
            else:
                print(f"✗ Error adding archive_reason column: {e}")
                raise
        
        try:
            # Add variables_used column
            conn.execute(text("ALTER TABLE variants ADD COLUMN variables_used TEXT"))
            conn.commit()
            print("✓ Added variables_used column to variants table")
        except Exception as e:
            if "duplicate column" in str(e).lower() or "already exists" in str(e).lower():
                print("✓ Variables_used column already exists")
            else:
                print(f"✗ Error adding variables_used column: {e}")
                raise
        finally:
            conn.close()

if __name__ == "__main__":
    migrate()
