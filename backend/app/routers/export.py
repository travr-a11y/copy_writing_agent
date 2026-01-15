"""CSV export endpoints."""
import csv
import io
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.campaign import Campaign
from app.models.variant import Variant

router = APIRouter()

# Stable CSV column order - DO NOT CHANGE ORDER
CSV_COLUMNS = [
    "campaign_id",
    "campaign_name",
    "variant_id",
    "lead_variant_id",
    "touch",
    "chunk",
    "angle",
    "subject",
    "body",
    "thesis",
    "starred",
    "word_count",
    "readability_grade",
    "qa_pass",
    "qa_notes",
    "created_at",
    "updated_at",
]


def generate_csv(variants: List[Variant], campaign_names: dict) -> str:
    """Generate CSV content from variants."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_COLUMNS)
    writer.writeheader()
    
    for variant in variants:
        campaign_name = campaign_names.get(variant.campaign_id, "Unknown")
        row = variant.to_csv_row(campaign_name)
        writer.writerow(row)
    
    return output.getvalue()


@router.get("/campaigns/{campaign_id}/export/csv")
async def export_campaign_csv(
    campaign_id: str,
    touch: Optional[str] = None,
    chunk: Optional[str] = None,
    qa_pass: Optional[bool] = None,
    starred: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Export campaign variants to CSV."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    query = db.query(Variant).filter(Variant.campaign_id == campaign_id)
    
    if touch:
        query = query.filter(Variant.touch == touch)
    if chunk:
        query = query.filter(Variant.chunk == chunk)
    if qa_pass is not None:
        query = query.filter(Variant.qa_pass == qa_pass)
    if starred is not None:
        query = query.filter(Variant.starred == starred)
    
    variants = query.order_by(Variant.created_at).all()
    
    if not variants:
        raise HTTPException(status_code=404, detail="No variants found")
    
    csv_content = generate_csv(variants, {campaign.id: campaign.name})
    
    # Safe filename
    safe_name = "".join(c for c in campaign.name if c.isalnum() or c in " -_").strip()
    filename = f"{safe_name}_variants.csv"
    
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@router.get("/export/csv")
async def export_bulk_csv(
    campaign_ids: str,  # Comma-separated UUIDs
    touch: Optional[str] = None,
    chunk: Optional[str] = None,
    qa_pass: Optional[bool] = None,
    starred: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Export variants from multiple campaigns to CSV."""
    ids = [id.strip() for id in campaign_ids.split(",") if id.strip()]
    
    if not ids:
        raise HTTPException(status_code=400, detail="No campaign IDs provided")
    
    # Get campaigns
    campaigns = db.query(Campaign).filter(Campaign.id.in_(ids)).all()
    if not campaigns:
        raise HTTPException(status_code=404, detail="No campaigns found")
    
    campaign_names = {c.id: c.name for c in campaigns}
    
    # Get variants
    query = db.query(Variant).filter(Variant.campaign_id.in_(ids))
    
    if touch:
        query = query.filter(Variant.touch == touch)
    if chunk:
        query = query.filter(Variant.chunk == chunk)
    if qa_pass is not None:
        query = query.filter(Variant.qa_pass == qa_pass)
    if starred is not None:
        query = query.filter(Variant.starred == starred)
    
    variants = query.order_by(Variant.campaign_id, Variant.created_at).all()
    
    if not variants:
        raise HTTPException(status_code=404, detail="No variants found")
    
    csv_content = generate_csv(variants, campaign_names)
    
    return StreamingResponse(
        iter([csv_content]),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="variants_export.csv"'}
    )
