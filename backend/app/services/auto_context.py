"""Auto-create campaign context document from questionnaire data."""
import os
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.campaign import Campaign
from app.models.document import Document
from app.services.ingestion import process_document
import uuid

settings = get_settings()


async def create_campaign_context_document(campaign: Campaign, db: Session) -> Document:
    """
    Create a campaign context document from campaign questionnaire data.
    This document is automatically created and processed when a campaign is created.
    """
    # Build structured document content
    content_parts = [
        f"CAMPAIGN: {campaign.name}",
        "",
        "=" * 60,
        "IDEAL CUSTOMER PROFILE (ICP)",
        "=" * 60,
        campaign.icp,
        "",
        "=" * 60,
        "PAIN POINTS",
        "=" * 60,
        campaign.pain_points,
        "",
        "=" * 60,
        "OFFER",
        "=" * 60,
        campaign.offer,
    ]
    
    if campaign.brief:
        content_parts.extend([
            "",
            "=" * 60,
            "ADDITIONAL CONTEXT / BRIEF",
            "=" * 60,
            campaign.brief,
        ])
    
    content = "\n".join(content_parts)
    
    # Create a temporary file to store the content
    file_id = str(uuid.uuid4())
    filename = f"campaign_context_{campaign.id[:8]}.txt"
    file_path = os.path.join(settings.upload_dir, f"{file_id}.txt")
    
    # Ensure upload directory exists
    os.makedirs(settings.upload_dir, exist_ok=True)
    
    # Write content to file
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    
    # Create document record
    document = Document(
        campaign_id=campaign.id,
        filename=filename,
        file_path=file_path,
        file_type="txt",
        doc_type="campaign_context",
        channel=None,
        industry=None,
        role=None,
        processed=0,  # Will be set to 1 after processing
        chunk_count=0,
    )
    
    db.add(document)
    db.flush()  # Get document ID
    
    # Process document: chunk and embed
    try:
        chunk_count = await process_document(document, db)
        document.chunk_count = chunk_count
        document.processed = 1
        db.commit()
    except Exception as e:
        # If processing fails, mark as failed but don't raise
        document.processed = -1
        db.commit()
        print(f"Warning: Failed to process auto-context document for campaign {campaign.id}: {e}")
    
    return document
