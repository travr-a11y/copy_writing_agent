"""Document model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Document(Base):
    """Uploaded document with metadata for RAG."""
    
    __tablename__ = "documents"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    campaign_id = Column(String(36), ForeignKey("campaigns.id"), nullable=False)
    
    # File info
    filename = Column(String(255), nullable=False)
    file_path = Column(String(512), nullable=False)
    file_type = Column(String(50), nullable=False)  # csv, docx, txt, md
    
    # AI-suggested metadata
    doc_type = Column(String(50), nullable=True)  # company_voice, voice_of_customer, call_transcript, research, campaign_context
    channel = Column(String(50), nullable=True)  # email, linkedin, call
    industry = Column(String(100), nullable=True)
    role = Column(String(100), nullable=True)  # owner, director, head_of
    source_type = Column(String(50), nullable=True)  # internal, market_feedback
    additional_context = Column(Text, nullable=True)  # User-provided context for LLM
    
    # Processing status
    chunk_count = Column(Integer, default=0)
    processed = Column(Integer, default=0)  # 0=pending, 1=processed, -1=failed
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    campaign = relationship("Campaign", back_populates="documents")
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "campaign_id": self.campaign_id,
            "filename": self.filename,
            "file_path": self.file_path,
            "file_type": self.file_type,
            "doc_type": self.doc_type,
            "channel": self.channel,
            "industry": self.industry,
            "role": self.role,
            "source_type": self.source_type,
            "additional_context": self.additional_context,
            "chunk_count": self.chunk_count,
            "processed": self.processed,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
