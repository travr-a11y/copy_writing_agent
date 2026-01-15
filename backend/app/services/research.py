"""Research service using Gemini or Perplexity for pain point research."""
import json
from typing import Dict, Any, List
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.campaign import Campaign
from app.models.document import Document
from app.services.llm import GeminiProvider, PerplexityProvider
from app.services.ingestion import process_document
import os
import uuid

settings = get_settings()

RESEARCH_PROMPT = """You are a research assistant analyzing pain points for a target market.

Campaign Context:
- Campaign: {campaign_name}
- ICP: {icp}
- Current Pain Points: {pain_points}
- Offer: {offer}

Research Query: {query}

Based on this context and query, conduct research and provide:

1. A structured list of pain points (5-10 items) that the target market experiences
2. A comprehensive research report (500-1000 words) covering:
   - Market trends
   - Common challenges
   - Industry insights
   - Customer language and terminology
   - Relevant statistics or data points

Respond with ONLY a JSON object:
{{
    "pain_points": [
        {{
            "title": "Pain point title",
            "description": "Detailed description",
            "severity": "high|medium|low",
            "frequency": "common|occasional|rare"
        }}
    ],
    "research_report": "Full research report text here..."
}}"""


async def research_pain_points(
    campaign: Campaign,
    query: str,
    provider: str,  # "gemini" or "perplexity"
    db: Session
) -> Dict[str, Any]:
    """
    Research pain points using the specified provider.
    
    Returns:
        Dict with pain_points list and report_document_id
    """
    if provider not in ["gemini", "perplexity"]:
        raise ValueError(f"Invalid provider: {provider}. Must be 'gemini' or 'perplexity'")
    
    # Build prompt
    prompt = RESEARCH_PROMPT.format(
        campaign_name=campaign.name,
        icp=campaign.icp[:1000] if len(campaign.icp) > 1000 else campaign.icp,
        pain_points=campaign.pain_points[:1000] if len(campaign.pain_points) > 1000 else campaign.pain_points,
        offer=campaign.offer[:1000] if len(campaign.offer) > 1000 else campaign.offer,
        query=query
    )
    
    # Get provider
    try:
        if provider == "gemini":
            llm_provider = GeminiProvider()
        else:
            llm_provider = PerplexityProvider()
    except ValueError as e:
        raise ValueError(f"Provider {provider} not configured: {e}")
    
    # Generate research
    response = await llm_provider.generate(
        prompt=prompt,
        temperature=0.3,  # Lower temperature for research
        max_tokens=2000
    )
    
    if response.error:
        raise Exception(f"Research generation failed: {response.error}")
    
    # Parse JSON response
    try:
        response_text = response.text.strip()
        if "```" in response_text:
            json_start = response_text.find("{")
            json_end = response_text.rfind("}") + 1
            response_text = response_text[json_start:json_end]
        
        result = json.loads(response_text)
        
        # Validate structure
        if "pain_points" not in result:
            result["pain_points"] = []
        if "research_report" not in result:
            result["research_report"] = "Research report not available."
        
    except json.JSONDecodeError as e:
        # Fallback: create basic structure
        result = {
            "pain_points": [
                {
                    "title": "Research Error",
                    "description": "Failed to parse research results. Please try again.",
                    "severity": "low",
                    "frequency": "rare"
                }
            ],
            "research_report": response.text[:2000] if response.text else "Research report unavailable."
        }
    
    # Save research report as document
    report_content = result["research_report"]
    file_id = str(uuid.uuid4())
    filename = f"research_{provider}_{campaign.id[:8]}.txt"
    file_path = os.path.join(settings.upload_dir, f"{file_id}.txt")
    
    os.makedirs(settings.upload_dir, exist_ok=True)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(f"Research Query: {query}\n\n")
        f.write(f"Provider: {provider}\n\n")
        f.write("=" * 60 + "\n")
        f.write("RESEARCH REPORT\n")
        f.write("=" * 60 + "\n\n")
        f.write(report_content)
        f.write("\n\n")
        f.write("=" * 60 + "\n")
        f.write("PAIN POINTS\n")
        f.write("=" * 60 + "\n\n")
        for pp in result["pain_points"]:
            f.write(f"{pp.get('title', 'Untitled')}\n")
            f.write(f"Severity: {pp.get('severity', 'unknown')}\n")
            f.write(f"Frequency: {pp.get('frequency', 'unknown')}\n")
            f.write(f"{pp.get('description', '')}\n\n")
    
    # Create document record
    document = Document(
        campaign_id=campaign.id,
        filename=filename,
        file_path=file_path,
        file_type="txt",
        doc_type="voc",  # Research reports are VOC-related
        channel=None,
        industry=None,
        role=None,
        processed=0,
        chunk_count=0,
    )
    
    db.add(document)
    db.flush()
    
    # Process document
    try:
        chunk_count = await process_document(document, db)
        document.chunk_count = chunk_count
        document.processed = 1
        db.commit()
    except Exception as e:
        document.processed = -1
        db.commit()
        print(f"Warning: Failed to process research document: {e}")
    
    return {
        "pain_points": result["pain_points"],
        "report_document_id": document.id,
        "provider": provider,
        "model": response.model
    }
