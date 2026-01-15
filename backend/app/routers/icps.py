"""ICP CRUD endpoints."""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.icp import ICP
from app.models.campaign import Campaign

router = APIRouter()


class ICPCreate(BaseModel):
    """Request body for creating an ICP."""
    campaign_id: Optional[str] = None
    name: str
    demographics: dict = {}
    firmographics: dict = {}
    psychographics: dict = {}
    pain_points: List[str] = []
    goals: List[str] = []


class ICPUpdate(BaseModel):
    """Request body for updating an ICP."""
    name: Optional[str] = None
    demographics: Optional[dict] = None
    firmographics: Optional[dict] = None
    psychographics: Optional[dict] = None
    pain_points: Optional[List[str]] = None
    goals: Optional[List[str]] = None


@router.get("")
async def list_icps(
    campaign_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """List all ICPs, optionally filtered by campaign."""
    query = db.query(ICP)
    if campaign_id:
        query = query.filter(ICP.campaign_id == campaign_id)
    icps = query.order_by(ICP.created_at.desc()).all()
    return [i.to_dict() for i in icps]


@router.get("/{icp_id}")
async def get_icp(icp_id: str, db: Session = Depends(get_db)):
    """Get a single ICP."""
    icp = db.query(ICP).filter(ICP.id == icp_id).first()
    if not icp:
        raise HTTPException(status_code=404, detail="ICP not found")
    return icp.to_dict()


@router.post("")
async def create_icp(icp: ICPCreate, db: Session = Depends(get_db)):
    """Create a new ICP."""
    # Validate campaign exists if provided
    if icp.campaign_id:
        campaign = db.query(Campaign).filter(Campaign.id == icp.campaign_id).first()
        if not campaign:
            raise HTTPException(status_code=404, detail="Campaign not found")
    
    db_icp = ICP(
        campaign_id=icp.campaign_id,
        name=icp.name,
        demographics=icp.demographics,
        firmographics=icp.firmographics,
        psychographics=icp.psychographics,
        pain_points=icp.pain_points,
        goals=icp.goals,
    )
    db.add(db_icp)
    db.commit()
    db.refresh(db_icp)
    return db_icp.to_dict()


@router.put("/{icp_id}")
async def update_icp(
    icp_id: str,
    icp_update: ICPUpdate,
    db: Session = Depends(get_db)
):
    """Update an ICP."""
    icp = db.query(ICP).filter(ICP.id == icp_id).first()
    if not icp:
        raise HTTPException(status_code=404, detail="ICP not found")
    
    update_data = icp_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(icp, field, value)
    
    db.commit()
    db.refresh(icp)
    return icp.to_dict()


@router.delete("/{icp_id}")
async def delete_icp(icp_id: str, db: Session = Depends(get_db)):
    """Delete an ICP."""
    icp = db.query(ICP).filter(ICP.id == icp_id).first()
    if not icp:
        raise HTTPException(status_code=404, detail="ICP not found")
    
    db.delete(icp)
    db.commit()
    return {"status": "deleted"}
