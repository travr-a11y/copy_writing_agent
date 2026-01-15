"""Caching service for analysis results."""
import json
from datetime import datetime, timedelta
from typing import Optional, Any, Dict
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.cache import Cache


def get_cached(db: Session, cache_key: str) -> Optional[Dict[str, Any]]:
    """
    Get cached data if it exists and is not expired.
    
    Returns:
        Cached data as dict, or None if not found/expired
    """
    cache_entry = db.query(Cache).filter(
        Cache.cache_key == cache_key
    ).first()
    
    if not cache_entry:
        return None
    
    if cache_entry.is_expired():
        # Delete expired entry
        db.delete(cache_entry)
        db.commit()
        return None
    
    try:
        return json.loads(cache_entry.data)
    except (json.JSONDecodeError, TypeError):
        # Invalid JSON, delete entry
        db.delete(cache_entry)
        db.commit()
        return None


def set_cached(
    db: Session,
    cache_key: str,
    data: Dict[str, Any],
    ttl_hours: int = 24
) -> Cache:
    """
    Store data in cache with TTL.
    
    Args:
        db: Database session
        cache_key: Unique cache key
        data: Data to cache (will be JSON serialized)
        ttl_hours: Time to live in hours (default: 24)
    
    Returns:
        Created cache entry
    """
    # Delete existing entry if it exists
    existing = db.query(Cache).filter(Cache.cache_key == cache_key).first()
    if existing:
        db.delete(existing)
    
    # Create new entry
    expires_at = datetime.utcnow() + timedelta(hours=ttl_hours)
    cache_entry = Cache(
        cache_key=cache_key,
        data=json.dumps(data),
        expires_at=expires_at
    )
    
    db.add(cache_entry)
    db.commit()
    db.refresh(cache_entry)
    
    return cache_entry


def invalidate(db: Session, cache_key: str) -> bool:
    """
    Invalidate (delete) a cache entry.
    
    Returns:
        True if entry was deleted, False if not found
    """
    cache_entry = db.query(Cache).filter(Cache.cache_key == cache_key).first()
    if cache_entry:
        db.delete(cache_entry)
        db.commit()
        return True
    return False


def invalidate_pattern(db: Session, pattern: str) -> int:
    """
    Invalidate all cache entries matching a pattern (e.g., 'gap_analysis_*').
    
    Returns:
        Number of entries deleted
    """
    # SQLite doesn't support LIKE with wildcards easily, so we'll use contains
    # For more complex patterns, we'd need to fetch all and filter
    cache_entries = db.query(Cache).filter(
        Cache.cache_key.like(pattern.replace('*', '%'))
    ).all()
    
    count = len(cache_entries)
    for entry in cache_entries:
        db.delete(entry)
    
    if count > 0:
        db.commit()
    
    return count


def cleanup_expired(db: Session) -> int:
    """
    Clean up all expired cache entries.
    
    Returns:
        Number of entries deleted
    """
    now = datetime.utcnow()
    expired = db.query(Cache).filter(Cache.expires_at < now).all()
    
    count = len(expired)
    for entry in expired:
        db.delete(entry)
    
    if count > 0:
        db.commit()
    
    return count
