"""Server-Sent Events endpoint for generation progress."""
import asyncio
import json
from typing import Optional, List, Callable, Awaitable
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.campaign import Campaign
from app.services.drafting import generate_variant_pairs
from app.config import get_settings, VARIANT_ANGLES

router = APIRouter()
settings = get_settings()


async def generate_with_progress(
    campaign_id: str,
    num_variants: int,
    angles: Optional[List[str]],
    db: Session,
    custom_instructions: Optional[str] = None,
    chunk_preference: Optional[str] = None
):
    """Generate variants with progress updates via SSE."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        yield f"data: {json.dumps({'stage': 'error', 'message': 'Campaign not found'})}\n\n"
        return
    
    # Validate research
    if not campaign.research_version:
        yield f"data: {json.dumps({'stage': 'error', 'message': 'ICP research required. Run research first.'})}\n\n"
        return
    
    if not campaign.voc_pain_themes or len(campaign.voc_pain_themes) == 0:
        yield f"data: {json.dumps({'stage': 'error', 'message': 'Pain Points research required. Run research first.'})}\n\n"
        return
    
    # Check for stale research
    if (campaign.docs_last_processed_at and campaign.last_research_at and 
        campaign.docs_last_processed_at > campaign.last_research_at):
        yield f"data: {json.dumps({'stage': 'error', 'message': 'New documents processed since last research. Refresh research first.'})}\n\n"
        return
    
    # Determine angles
    final_angles = angles or VARIANT_ANGLES[:num_variants]
    if len(final_angles) < num_variants:
        while len(final_angles) < num_variants:
            final_angles.extend(VARIANT_ANGLES)
        final_angles = final_angles[:num_variants]
    
    # Create a queue for progress messages
    progress_queue = asyncio.Queue()
    
    async def progress_handler(stage: str, current: int = None, total: int = None):
        await progress_queue.put((stage, current, total))
    
    try:
        # Start generation in background
        generation_task = asyncio.create_task(
            generate_variant_pairs(
                campaign,
                final_angles,
                db,
                parallel=True,
                custom_instructions=custom_instructions,
                chunk_preference=chunk_preference,
                progress_callback=progress_handler
            )
        )
        
        # Stream progress while generation runs
        while True:
            try:
                stage, current, total = await asyncio.wait_for(
                    progress_queue.get(), timeout=1.0
                )
                progress_data = {'stage': stage}
                if current is not None and total is not None:
                    progress_data['current'] = current
                    progress_data['total'] = total
                    progress_data['progress'] = int((current / total) * 100)
                yield f"data: {json.dumps(progress_data)}\n\n"
            except asyncio.TimeoutError:
                # Check if generation is done
                if generation_task.done():
                    break
                continue
        
        # Get result
        pairs = await generation_task
        
        # Final stage
        yield f"data: {json.dumps({'stage': 'Completed', 'current': len(final_angles), 'total': len(final_angles), 'progress': 100})}\n\n"
        yield f"data: {json.dumps({'stage': 'done', 'count': len(pairs)})}\n\n"
        
    except Exception as e:
        yield f"data: {json.dumps({'stage': 'error', 'message': str(e)})}\n\n"


@router.get("/campaigns/{campaign_id}/generate/stream")
async def stream_generation_progress(
    campaign_id: str,
    num_variants: Optional[int] = None,
    angles: Optional[str] = None,  # Comma-separated
    custom_instructions: Optional[str] = None,
    chunk_preference: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Stream generation progress via Server-Sent Events."""
    import json
    
    num_variants = num_variants or settings.default_num_variants
    angle_list = [a.strip() for a in angles.split(',')] if angles else None
    
    return StreamingResponse(
        generate_with_progress(
            campaign_id,
            num_variants,
            angle_list,
            db,
            custom_instructions,
            chunk_preference
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )
