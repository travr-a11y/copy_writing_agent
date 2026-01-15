"""Gap analysis service using Claude to identify knowledge bank gaps."""
import json
from datetime import datetime
from typing import List, Dict, Any
from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.campaign import Campaign
from app.models.document import Document
from app.services.vectorstore import query_similar
from app.services.caching import get_cached, set_cached, invalidate

settings = get_settings()

GAP_ANALYSIS_PROMPT = """You are analyzing a campaign's knowledge bank to identify gaps that would improve email copy quality.

Campaign Context:
---
Campaign Name: {campaign_name}
ICP: {icp}
Pain Points: {pain_points}
Offer: {offer}
Brief: {brief}
---

Existing Knowledge Bank Documents:
{documents_summary}

Based on this information, analyze what's missing that would significantly improve the quality of generated email copy.

Consider these categories:
1. **voice_samples** (HIGH PRIORITY): Examples of the author's writing style, tone, and natural language patterns
2. **voc** (HIGH PRIORITY): Voice of customer - how customers describe their problems, reviews, feedback
3. **testimonials**: Customer testimonials, case studies, proof points
4. **call_transcripts**: Sales call transcripts, meeting notes showing real conversations
5. **linkedin_social**: LinkedIn posts, messages, professional social content
6. **objection_handling**: Common objections and how they're addressed
7. **competitor_context**: Notes on competitor positioning, differentiation angles

For each gap you identify, provide:
- category: one of the above
- priority: "high", "medium", or "low"
- title: Short descriptive title
- description: Why this gap matters for copy quality
- suggestion: Specific, actionable instruction for what to upload

Also identify strengths - what's already well-covered.

Respond with ONLY a JSON object:
{{
    "coverage_score": 0-100,
    "gaps": [
        {{
            "category": "voice_samples|voc|testimonials|call_transcripts|linkedin_social|objection_handling|competitor_context",
            "priority": "high|medium|low",
            "title": "Short title",
            "description": "Why this matters",
            "suggestion": "Specific instruction",
            "file_types": ["txt", "docx", "md", "csv"]
        }}
    ],
    "strengths": [
        "What's already well-covered"
    ]
}}"""


def summarize_documents(documents: List[Document]) -> str:
    """Create a summary of existing documents for the prompt."""
    if not documents:
        return "No documents uploaded yet."
    
    summary_parts = []
    for doc in documents:
        doc_info = f"- {doc.filename} ({doc.doc_type or 'untagged'})"
        if doc.channel:
            doc_info += f" - Channel: {doc.channel}"
        if doc.industry:
            doc_info += f" - Industry: {doc.industry}"
        if doc.processed == 1:
            doc_info += f" - {doc.chunk_count} chunks processed"
        summary_parts.append(doc_info)
    
    return "\n".join(summary_parts)


async def analyze_gaps(campaign: Campaign, db: Session, force_refresh: bool = False) -> Dict[str, Any]:
    """
    Analyze knowledge bank gaps using Claude AI.
    Uses caching to avoid unnecessary API calls.
    
    Args:
        campaign: Campaign to analyze
        db: Database session
        force_refresh: If True, bypass cache and force new analysis
    
    Returns dict with coverage_score, gaps, strengths, cached, and analyzed_at.
    """
    cache_key = f"gap_analysis_{campaign.id}"
    
    # Check cache unless forcing refresh
    if not force_refresh:
        cached_result = get_cached(db, cache_key)
        if cached_result:
            cached_result["cached"] = True
            return cached_result
    
    # Get all documents for this campaign
    documents = db.query(Document).filter(
        Document.campaign_id == campaign.id
    ).all()
    
    documents_summary = summarize_documents(documents)
    
    # Build prompt
    prompt = GAP_ANALYSIS_PROMPT.format(
        campaign_name=campaign.name,
        icp=campaign.icp[:1000] if len(campaign.icp) > 1000 else campaign.icp,
        pain_points=campaign.pain_points[:1000] if len(campaign.pain_points) > 1000 else campaign.pain_points,
        offer=campaign.offer[:1000] if len(campaign.offer) > 1000 else campaign.offer,
        brief=campaign.brief[:500] if campaign.brief and len(campaign.brief) > 500 else (campaign.brief or "None"),
        documents_summary=documents_summary
    )
    
    # Call Claude
    client = Anthropic(api_key=settings.anthropic_api_key)
    
    try:
        response = client.messages.create(
            model=settings.claude_model,
            max_tokens=2000,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ]
        )
        
        response_text = response.content[0].text.strip()
        
        # Parse JSON from response
        try:
            if "```" in response_text:
                json_start = response_text.find("{")
                json_end = response_text.rfind("}") + 1
                response_text = response_text[json_start:json_end]
            
            result = json.loads(response_text)
            
            # Validate and set defaults
            if "coverage_score" not in result:
                result["coverage_score"] = 0
            if "gaps" not in result:
                result["gaps"] = []
            if "strengths" not in result:
                result["strengths"] = []
            
            # Ensure gaps have required fields
            for gap in result["gaps"]:
                if "file_types" not in gap:
                    gap["file_types"] = ["txt", "docx", "md", "csv"]
            
            # Add metadata
            result["cached"] = False
            result["analyzed_at"] = datetime.utcnow().isoformat()
            
            # Cache the result for 24 hours
            set_cached(db, cache_key, result, ttl_hours=24)
            
            return result
            
        except json.JSONDecodeError as e:
            # Fallback if parsing fails
            error_result = {
                "coverage_score": 0,
                "gaps": [
                    {
                        "category": "voice_samples",
                        "priority": "high",
                        "title": "Your Writing Voice",
                        "description": "Unable to analyze. Add examples of your writing style.",
                        "suggestion": "Upload emails or documents you've written.",
                        "file_types": ["txt", "docx", "md"]
                    }
                ],
                "strengths": [],
                "error": f"Failed to parse AI response: {str(e)}",
                "cached": False,
                "analyzed_at": datetime.utcnow().isoformat()
            }
            return error_result
    
    except Exception as e:
        # Fallback on error
        error_result = {
            "coverage_score": 0,
            "gaps": [
                {
                    "category": "voice_samples",
                    "priority": "high",
                    "title": "Your Writing Voice",
                    "description": "Analysis unavailable. Add examples of your writing style.",
                    "suggestion": "Upload emails or documents you've written.",
                    "file_types": ["txt", "docx", "md"]
                }
            ],
            "strengths": [],
            "error": str(e),
            "cached": False,
            "analyzed_at": datetime.utcnow().isoformat()
        }
        return error_result
