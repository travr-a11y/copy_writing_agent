"""Campaign CRUD endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.campaign import Campaign
from app.services.auto_context import create_campaign_context_document
from app.services.gap_analysis import analyze_gaps
from app.services.research import research_pain_points


router = APIRouter()


class CampaignCreate(BaseModel):
    """Request body for creating a campaign."""
    name: str
    icp: str
    pain_points: str
    offer: str
    brief: Optional[str] = None


class CampaignUpdate(BaseModel):
    """Request body for updating a campaign."""
    name: Optional[str] = None
    icp: Optional[str] = None
    pain_points: Optional[str] = None
    offer: Optional[str] = None
    brief: Optional[str] = None


@router.get("")
async def list_campaigns(db: Session = Depends(get_db)):
    """List all campaigns."""
    campaigns = db.query(Campaign).order_by(Campaign.created_at.desc()).all()
    return [c.to_dict(include_counts=True) for c in campaigns]


@router.post("")
async def create_campaign(campaign: CampaignCreate, db: Session = Depends(get_db)):
    """Create a new campaign and auto-create context document."""
    db_campaign = Campaign(
        name=campaign.name,
        icp=campaign.icp,
        pain_points=campaign.pain_points,
        offer=campaign.offer,
        brief=campaign.brief,
    )
    db.add(db_campaign)
    db.commit()
    db.refresh(db_campaign)
    
    # Auto-create campaign context document
    try:
        await create_campaign_context_document(db_campaign, db)
    except Exception as e:
        # Log error but don't fail campaign creation
        print(f"Warning: Failed to create auto-context document: {e}")
    
    # Refresh to get the new document
    db.refresh(db_campaign)
    result = db_campaign.to_dict()
    result["documents"] = [d.to_dict() for d in db_campaign.documents]
    return result


@router.get("/{campaign_id}")
async def get_campaign(campaign_id: str, db: Session = Depends(get_db)):
    """Get campaign details with documents and variants."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    result = campaign.to_dict()
    result["documents"] = [d.to_dict() for d in campaign.documents]
    result["variants"] = [v.to_dict() for v in campaign.variants]
    return result


@router.put("/{campaign_id}")
async def update_campaign(
    campaign_id: str,
    campaign_update: CampaignUpdate,
    db: Session = Depends(get_db)
):
    """Update campaign details and regenerate context document."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    update_data = campaign_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(campaign, field, value)
    
    db.commit()
    db.refresh(campaign)
    
    # Regenerate campaign context document if any fields were updated
    if update_data:
        from app.models.document import Document
        from app.services.caching import invalidate
        
        # Delete existing campaign_context document
        existing_context = db.query(Document).filter(
            Document.campaign_id == campaign.id,
            Document.doc_type == "campaign_context"
        ).first()
        
        if existing_context:
            db.delete(existing_context)
            db.commit()
        
        # Create new context document
        try:
            await create_campaign_context_document(campaign, db)
            # Invalidate gap analysis cache since context changed
            invalidate(db, f"gap_analysis_{campaign.id}")
        except Exception as e:
            # Log error but don't fail the update
            print(f"Warning: Failed to regenerate context document: {e}")
    
    return campaign.to_dict()


@router.delete("/{campaign_id}")
async def delete_campaign(campaign_id: str, db: Session = Depends(get_db)):
    """Delete a campaign and all associated data."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    db.delete(campaign)
    db.commit()
    return {"status": "deleted"}


@router.post("/{campaign_id}/analyze-gaps")
async def analyze_campaign_gaps(
    campaign_id: str,
    force_refresh: bool = Query(False, description="Force refresh and bypass cache"),
    db: Session = Depends(get_db)
):
    """Analyze knowledge bank gaps for a campaign using Claude AI."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    try:
        result = await analyze_gaps(campaign, db, force_refresh=force_refresh)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gap analysis failed: {str(e)}")


@router.post("/{campaign_id}/research/pain-points")
async def research_campaign_pain_points(
    campaign_id: str,
    query: str = Query(..., description="Research query"),
    provider: str = Query(..., description="Research provider: 'gemini' or 'perplexity'"),
    db: Session = Depends(get_db)
):
    """Research pain points using Gemini or Perplexity."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    if provider not in ["gemini", "perplexity"]:
        raise HTTPException(
            status_code=400,
            detail="Provider must be 'gemini' or 'perplexity'"
        )
    
    try:
        result = await research_pain_points(campaign, query, provider, db)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Research failed: {str(e)}")


@router.post("/migrate-context")
async def migrate_context_documents(db: Session = Depends(get_db)):
    """
    Retroactive migration: Create context documents for existing campaigns
    that don't have one. Idempotent operation.
    """
    from app.models.document import Document
    
    # Find all campaigns
    campaigns = db.query(Campaign).all()
    migrated = []
    skipped = []
    errors = []
    
    for campaign in campaigns:
        # Check if campaign already has a campaign_context document
        existing = db.query(Document).filter(
            Document.campaign_id == campaign.id,
            Document.doc_type == "campaign_context"
        ).first()
        
        if existing:
            skipped.append(campaign.id)
            continue
        
        # Create context document
        try:
            await create_campaign_context_document(campaign, db)
            migrated.append(campaign.id)
        except Exception as e:
            errors.append({"campaign_id": campaign.id, "error": str(e)})
    
    return {
        "status": "completed",
        "migrated": len(migrated),
        "skipped": len(skipped),
        "errors": len(errors),
        "migrated_campaigns": migrated,
        "skipped_campaigns": skipped,
        "error_details": errors
    }
