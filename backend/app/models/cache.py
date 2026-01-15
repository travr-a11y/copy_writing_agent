"""Cache model for storing analysis results."""
import uuid
import json
from datetime import datetime, timedelta
from sqlalchemy import Column, String, Text, DateTime
from app.database import Base


def generate_uuid():
    return str(uuid.uuid4())


class Cache(Base):
    """Cache table for storing analysis results with TTL."""
    
    __tablename__ = "cache"
    
    id = Column(String(36), primary_key=True, default=generate_uuid)
    cache_key = Column(String(255), nullable=False, unique=True, index=True)
    data = Column(Text, nullable=False)  # JSON string
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    
    def to_dict(self):
        """Convert to dictionary."""
        return {
            "id": self.id,
            "cache_key": self.cache_key,
            "data": json.loads(self.data) if self.data else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
        }
    
    def is_expired(self) -> bool:
        """Check if cache entry is expired."""
        if not self.expires_at:
            return True
        return datetime.utcnow() > self.expires_at
