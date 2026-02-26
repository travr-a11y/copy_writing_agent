"""FastAPI application entry point."""
import os
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager

from app.config import get_settings
from app.database import init_db
from app.routers import campaigns, documents, generate, export


settings = get_settings()

FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    print("Starting AU Email Copy Drafting System...")
    init_db()
    print("Database initialized")
    yield
    print("Shutting down...")


app = FastAPI(
    title="AU Email Copy Drafting System",
    description="Generate AU-centric email copy variants with RAG and QA guardrails",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        os.getenv("RAILWAY_PUBLIC_DOMAIN", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(campaigns.router, prefix="/api/campaigns", tags=["Campaigns"])
app.include_router(documents.router, prefix="/api/documents", tags=["Documents"])
app.include_router(generate.router, prefix="/api", tags=["Generate"])
app.include_router(export.router, prefix="/api", tags=["Export"])


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "version": "1.0.0"}


@app.get("/api/config/schema-version")
async def schema_version():
    """Get current schema version for Chroma compatibility."""
    return {"schema_version": 1, "csv_version": 1}


# Serve frontend static files in production
if FRONTEND_DIR.exists():
    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="static")

    @app.get("/{full_path:path}")
    async def serve_spa(request: Request, full_path: str):
        """Serve the SPA index.html for all non-API routes."""
        file_path = FRONTEND_DIR / full_path
        if file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIR / "index.html"))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=settings.backend_port,
        reload=True
    )
