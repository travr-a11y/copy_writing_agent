"""Variant model - matches CSV export schema."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Variant(Base):
    """
    Email variant model.
    
    CSV Export Schema (stable column names):
    - campaign_id, campaign_name, variant_id, lead_variant_id
    - touch, chunk, angle, subject, body
    - word_count, readability_grade, qa_pass, qa_notes
    - created_at, updated_at
    """
    
    __tablename__ = "variants"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    campaign_id = Column(String(36), ForeignKey("campaigns.id"), nullable=False)
    
    # For follow-ups: links to the parent lead variant
    lead_variant_id = Column(String(36), ForeignKey("variants.id"), nullable=True)
    
    # Variant classification
    touch = Column(String(20), nullable=False)  # 'lead' or 'followup'
    chunk = Column(String(20), nullable=False, default="base")  # 'base', 'up', 'down'
    angle = Column(String(50), nullable=False)  # curiosity, pain, outcome, proof, etc.
    
    # Content
    subject = Column(String(255), nullable=True, default="")  # Blank for MVP
    body = Column(Text, nullable=False)
    thesis = Column(Text, nullable=True)  # Testing hypothesis: "[Angle] | [Offer aspect]"
    
    # QA metrics
    word_count = Column(Integer, nullable=False)
    readability_grade = Column(Float, nullable=False)
    qa_pass = Column(Boolean, nullable=False, default=False)
    qa_notes = Column(Text, nullable=True)
    
    # User preferences
    starred = Column(Boolean, nullable=False, default=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    campaign = relationship("Campaign", back_populates="variants")
    followups = relationship(
        "Variant",
        backref="lead_variant",
        remote_side=[id],
        foreign_keys=[lead_variant_id]
    )
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "campaign_id": self.campaign_id,
            "lead_variant_id": self.lead_variant_id,
            "touch": self.touch,
            "chunk": self.chunk,
            "angle": self.angle,
            "subject": self.subject,
            "body": self.body,
            "thesis": self.thesis,
            "starred": self.starred,
            "word_count": self.word_count,
            "readability_grade": self.readability_grade,
            "qa_pass": self.qa_pass,
            "qa_notes": self.qa_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
    
    def to_csv_row(self, campaign_name: str) -> dict:
        """Convert to CSV export row with stable column names."""
        return {
            "campaign_id": self.campaign_id,
            "campaign_name": campaign_name,
            "variant_id": self.id,
            "lead_variant_id": self.lead_variant_id or "",
            "touch": self.touch,
            "chunk": self.chunk,
            "angle": self.angle,
            "subject": self.subject or "",
            "body": self.body,
            "thesis": self.thesis or "",
            "starred": self.starred,
            "word_count": self.word_count,
            "readability_grade": round(self.readability_grade, 1),
            "qa_pass": self.qa_pass,
            "qa_notes": self.qa_notes or "",
            "created_at": self.created_at.isoformat() if self.created_at else "",
            "updated_at": self.updated_at.isoformat() if self.updated_at else "",
        }
