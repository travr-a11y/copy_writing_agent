"""Campaign model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime
from sqlalchemy.orm import relationship
from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Campaign(Base):
    """Campaign model with structured fields + freeform brief."""
    
    __tablename__ = "campaigns"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    
    # Structured fields
    icp = Column(Text, nullable=False)  # Ideal Customer Profile
    pain_points = Column(Text, nullable=False)  # Key pain points to address
    offer = Column(Text, nullable=False)  # What you're offering
    
    # Freeform
    brief = Column(Text, nullable=True)  # Optional additional context/notes
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    documents = relationship("Document", back_populates="campaign", cascade="all, delete-orphan")
    variants = relationship("Variant", back_populates="campaign", cascade="all, delete-orphan")
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "icp": self.icp,
            "pain_points": self.pain_points,
            "offer": self.offer,
            "brief": self.brief,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
