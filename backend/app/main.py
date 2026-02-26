"""FastAPI application entry point."""
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import init_db
from app.routers import campaigns, documents, generate, export


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    # Startup
    print("🚀 Starting AU Email Copy Drafting System...")
    init_db()
    print("✅ Database initialized")
    yield
    # Shutdown
    print("👋 Shutting down...")


app = FastAPI(
    title="AU Email Copy Drafting System",
    description="Generate AU-centric email copy variants with RAG and QA guardrails",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS: allow configured origins (comma-separated) or * for production
origins = [o.strip() for o in settings.cors_origins.split(",")] if settings.cors_origins else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["Campaigns"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(generate.router, prefix="/api", tags=["Generate"])
app.include_router(export.router, prefix="/api", tags=["Export"])

# Serve frontend static files in production (when frontend/dist exists)
_frontend_dist = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"
if _frontend_dist.exists():
    app.mount("/", StaticFiles(directory=str(_frontend_dist), html=True), name="frontend")


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "1.0.0"}


@app.get("/api/config/schema-version")
async def schema_version():
    """Get current schema version for Chroma compatibility."""
    return {"schema_version": 1, "csv_version": 1}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.backend_port,
        reload=True
    )
