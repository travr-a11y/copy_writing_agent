"""Variant generation endpoints."""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.campaign import Campaign
from app.models.variant import Variant
from app.services.drafting import generate_variant_pairs, generate_chunk_variant
from app.config import get_settings, VARIANT_ANGLES

router = APIRouter()
settings = get_settings()


class GenerateRequest(BaseModel):
    """Request body for generating variants."""
    num_variants: Optional[int] = None
    angles: Optional[List[str]] = None
    chunk_preference: Optional[str] = None  # "base" | "up" | "down"
    custom_instructions: Optional[str] = None


class ChunkRequest(BaseModel):
    """Request body for generating chunk variants."""
    direction: str  # "up" or "down"


class VariantUpdate(BaseModel):
    """Request body for updating variant body (inline edit)."""
    body: str


class ArchiveRequest(BaseModel):
    """Request body for archiving a variant."""
    reason: Optional[str] = None


@router.post("/campaigns/{campaign_id}/generate")
async def generate_variants(
    campaign_id: str,
    request: GenerateRequest = GenerateRequest(),
    db: Session = Depends(get_db)
):
    """Generate lead + follow-up variant pairs using overflow capture."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Validate research is complete
    if not campaign.research_version:
        raise HTTPException(
            status_code=400, 
            detail="ICP research required. Run research first."
        )
    if not campaign.voc_pain_themes or len(campaign.voc_pain_themes) == 0:
        raise HTTPException(
            status_code=400, 
            detail="Pain Points research required. Run research first."
        )
    
    # Validate research is current (not stale)
    if (campaign.docs_last_processed_at and campaign.last_research_at and 
        campaign.docs_last_processed_at > campaign.last_research_at):
        raise HTTPException(
            status_code=400, 
            detail="New documents processed since last research. Refresh research first."
        )
    
    num_variants = request.num_variants or settings.default_num_variants
    angles = request.angles or VARIANT_ANGLES[:num_variants]
    
    # Ensure we have enough angles
    if len(angles) < num_variants:
        # Cycle through angles if not enough
        while len(angles) < num_variants:
            angles.extend(VARIANT_ANGLES)
        angles = angles[:num_variants]
    
    try:
        variant_pairs = await generate_variant_pairs(
            campaign, 
            angles, 
            db,
            custom_instructions=request.custom_instructions,
            chunk_preference=request.chunk_preference
        )
        return {
            "status": "success",
            "count": len(variant_pairs),
            "pairs": variant_pairs
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/variants/{variant_id}/chunk")
async def create_chunk_variant(
    variant_id: str,
    request: ChunkRequest,
    db: Session = Depends(get_db)
):
    """Generate a chunk up or chunk down version of a variant. If chunking a lead, also chunks its paired follow-up."""
    if request.direction not in ["up", "down"]:
        raise HTTPException(status_code=400, detail="Direction must be 'up' or 'down'")
    
    variant = db.query(Variant).filter(Variant.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    
    if variant.chunk != "base":
        raise HTTPException(
            status_code=400,
            detail="Can only create chunk variants from base variants"
        )
    
    try:
        chunk_variant = await generate_chunk_variant(variant, request.direction, db)
        
        # If chunking a lead, also chunk its paired follow-up
        if variant.touch == "lead":
            followup = db.query(Variant).filter(
                Variant.lead_variant_id == variant.id,
                Variant.touch == "followup",
                Variant.chunk == "base"
            ).first()
            
            if followup:
                followup_chunk = await generate_chunk_variant(followup, request.direction, db)
                return {
                    "lead": chunk_variant.to_dict(),
                    "followup": followup_chunk.to_dict()
                }
        
        return chunk_variant.to_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/variants/{variant_id}/regenerate")
async def regenerate_variant(variant_id: str, db: Session = Depends(get_db)):
    """Regenerate a single variant."""
    variant = db.query(Variant).filter(Variant.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    
    campaign = db.query(Campaign).filter(Campaign.id == variant.campaign_id).first()
    
    try:
        # Generate new variant pair with same angle
        new_pairs = await generate_variant_pairs(campaign, [variant.angle], db)
        if new_pairs:
            return {
                "status": "regenerated",
                "pair": new_pairs[0]
            }
        raise HTTPException(status_code=500, detail="Failed to regenerate")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/campaigns/{campaign_id}/variants")
async def list_variants(
    campaign_id: str,
    touch: Optional[str] = None,
    chunk: Optional[str] = None,
    qa_pass: Optional[bool] = None,
    starred: Optional[bool] = None,
    include_archived: bool = False,
    db: Session = Depends(get_db)
):
    """List variants for a campaign with optional filters."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    query = db.query(Variant).filter(Variant.campaign_id == campaign_id)
    
    if not include_archived:
        query = query.filter(Variant.archived == False)
    
    if touch:
        query = query.filter(Variant.touch == touch)
    if chunk:
        query = query.filter(Variant.chunk == chunk)
    if qa_pass is not None:
        query = query.filter(Variant.qa_pass == qa_pass)
    if starred is not None:
        query = query.filter(Variant.starred == starred)
    
    variants = query.order_by(Variant.created_at.desc()).all()
    return [v.to_dict() for v in variants]


