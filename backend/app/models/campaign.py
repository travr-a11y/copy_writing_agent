"""Campaign model."""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, Integer, JSON
from sqlalchemy.orm import relationship
from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Campaign(Base):
    """Campaign model with structured fields + freeform brief."""
    
    __tablename__ = "campaigns"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    name = Column(String(255), nullable=False)
    
    # ─── BASICS ───
    industry = Column(String(255), nullable=True)  # Industry/vertical
    geography = Column(String(255), nullable=True, default="Australia")  # Target geography
    service_offering = Column(Text, nullable=True)  # Service/product being offered
    
    # ─── STRUCTURED ICP (9 sections) ───
    icp_firmographics = Column(JSON, nullable=True, default=dict)
    icp_technographics = Column(JSON, nullable=True, default=dict)
    icp_buyer_personas = Column(JSON, nullable=True, default=list)
    icp_psychographics = Column(JSON, nullable=True, default=dict)
    icp_triggers = Column(JSON, nullable=True, default=dict)
    icp_qualification = Column(JSON, nullable=True, default=dict)
    icp_buying_journey = Column(JSON, nullable=True, default=dict)
    icp_messaging_angles = Column(JSON, nullable=True, default=dict)
    icp_channels = Column(JSON, nullable=True, default=dict)
    
    # ─── VOC DATA ───
    voc_pain_themes = Column(JSON, nullable=True, default=list)
    voc_language_bank = Column(JSON, nullable=True, default=dict)
    voc_objections = Column(JSON, nullable=True, default=list)
    voc_implications = Column(JSON, nullable=True, default=dict)
    
    # ─── LEGACY/MERGED FIELDS ───
    icp = Column(Text, nullable=True)  # DEPRECATED - kept for migration
    pain_points = Column(Text, nullable=True)  # Merged from VOC + manual
    offer = Column(Text, nullable=True)  # What you're offering
    brief = Column(Text, nullable=True)  # Optional additional context/notes
    
    # ─── RESEARCH MANAGEMENT ───
    additional_learnings = Column(Text, nullable=True, default="")  # Market feedback for refinement
    research_version = Column(Integer, nullable=True, default=None)  # Current research version
    research_history = Column(JSON, nullable=True, default=list)  # List of {version, timestamp, summary}
    last_research_at = Column(DateTime, nullable=True)  # When agents last ran
    docs_last_processed_at = Column(DateTime, nullable=True)  # When documents were last processed
    research_skipped = Column(String(10), nullable=True, default="false")  # "true" if user skipped research
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    documents = relationship("Document", back_populates="campaign", cascade="all, delete-orphan")
    variants = relationship("Variant", back_populates="campaign", cascade="all, delete-orphan")
    
    def to_dict(self, include_counts: bool = False):
        """Convert to dictionary."""
        result = {
            "id": self.id,
            "name": self.name,
            # Basics
            "industry": self.industry,
            "geography": self.geography,
            "service_offering": self.service_offering,
            # Structured ICP
            "icp_firmographics": self.icp_firmographics or {},
            "icp_technographics": self.icp_technographics or {},
            "icp_buyer_personas": self.icp_buyer_personas or [],
            "icp_psychographics": self.icp_psychographics or {},
            "icp_triggers": self.icp_triggers or {},
            "icp_qualification": self.icp_qualification or {},
            "icp_buying_journey": self.icp_buying_journey or {},
            "icp_messaging_angles": self.icp_messaging_angles or {},
            "icp_channels": self.icp_channels or {},
            # VOC
            "voc_pain_themes": self.voc_pain_themes or [],
            "voc_language_bank": self.voc_language_bank or {},
            "voc_objections": self.voc_objections or [],
            "voc_implications": self.voc_implications or {},
            # Legacy fields
            "icp": self.icp,
            "pain_points": self.pain_points,
            "offer": self.offer,
            "brief": self.brief,
            # Research management
            "additional_learnings": self.additional_learnings or "",
            "research_version": self.research_version,
            "research_history": self.research_history or [],
            "last_research_at": self.last_research_at.isoformat() if self.last_research_at else None,
            "docs_last_processed_at": self.docs_last_processed_at.isoformat() if self.docs_last_processed_at else None,
            "research_skipped": self.research_skipped == "true",
            # Timestamps
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        
        if include_counts:
            result["document_count"] = len(self.documents) if self.documents else 0
            result["variant_count"] = len(self.variants) if self.variants else 0
        
        return result
