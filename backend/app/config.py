"""Application configuration and settings."""
import os
from pathlib import Path
from functools import lru_cache
try:
    from pydantic_settings import BaseSettings
except ImportError:
    from pydantic import BaseSettings


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # API Keys
    anthropic_api_key: str
    gemini_api_key: str | None = None
    perplexity_api_key: str | None = None
    
    # Paths
    chroma_persist_path: str = "./data/chroma"
    database_url: str = "sqlite:///./data/copywrite.db"
    upload_dir: str = "./data/uploads"
    
    # Server (Railway uses PORT env var)
    backend_port: int = 8000
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    
    # LLM Settings
    claude_model: str = "claude-sonnet-4-20250514"  # Writing
    claude_opus_model: str = "claude-opus-4-20250514"  # Analytics (expensive)
    claude_gap_analysis_model: str = "claude-sonnet-4-20250514"  # Gap analysis (switchable for cost optimization)
    gemini_model: str = "gemini-2.0-flash"  # Research
    perplexity_model: str = "sonar-pro"  # Research
    max_tokens: int = 4096
    
    # QA Constraints
    lead_min_words: int = 30
    lead_max_words: int = 100
    followup_min_words: int = 30
    followup_max_words: int = 80
    target_readability_grade: float = 6.0
    max_commas_per_sentence: int = 1
    max_qa_retries: int = 3
    qa_fail_fast: bool = True  # If True, continue generating even if QA fails (don't block batch)
    
    # Generation Settings
    default_num_variants: int = 8
    chunk_size: int = 500
    chunk_overlap: int = 50
    
    # Embedding Model
    embedding_model: str = "all-MiniLM-L6-v2"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"  # Ignore extra env vars (e.g. Railway's PORT)


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Banned phrases for QA
BANNED_PHRASES = [
    "just following up",
    "checking in",
    "in case you got busy",
    "this might have got lost",
    "wanted to follow up",
    "bumping this",
    "moving this to the top",
    "quick follow up",
    "just a quick note",
    "just wanted to",
    "circling back",
    "touching base",
    "wanted to reach out",
    "hope this email finds you well",
    "per my last email",
    "as per our conversation",
    "following up on",
    "as I mentioned",
    "don't miss out",
    "act now",
    "limited time",
    "exclusive offer",
    "once in a lifetime",
    "amazing opportunity",
    "game changer",
    "revolutionary",
    "synergy",
    "leverage",
    "circle back",
    "low-hanging fruit",
    "move the needle",
    "paradigm shift",
]

# Americanism patterns to flag
AMERICANISM_PATTERNS = [
    r"\bawesome\b",
    r"\bsuper\b(?!\s+annoying)",  # "super" as intensifier
    r"\btotally\b",
    r"\bfor sure\b",
    r"\bno worries\b",  # Actually Australian, keep for now
    r"\btouch base\b",
    r"\breaching out\b",
    r"\bexcited to\b",
    r"\bthrilled to\b",
    r"\bpumped\b",
    r"\bstoked\b",
]

# Valid angles for variant generation
VARIANT_ANGLES = [
    "Curiosity",
    "Pain",
    "Value",
    "Authority",
    "Scarcity",
    "Social Proof",
    "Contrast",
    "Direct",
]