@router.get("/variants/{variant_id}")
async def get_variant(variant_id: str, db: Session = Depends(get_db)):
    """Get a single variant."""
    variant = db.query(Variant).filter(Variant.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    return variant.to_dict()


@router.put("/variants/{variant_id}")
async def update_variant(
    variant_id: str,
    update: VariantUpdate,
    db: Session = Depends(get_db)
):
    """Update variant body (inline editing)."""
    variant = db.query(Variant).filter(Variant.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    
    # Update body and recalculate metrics
    variant.body = update.body
    variant.word_count = len(update.body.split())
    
    # Re-run QA on edited variant
    from app.services.qa import check_variant_qa
    qa_result = check_variant_qa(variant)
    variant.qa_pass = qa_result["pass"]
    variant.qa_notes = qa_result.get("notes")
    
    db.commit()
    db.refresh(variant)
    return variant.to_dict()


@router.put("/variants/{variant_id}/star")
async def toggle_star_variant(variant_id: str, db: Session = Depends(get_db)):
    """Toggle starred status of a variant."""
    variant = db.query(Variant).filter(Variant.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    
    variant.starred = not variant.starred
    db.commit()
    db.refresh(variant)
    return variant.to_dict()


@router.put("/variants/{variant_id}/archive")
async def archive_variant(
    variant_id: str,
    request: ArchiveRequest = ArchiveRequest(),
    db: Session = Depends(get_db)
):
    """Archive a variant (soft delete)."""
    from datetime import datetime
    
    variant = db.query(Variant).filter(Variant.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    
    if variant.archived:
        raise HTTPException(status_code=400, detail="Variant is already archived")
    
    variant.archived = True
    variant.archived_at = datetime.utcnow()
    variant.archive_reason = request.reason
    
    db.commit()
    db.refresh(variant)
    return variant.to_dict()


@router.put("/variants/{variant_id}/restore")
async def restore_variant(variant_id: str, db: Session = Depends(get_db)):
    """Restore an archived variant."""
    variant = db.query(Variant).filter(Variant.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    
    if not variant.archived:
        raise HTTPException(status_code=400, detail="Variant is not archived")
    
    variant.archived = False
    variant.archived_at = None
    variant.archive_reason = None
    
    db.commit()
    db.refresh(variant)
    return variant.to_dict()


@router.put("/variants/{variant_id}/thesis")
async def update_thesis(
    variant_id: str,
    thesis: str = Query(..., description="The thesis statement"),
    db: Session = Depends(get_db)
):
    """Update the thesis/testing assumption for a variant."""
    variant = db.query(Variant).filter(Variant.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    
    variant.thesis = thesis
    db.commit()
    db.refresh(variant)
    return variant.to_dict()


@router.delete("/variants/{variant_id}")
async def delete_variant(variant_id: str, db: Session = Depends(get_db)):
    """Delete a variant. Only works on archived variants."""
    variant = db.query(Variant).filter(Variant.id == variant_id).first()
    if not variant:
        raise HTTPException(status_code=404, detail="Variant not found")
    
    if not variant.archived:
        raise HTTPException(
            status_code=400,
            detail="Variant must be archived before deletion. Use archive endpoint first."
        )
    
    db.delete(variant)
    db.commit()
    return {"status": "deleted"}
