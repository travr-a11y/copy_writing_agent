"""
Drafting engine with overflow capture generation.

Core concept: Lead and follow-up are generated together.
1. Lead = Sharp, highest-value message (30-100 words)
2. Cut content = What was removed to keep lead tight
3. Follow-up = Built FROM the cut content (30-80 words)
"""
import json
from typing import List, Dict, Any
from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.campaign import Campaign
from app.models.variant import Variant
from app.services.vectorstore import query_similar
from app.services.qa import check_variant_qa, rewrite_for_qa, get_readability_grade, count_words
from app.prompts.overflow_generation import OVERFLOW_GENERATION_PROMPT, CHUNK_PROMPT

settings = get_settings()


def build_context(campaign: Campaign) -> str:
    """Build context string from campaign and RAG results."""
    # Campaign context
    context_parts = [
        f"Campaign: {campaign.name}",
        f"\nIdeal Customer Profile:\n{campaign.icp}",
        f"\nPain Points:\n{campaign.pain_points}",
        f"\nOffer:\n{campaign.offer}",
    ]
    
    if campaign.brief:
        context_parts.append(f"\nAdditional Context:\n{campaign.brief}")
    
    # RAG: Get relevant voice samples
    voice_chunks = query_similar(
        f"email outreach {campaign.pain_points}",
        n_results=3,
        where={"doc_type": "voice"}
    )
    
    if voice_chunks:
        context_parts.append("\n\nYour Voice Samples (match this tone):")
        for chunk in voice_chunks:
            context_parts.append(f"---\n{chunk['document'][:500]}\n---")
    
    # RAG: Get VOC samples
    voc_chunks = query_similar(
        campaign.pain_points,
        n_results=3,
        where={"doc_type": "voc"}
    )
    
    if voc_chunks:
        context_parts.append("\n\nVoice of Customer (mirror their language):")
        for chunk in voc_chunks:
            context_parts.append(f"---\n{chunk['document'][:300]}\n---")
    
    return "\n".join(context_parts)


async def generate_single_pair(
    campaign: Campaign,
    angle: str,
    context: str,
    db: Session
) -> Dict[str, Any]:
    """Generate a single lead + follow-up pair using overflow capture."""
    client = Anthropic(api_key=settings.anthropic_api_key)
    
    response = client.messages.create(
        model=settings.claude_model,
        max_tokens=settings.max_tokens,
        messages=[
            {
                "role": "user",
                "content": OVERFLOW_GENERATION_PROMPT.format(
                    context=context,
                    angle=angle,
                    lead_min=settings.lead_min_words,
                    lead_max=settings.lead_max_words,
                    followup_min=settings.followup_min_words,
                    followup_max=settings.followup_max_words
                )
            }
        ]
    )
    
    response_text = response.content[0].text.strip()
    
    # Parse JSON response
    try:
        if "```" in response_text:
            json_start = response_text.find("{")
            json_end = response_text.rfind("}") + 1
            response_text = response_text[json_start:json_end]
        
        result = json.loads(response_text)
    except json.JSONDecodeError:
        # Fallback: try to extract content manually
        result = {
            "lead_body": response_text[:500],
            "cut_content": "",
            "followup_body": response_text[500:800] if len(response_text) > 500 else ""
        }
    
    # Create lead variant
    lead_body = result.get("lead_body", "")
    lead_thesis = result.get("lead_thesis", f"{angle} | Testing offer resonance")
    lead = Variant(
        campaign_id=campaign.id,
        touch="lead",
        chunk="base",
        angle=angle,
        body=lead_body,
        thesis=lead_thesis,
        word_count=count_words(lead_body),
        readability_grade=get_readability_grade(lead_body),
        qa_pass=False,
        qa_notes=None
    )
    
    # Run QA on lead
    lead_qa = check_variant_qa(lead)
    retries = 0
    
    while not lead_qa["pass"] and retries < settings.max_qa_retries:
        lead.body = await rewrite_for_qa(lead, lead_qa["issues"])
        lead.word_count = count_words(lead.body)
        lead.readability_grade = get_readability_grade(lead.body)
        lead_qa = check_variant_qa(lead)
        retries += 1
    
    lead.qa_pass = lead_qa["pass"]
    lead.qa_notes = lead_qa.get("notes")
    
    db.add(lead)
    db.flush()  # Get lead ID for follow-up reference
    
    # Create follow-up variant
    followup_body = result.get("followup_body", "")
    followup_thesis = result.get("followup_thesis", f"{angle} | Supporting context from cut content")
    followup = Variant(
        campaign_id=campaign.id,
        lead_variant_id=lead.id,
        touch="followup",
        chunk="base",
        angle=angle,
        body=followup_body,
        thesis=followup_thesis,
        word_count=count_words(followup_body),
        readability_grade=get_readability_grade(followup_body),
        qa_pass=False,
        qa_notes=None
    )
    
    # Run QA on follow-up
    followup_qa = check_variant_qa(followup)
    retries = 0
    
    while not followup_qa["pass"] and retries < settings.max_qa_retries:
        followup.body = await rewrite_for_qa(followup, followup_qa["issues"])
        followup.word_count = count_words(followup.body)
        followup.readability_grade = get_readability_grade(followup.body)
        followup_qa = check_variant_qa(followup)
        retries += 1
    
    followup.qa_pass = followup_qa["pass"]
    followup.qa_notes = followup_qa.get("notes")
    
    db.add(followup)
    db.commit()
    
    return {
        "angle": angle,
        "lead": lead.to_dict(),
        "followup": followup.to_dict(),
        "cut_content": result.get("cut_content", "")
    }


