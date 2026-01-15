"""Document upload and management endpoints."""
import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.config import get_settings
from app.models.document import Document
from app.models.campaign import Campaign
from app.services.tag_suggest import suggest_document_tags
from app.services.ingestion import process_document

router = APIRouter()
settings = get_settings()


class DocumentUpdate(BaseModel):
    """Request body for updating document metadata."""
    doc_type: Optional[str] = None
    channel: Optional[str] = None
    industry: Optional[str] = None
    role: Optional[str] = None


class TagSuggestion(BaseModel):
    """AI-suggested tags for a document."""
    doc_type: str
    channel: Optional[str] = None
    industry: Optional[str] = None
    role: Optional[str] = None
    confidence: float


@router.post("/campaigns/{campaign_id}/upload")
async def upload_document(
    campaign_id: str,
    file: UploadFile = File(...),
    doc_type: Optional[str] = Form(None),
    channel: Optional[str] = Form(None),
    industry: Optional[str] = Form(None),
    role: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    """Upload a document to a campaign."""
    # Verify campaign exists
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    # Validate file type
    allowed_types = {".csv", ".docx", ".txt", ".md"}
    file_ext = os.path.splitext(file.filename)[1].lower()
    if file_ext not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file type. Allowed: {', '.join(allowed_types)}"
        )
    
    # Check for duplicate filename in the same campaign
    existing_doc = db.query(Document).filter(
        Document.campaign_id == campaign_id,
        Document.filename == file.filename
    ).first()
    
    if existing_doc:
        raise HTTPException(
            status_code=400,
            detail=f"Document with filename '{file.filename}' already exists in this campaign"
        )
    
    # Save file
    file_id = str(uuid.uuid4())
    file_path = os.path.join(settings.upload_dir, f"{file_id}{file_ext}")
    
    os.makedirs(settings.upload_dir, exist_ok=True)
    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)
    
    # Create document record
    document = Document(
        campaign_id=campaign_id,
        filename=file.filename,
        file_path=file_path,
        file_type=file_ext[1:],  # Remove leading dot
        doc_type=doc_type,
        channel=channel,
        industry=industry,
        role=role,
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    
    # Invalidate gap analysis cache for this campaign
    from app.services.caching import invalidate
    cache_key = f"gap_analysis_{campaign_id}"
    invalidate(db, cache_key)
    
    return document.to_dict()


@router.get("/{document_id}")
async def get_document(document_id: str, db: Session = Depends(get_db)):
    """Get document details."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document.to_dict()


@router.put("/{document_id}")
async def update_document(
    document_id: str,
    update: DocumentUpdate,
    db: Session = Depends(get_db)
):
    """Update document metadata."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(document, field, value)
    
    db.commit()
    db.refresh(document)
    return document.to_dict()


@router.delete("/{document_id}")
async def delete_document(document_id: str, db: Session = Depends(get_db)):
    """Delete a document."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Delete file if exists
    if os.path.exists(document.file_path):
        os.remove(document.file_path)
    
    db.delete(document)
    db.commit()
    return {"status": "deleted"}


@router.post("/{document_id}/suggest-tags")
async def suggest_tags(document_id: str, db: Session = Depends(get_db)):
    """Use AI to suggest metadata tags for a document."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    # Get suggestions from Claude
    suggestions = await suggest_document_tags(document.file_path, document.file_type)
    
    return suggestions


@router.post("/{document_id}/process")
async def process_doc(document_id: str, db: Session = Depends(get_db)):
    """Process document: parse, chunk, and embed into Chroma."""
    from app.services.caching import invalidate
    
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    try:
        chunk_count = await process_document(document, db)
        document.chunk_count = chunk_count
        document.processed = 1
        db.commit()
        db.refresh(document)
        
        # Invalidate gap analysis cache for this campaign
        cache_key = f"gap_analysis_{document.campaign_id}"
        invalidate(db, cache_key)
        
        return {"status": "processed", "chunk_count": chunk_count}
    except Exception as e:
        document.processed = -1
        db.commit()
        raise HTTPException(status_code=500, detail=str(e))
