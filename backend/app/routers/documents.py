"""Document upload and management endpoints."""
import os
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks, Response
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.config import get_settings
from app.models.document import Document
from app.models.campaign import Campaign
from app.services.tag_suggest import suggest_document_tags
from app.services.ingestion import process_document, read_file_content

router = APIRouter()
settings = get_settings()


class DocumentUpdate(BaseModel):
    """Request body for updating document metadata."""
    doc_type: Optional[str] = None
    channel: Optional[str] = None
    industry: Optional[str] = None
    role: Optional[str] = None
    source_type: Optional[str] = None
    additional_context: Optional[str] = None


class TagSuggestion(BaseModel):
    """AI-suggested tags for a document."""
    doc_type: str
    channel: Optional[str] = None
    industry: Optional[str] = None
    role: Optional[str] = None
    confidence: float
    reasoning: str = ""


@router.post("/campaigns/{campaign_id}/upload")
async def upload_document(
    campaign_id: str,
    file: UploadFile = File(...),
    doc_type: Optional[str] = Form(None),
    channel: Optional[str] = Form(None),
    industry: Optional[str] = Form(None),
    role: Optional[str] = Form(None),
    source_type: Optional[str] = Form(None),
    additional_context: Optional[str] = Form(None),
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
        source_type=source_type,
        additional_context=additional_context,
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


async def _process_document_background(document_id: str):
    """Background task to process a document."""
    from datetime import datetime
    from app.database import SessionLocal
    from app.services.caching import invalidate
    from app.models.campaign import Campaign

    db = SessionLocal()
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if not document:
            return

        try:
            chunk_count = await process_document(document, db)
            document.chunk_count = chunk_count
            document.processed = 1

            # Update campaign's docs_last_processed_at timestamp
            campaign = db.query(Campaign).filter(Campaign.id == document.campaign_id).first()
            if campaign:
                campaign.docs_last_processed_at = datetime.utcnow()

            db.commit()

            # Invalidate gap analysis cache for this campaign
            cache_key = f"gap_analysis_{document.campaign_id}"
            invalidate(db, cache_key)

        except Exception as e:
            document.processed = -1
            db.commit()
            print(f"Error processing document {document_id}: {e}")
    finally:
        db.close()


@router.post("/{document_id}/process")
async def process_doc(
    document_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    """Process document: parse, chunk, and embed into Chroma (now runs in background)."""

    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")

    # Mark as processing
    document.processed = 0
    db.commit()

    # Queue background processing (non-blocking)
    background_tasks.add_task(_process_document_background, document_id)
    return {"status": "processing", "document_id": document_id, "message": "Document queued for processing"}


@router.get("/{document_id}/content")
async def get_document_content(document_id: str, db: Session = Depends(get_db)):
    """Get document content as text."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="Document file not found")
    
    try:
        content = read_file_content(document.file_path, document.file_type)
        return {"content": content, "filename": document.filename, "file_type": document.file_type}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading document: {str(e)}")


@router.get("/{document_id}/download")
async def download_document(document_id: str, db: Session = Depends(get_db)):
    """Download document file."""
    document = db.query(Document).filter(Document.id == document_id).first()
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    
    if not os.path.exists(document.file_path):
        raise HTTPException(status_code=404, detail="Document file not found")
    
    return FileResponse(
        document.file_path,
        media_type="application/octet-stream",
        filename=document.filename
    )