async def generate_variant_pairs(
    campaign: Campaign,
    angles: List[str],
    db: Session
) -> List[Dict[str, Any]]:
    """Generate multiple lead + follow-up pairs."""
    context = build_context(campaign)
    pairs = []
    
    for angle in angles:
        try:
            pair = await generate_single_pair(campaign, angle, context, db)
            pairs.append(pair)
        except Exception as e:
            print(f"Error generating pair for angle {angle}: {e}")
            continue
    
    return pairs


async def generate_chunk_variant(
    base_variant: Variant,
    direction: str,  # "up" or "down"
    db: Session
) -> Variant:
    """Generate a chunk up or chunk down version of a variant."""
    client = Anthropic(api_key=settings.anthropic_api_key)
    
    response = client.messages.create(
        model=settings.claude_model,
        max_tokens=1000,
        messages=[
            {
                "role": "user",
                "content": CHUNK_PROMPT.format(
                    direction=direction,
                    touch=base_variant.touch,
                    body=base_variant.body,
                    instruction="Remove words, be more direct" if direction == "down" 
                        else "Add ONE sentence of context/relevance/credibility"
                )
            }
        ]
    )
    
    new_body = response.content[0].text.strip()
    
    # Create chunk variant (inherit thesis from base)
    chunk_variant = Variant(
        campaign_id=base_variant.campaign_id,
        lead_variant_id=base_variant.lead_variant_id if base_variant.touch == "followup" else None,
        touch=base_variant.touch,
        chunk=direction,
        angle=base_variant.angle,
        body=new_body,
        thesis=base_variant.thesis,  # Inherit thesis from base variant
        word_count=count_words(new_body),
        readability_grade=get_readability_grade(new_body),
        qa_pass=False,
        qa_notes=None
    )
    
    # For chunk variants from leads, link to the same lead
    if base_variant.touch == "lead":
        # This is a chunked lead - followups should still reference original
        pass
    
    # Run QA
    qa_result = check_variant_qa(chunk_variant)
    chunk_variant.qa_pass = qa_result["pass"]
    chunk_variant.qa_notes = qa_result.get("notes")
    
    db.add(chunk_variant)
    db.commit()
    
    return chunk_variant
