"""Campaign CRUD endpoints."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.campaign import Campaign
from app.services.auto_context import create_campaign_context_document
from app.services.gap_analysis import analyze_gaps
from app.services.research import research_pain_points, run_icp_agent, run_voice_agent, refine_research, calculate_diff


router = APIRouter()


class CampaignCreate(BaseModel):
    """Request body for creating a campaign."""
    name: str
    industry: Optional[str] = None
    geography: Optional[str] = None
    service_offering: Optional[str] = None
    icp: Optional[str] = None
    pain_points: Optional[str] = None
    offer: Optional[str] = None
    brief: Optional[str] = None


class CampaignUpdate(BaseModel):
    """Request body for updating a campaign."""
    name: Optional[str] = None
    industry: Optional[str] = None
    geography: Optional[str] = None
    service_offering: Optional[str] = None
    icp: Optional[str] = None
    pain_points: Optional[str] = None
    offer: Optional[str] = None
    brief: Optional[str] = None


class VOCResearchRequest(BaseModel):
    """Request body for VOC research."""
    icp_summary: str
    competitors: str = ""
    platforms_priority: str = ""
    additional_context: str = ""


@router.get("")
async def list_campaigns(db: Session = Depends(get_db)):
    """List all campaigns with eager loading to avoid N+1 queries."""
    from sqlalchemy.orm import joinedload

    campaigns = (
        db.query(Campaign)
        .options(joinedload(Campaign.documents))
        .options(joinedload(Campaign.variants))
        .order_by(Campaign.created_at.desc())
        .all()
    )
    return [c.to_dict(include_counts=True) for c in campaigns]


@router.post("")
async def create_campaign(campaign: CampaignCreate, db: Session = Depends(get_db)):
    """Create a new campaign and auto-create context document."""
    db_campaign = Campaign(
        name=campaign.name,
        industry=campaign.industry,
        geography=campaign.geography,
        service_offering=campaign.service_offering,
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
    from sqlalchemy.orm import joinedload
    from app.models.variant import Variant
    
    campaign = db.query(Campaign).options(
        joinedload(Campaign.documents)
    ).filter(Campaign.id == campaign_id).first()
    
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Query variants separately to ensure we get the latest ones
    variants = db.query(Variant).filter(Variant.campaign_id == campaign_id).all()
    
    result = campaign.to_dict()
    result["documents"] = [d.to_dict() for d in campaign.documents]
    result["variants"] = [v.to_dict() for v in variants]
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

    # Only regenerate campaign context if CONTENT fields changed (not just name/metadata)
    content_fields = {'industry', 'geography', 'service_offering', 'icp', 'pain_points', 'offer', 'brief'}
    if update_data.keys() & content_fields:  # Intersection - any content field changed?
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


@router.post("/{campaign_id}/research/icp")
async def research_campaign_icp(
    campaign_id: str,
    industry: str = Query(..., description="Target industry/vertical"),
    geography: str = Query("Australia", description="Target geography"),
    service_offering: str = Query("", description="Service/product being offered"),
    additional_context: str = Query("", description="Additional context or learnings"),
    db: Session = Depends(get_db)
):
    """Run ICP Definition Agent to generate structured ICP."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    try:
        result = await run_icp_agent(
            campaign=campaign,
            industry=industry,
            db=db,
            geography=geography,
            service_offering=service_offering,
            additional_context=additional_context
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"ICP research failed: {str(e)}")


