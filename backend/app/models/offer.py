"""Offer model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, JSON
from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Offer(Base):
    """Offer model for structured offer creation."""
    
    __tablename__ = "offers"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    campaign_id = Column(String(36), nullable=True)  # Optional - can be template
    name = Column(String(255), nullable=False)
    headline = Column(Text, nullable=False)
    subheadline = Column(Text, nullable=True)
    benefits = Column(JSON, nullable=False)  # List of benefit strings
    proof_points = Column(JSON, nullable=False)  # List of proof point strings
    cta = Column(Text, nullable=False)  # Call to action
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "campaign_id": self.campaign_id,
            "name": self.name,
            "headline": self.headline,
            "subheadline": self.subheadline,
            "benefits": self.benefits or [],
            "proof_points": self.proof_points or [],
            "cta": self.cta,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
