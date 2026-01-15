"""Migration: Backfill thesis for all existing variants."""
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from sqlalchemy.orm import Session
from anthropic import Anthropic
from app.database import engine, SessionLocal
from app.models.variant import Variant
from app.config import get_settings

settings = get_settings()
client = Anthropic(api_key=settings.anthropic_api_key)

THESIS_GENERATION_PROMPT = """You are analyzing an email variant to determine its testing thesis.

The variant uses the angle: {angle}

Email body:
{body}

Generate a thesis statement in this exact format:
"[Angle] | [Specific offer aspect being tested]"

Examples:
- "Curiosity hook | Direct mobile access to account managers"
- "Pain point empathy | Communication blackouts during freight issues"
- "Outcome focus | Time savings from streamlined logistics"

Return ONLY the thesis statement, nothing else."""

def generate_thesis_for_variant(variant: Variant) -> str:
    """Generate thesis for a variant using Claude."""
    try:
        response = client.messages.create(
            model=settings.claude_model,
            max_tokens=100,
            messages=[
                {
                    "role": "user",
                    "content": THESIS_GENERATION_PROMPT.format(
                        angle=variant.angle,
                        body=variant.body
                    )
                }
            ],
            temperature=0.3,
        )
        
        thesis = response.content[0].text.strip()
        # Clean up any markdown formatting
        thesis = thesis.replace("**", "").replace("*", "").strip()
        return thesis
    except Exception as e:
        print(f"Error generating thesis for variant {variant.id}: {e}")
        return f"{variant.angle} | Testing offer resonance"

def migrate():
    """Backfill thesis for all variants that don't have one."""
    db: Session = SessionLocal()
    
    try:
        # Get all variants without thesis
        variants = db.query(Variant).filter(
            (Variant.thesis == None) | (Variant.thesis == "")
        ).all()
        
        total = len(variants)
        print(f"Found {total} variants without thesis")
        
        if total == 0:
            print("✓ All variants already have thesis")
            return
        
        updated = 0
        errors = 0
        
        for i, variant in enumerate(variants, 1):
            try:
                print(f"[{i}/{total}] Generating thesis for variant {variant.id} ({variant.angle})...")
                thesis = generate_thesis_for_variant(variant)
                variant.thesis = thesis
                db.commit()
                updated += 1
                print(f"  ✓ Thesis: {thesis}")
            except Exception as e:
                print(f"  ✗ Error: {e}")
                errors += 1
                db.rollback()
                # Set a fallback thesis
                variant.thesis = f"{variant.angle} | Testing offer resonance"
                db.commit()
                updated += 1
        
        print(f"\n✓ Migration complete: {updated} updated, {errors} errors")
        
    except Exception as e:
        print(f"✗ Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    migrate()