@router.post("/{campaign_id}/research/voice")
async def research_campaign_voice(
    campaign_id: str,
    request: VOCResearchRequest,
    db: Session = Depends(get_db)
):
    """Run Audience Voice Research Agent to extract VOC data."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    competitors_list = [c.strip() for c in request.competitors.split(",") if c.strip()] if request.competitors else None
    platforms_list = [p.strip() for p in request.platforms_priority.split(",") if p.strip()] if request.platforms_priority else None
    
    try:
        result = await run_voice_agent(
            campaign=campaign,
            icp_summary=request.icp_summary,
            db=db,
            competitors=competitors_list,
            platforms_priority=platforms_list,
            additional_context=request.additional_context
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"VOC research failed: {str(e)}")


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


@router.post("/{campaign_id}/research/full")
async def research_campaign_full(
    campaign_id: str,
    industry: str = Query(..., description="Target industry/vertical"),
    geography: str = Query("Australia", description="Target geography"),
    service_offering: str = Query("", description="Service/product being offered"),
    additional_context: str = Query("", description="Additional context or learnings"),
    competitors: str = Query("", description="Comma-separated list of competitors"),
    platforms_priority: str = Query("", description="Comma-separated list of platforms to prioritize"),
    db: Session = Depends(get_db)
):
    """Run full research: ICP first, then auto-chain VOC research using ICP context."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    try:
        # Step 1: Run ICP research first
        icp_result = await run_icp_agent(
            campaign=campaign,
            industry=industry,
            db=db,
            geography=geography,
            service_offering=service_offering,
            additional_context=additional_context
        )
        
        # Step 2: Build ICP summary from the structured data for VOC context
        icp_summary_parts = []
        if campaign.industry:
            icp_summary_parts.append(f"Industry: {campaign.industry}")
        if campaign.geography:
            icp_summary_parts.append(f"Geography: {campaign.geography}")
        if campaign.icp_firmographics:
            firmo = campaign.icp_firmographics
            if isinstance(firmo, dict):
                if firmo.get("industry"):
                    icp_summary_parts.append(firmo["industry"])
                if firmo.get("sub_sector"):
                    icp_summary_parts.append(firmo["sub_sector"])
                if firmo.get("employee_range"):
                    icp_summary_parts.append(f"{firmo['employee_range']} employees")
        
        icp_summary = " ".join(icp_summary_parts) if icp_summary_parts else campaign.icp or f"{industry} companies in {geography}"
        
        # Step 3: Auto-run VOC research with ICP context
        competitors_list = [c.strip() for c in competitors.split(",") if c.strip()] if competitors else None
        platforms_list = [p.strip() for p in platforms_priority.split(",") if p.strip()] if platforms_priority else None
        
        voc_result = await run_voice_agent(
            campaign=campaign,
            icp_summary=icp_summary,
            db=db,
            competitors=competitors_list,
            platforms_priority=platforms_list,
            additional_context=additional_context
        )
        
        return {
            "success": True,
            "icp": icp_result,
            "voc": voc_result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Full research failed: {str(e)}")


@router.post("/{campaign_id}/research/refine")
async def refine_campaign_research(
    campaign_id: str,
    additional_learnings: str = Query(..., description="Market feedback or learnings"),
    refine_icp: bool = Query(True, description="Refine ICP"),
    refine_voc: bool = Query(True, description="Refine VOC"),
    db: Session = Depends(get_db)
):
    """Re-run research agents with additional learnings to refine ICP/VOC."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    try:
        result = await refine_research(
            campaign=campaign,
            additional_learnings=additional_learnings,
            db=db,
            refine_icp=refine_icp,
            refine_voc=refine_voc
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Research refinement failed: {str(e)}")


@router.get("/{campaign_id}/research/history")
async def get_research_history(
    campaign_id: str,
    db: Session = Depends(get_db)
):
    """Get research version history for a campaign."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    return {
        "campaign_id": campaign_id,
        "current_version": campaign.research_version,
        "history": campaign.research_history or [],
        "last_research_at": campaign.last_research_at.isoformat() if campaign.last_research_at else None
    }


@router.get("/{campaign_id}/research/diff")
async def get_research_diff(
    campaign_id: str,
    v1: int = Query(..., description="Version 1"),
    v2: int = Query(..., description="Version 2"),
    db: Session = Depends(get_db)
):
    """Get diff between two research versions."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # For now, we compare current state with previous state
    # In a full implementation, we'd store snapshots of each version
    # For MVP, we'll return a simplified diff based on history entries
    
    history = campaign.research_history or []
    v1_entry = next((h for h in history if h.get("version") == v1), None)
    v2_entry = next((h for h in history if h.get("version") == v2), None)
    
    if not v1_entry or not v2_entry:
        raise HTTPException(status_code=404, detail="Version not found in history")
    
    # Get current state (which represents v2)
    current_icp = {
        "firmographics": campaign.icp_firmographics or {},
        "technographics": campaign.icp_technographics or {},
        "buyer_personas": campaign.icp_buyer_personas or [],
        "psychographics": campaign.icp_psychographics or {},
        "triggers": campaign.icp_triggers or {},
        "qualification": campaign.icp_qualification or {},
        "buying_journey": campaign.icp_buying_journey or {},
        "messaging_angles": campaign.icp_messaging_angles or {},
        "channels": campaign.icp_channels or {},
    }
    
    current_voc = {
        "pain_themes": campaign.voc_pain_themes or [],
        "language_bank": campaign.voc_language_bank or {},
        "objections": campaign.voc_objections or [],
        "implications": campaign.voc_implications or {},
    }
    
    # For v1, we'd need to reconstruct from history or stored snapshots
    # For MVP, return summary based on history entries
    return {
        "v1": v1_entry,
        "v2": v2_entry,
        "summary": f"Comparison between version {v1} and {v2}",
        "note": "Full diff requires version snapshots (to be implemented)"
    }


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
