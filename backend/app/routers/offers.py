"""Offer CRUD endpoints."""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.offer import Offer
from app.models.campaign import Campaign

router = APIRouter()


class OfferCreate(BaseModel):
    """Request body for creating an offer."""
    campaign_id: Optional[str] = None
    name: str
    headline: str
    subheadline: Optional[str] = None
    benefits: List[str] = []
    proof_points: List[str] = []
    cta: str


class OfferUpdate(BaseModel):
    """Request body for updating an offer."""
    name: Optional[str] = None
    headline: Optional[str] = None
    subheadline: Optional[str] = None
    benefits: Optional[List[str]] = None
    proof_points: Optional[List[str]] = None
    cta: Optional[str] = None


@router.get("")
async def list_offers(
    campaign_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all offers, optionally filtered by campaign."""
    query = db.query(Offer)
    if campaign_id:
        query = query.filter(Offer.campaign_id == campaign_id)
    offers = query.order_by(Offer.created_at.desc()).all()
    return [o.to_dict() for o in offers]


@router.get("/{offer_id}")
async def get_offer(offer_id: str, db: Session = Depends(get_db)):
    """Get a single offer."""
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return offer.to_dict()


@router.post("")
async def create_offer(offer: OfferCreate, db: Session = Depends(get_db)):
    """Create a new offer."""
    # Validate campaign exists if provided
    if offer.campaign_id:
        campaign = db.query(Campaign).filter(Campaign.id == offer.campaign_id).first()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
    
    db_offer = Offer(
        campaign_id=offer.campaign_id,
        name=offer.name,
        headline=offer.headline,
        subheadline=offer.subheadline,
        benefits=offer.benefits,
        proof_points=offer.proof_points,
        cta=offer.cta,
    )
    db.add(db_offer)
    db.commit()
    db.refresh(db_offer)
    return db_offer.to_dict()


@router.put("/{offer_id}")
async def update_offer(
    offer_id: str,
    offer_update: OfferUpdate,
    db: Session = Depends(get_db)
):
    """Update an offer."""
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    update_data = offer_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(offer, field, value)
    
    db.commit()
    db.refresh(offer)
    return offer.to_dict()


@router.delete("/{offer_id}")
async def delete_offer(offer_id: str, db: Session = Depends(get_db)):
    """Delete an offer."""
    offer = db.query(Offer).filter(Offer.id == offer_id).first()
    if not offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    db.delete(offer)
    db.commit()
    return {"status": "deleted"}
