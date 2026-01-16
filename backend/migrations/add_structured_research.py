"""Migration: Add structured ICP/VOC fields and research management to campaigns table."""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine

def migrate():
    """Add structured research fields to campaigns table."""
    with engine.connect() as conn:
        try:
            # ─── BASICS ───
            try:
                conn.execute(text("ALTER TABLE campaigns ADD COLUMN industry VARCHAR(255)"))
                print("✓ Added industry column")
            except Exception as e:
                if "duplicate column" not in str(e).lower():
                    print(f"  Industry column: {e}")
            
            try:
                conn.execute(text("ALTER TABLE campaigns ADD COLUMN geography VARCHAR(255) DEFAULT 'Australia'"))
                print("✓ Added geography column")
            except Exception as e:
                if "duplicate column" not in str(e).lower():
                    print(f"  Geography column: {e}")
            
            try:
                conn.execute(text("ALTER TABLE campaigns ADD COLUMN service_offering TEXT"))
                print("✓ Added service_offering column")
            except Exception as e:
                if "duplicate column" not in str(e).lower():
                    print(f"  Service offering column: {e}")
            
            # ─── STRUCTURED ICP ───
            icp_fields = [
                "icp_firmographics",
                "icp_technographics",
                "icp_buyer_personas",
                "icp_psychographics",
                "icp_triggers",
                "icp_qualification",
                "icp_buying_journey",
                "icp_messaging_angles",
                "icp_channels",
            ]
            
            for field in icp_fields:
                try:
                    conn.execute(text(f"ALTER TABLE campaigns ADD COLUMN {field} TEXT"))
                    print(f"✓ Added {field} column")
                except Exception as e:
                    if "duplicate column" not in str(e).lower():
                        print(f"  {field} column: {e}")
            
            # ─── VOC DATA ───
            voc_fields = [
                "voc_pain_themes",
                "voc_language_bank",
                "voc_objections",
                "voc_implications",
            ]
            
            for field in voc_fields:
                try:
                    conn.execute(text(f"ALTER TABLE campaigns ADD COLUMN {field} TEXT"))
                    print(f"✓ Added {field} column")
                except Exception as e:
                    if "duplicate column" not in str(e).lower():
                        print(f"  {field} column: {e}")
            
            # ─── RESEARCH MANAGEMENT ───
            try:
                conn.execute(text("ALTER TABLE campaigns ADD COLUMN additional_learnings TEXT DEFAULT ''"))
                print("✓ Added additional_learnings column")
            except Exception as e:
                if "duplicate column" not in str(e).lower():
                    print(f"  Additional learnings column: {e}")
            
            try:
                conn.execute(text("ALTER TABLE campaigns ADD COLUMN research_version INTEGER"))
                print("✓ Added research_version column")
            except Exception as e:
                if "duplicate column" not in str(e).lower():
                    print(f"  Research version column: {e}")
            
            try:
                conn.execute(text("ALTER TABLE campaigns ADD COLUMN research_history TEXT"))
                print("✓ Added research_history column")
            except Exception as e:
                if "duplicate column" not in str(e).lower():
                    print(f"  Research history column: {e}")
            
            try:
                conn.execute(text("ALTER TABLE campaigns ADD COLUMN last_research_at DATETIME"))
                print("✓ Added last_research_at column")
            except Exception as e:
                if "duplicate column" not in str(e).lower():
                    print(f"  Last research at column: {e}")
            
            try:
                conn.execute(text("ALTER TABLE campaigns ADD COLUMN research_skipped VARCHAR(10) DEFAULT 'false'"))
                print("✓ Added research_skipped column")
            except Exception as e:
                if "duplicate column" not in str(e).lower():
                    print(f"  Research skipped column: {e}")
            
            # Make legacy fields nullable (they were required before)
            try:
                conn.execute(text("ALTER TABLE campaigns ALTER COLUMN icp DROP NOT NULL"))
                print("✓ Made icp nullable")
            except Exception as e:
                print(f"  ICP nullable: {e}")
            
            try:
                conn.execute(text("ALTER TABLE campaigns ALTER COLUMN pain_points DROP NOT NULL"))
                print("✓ Made pain_points nullable")
            except Exception as e:
                print(f"  Pain points nullable: {e}")
            
            try:
                conn.execute(text("ALTER TABLE campaigns ALTER COLUMN offer DROP NOT NULL"))
                print("✓ Made offer nullable")
            except Exception as e:
                print(f"  Offer nullable: {e}")
            
            conn.commit()
            print("\n✅ Migration complete: All structured research fields added")
            
        except Exception as e:
            print(f"\n✗ Migration error: {e}")
            conn.rollback()
            raise
        finally:
            conn.close()

if __name__ == "__main__":
    migrate()
