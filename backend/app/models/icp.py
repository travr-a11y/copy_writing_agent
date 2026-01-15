"""ICP (Ideal Customer Profile) model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, JSON
from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class ICP(Base):
    """ICP model for structured customer profile creation."""
    
    __tablename__ = "icps"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    campaign_id = Column(String(36), nullable=True)  # Optional - can be template
    name = Column(String(255), nullable=False)
    demographics = Column(JSON, nullable=False)  # Demographics data
    firmographics = Column(JSON, nullable=False)  # Firmographics data
    psychographics = Column(JSON, nullable=False)  # Psychographics data
    pain_points = Column(JSON, nullable=False)  # List of pain points
    goals = Column(JSON, nullable=False)  # List of goals
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "campaign_id": self.campaign_id,
            "name": self.name,
            "demographics": self.demographics or {},
            "firmographics": self.firmographics or {},
            "psychographics": self.psychographics or {},
            "pain_points": self.pain_points or [],
            "goals": self.goals or [],
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
