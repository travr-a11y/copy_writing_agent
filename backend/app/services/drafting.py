"""
Drafting engine with overflow capture generation.

Core concept: Lead and follow-up are generated together.
1. Lead = Sharp, highest-value message (30-100 words)
2. Cut content = What was removed to keep lead tight
3. Follow-up = Built FROM the cut content (30-80 words)
"""
import asyncio
import json
import re
from typing import List, Dict, Any, Callable, Awaitable
from anthropic import Anthropic
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models.campaign import Campaign
from app.models.variant import Variant
from app.services.vectorstore import query_similar
from app.services.qa import check_variant_qa, rewrite_for_qa, get_readability_grade, count_words
from app.prompts.overflow_generation import OVERFLOW_GENERATION_PROMPT, CHUNK_PROMPT

settings = get_settings()


def detect_variables(text: str) -> str | None:
    """Detect template variables like {{company_name}} in text.
    
    Returns JSON string of found variables, or None if none found.
    """
    pattern = r'\{\{(\w+)\}\}'
    matches = re.findall(pattern, text)
    if matches:
        # Return unique variables as JSON array
        return json.dumps(list(set(matches)))
    return None


def build_context(campaign: Campaign, db: Session = None, custom_instructions: str = None) -> str:
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
    
    # Get archived variants to avoid similar approaches
    if db:
        from app.models.variant import Variant
        archived_variants = db.query(Variant).filter(
            Variant.campaign_id == campaign.id,
            Variant.archived == True
        ).limit(5).all()
        
        if archived_variants:
            context_parts.append("\n\nApproaches to AVOID (previously archived):")
            for v in archived_variants:
                context_parts.append(f"- {v.angle}: {v.body[:100]}...")
    
    # Add custom instructions if provided
    if custom_instructions:
        context_parts.append(f"\n\nCustom Instructions:\n{custom_instructions}")
    
    # Add structured ICP data
    if campaign.icp_firmographics:
        firmo = campaign.icp_firmographics
        if isinstance(firmo, dict):
            icp_parts = []
            if firmo.get("industry"):
                icp_parts.append(f"Industry: {firmo['industry']}")
            if firmo.get("revenue_range_aud"):
                icp_parts.append(f"Revenue Range: {firmo['revenue_range_aud']}")
            if firmo.get("employee_range"):
                icp_parts.append(f"Employee Range: {firmo['employee_range']}")
            if icp_parts:
                context_parts.append(f"\n\nICP Firmographics:\n" + "\n".join(icp_parts))
    
    if campaign.icp_buyer_personas:
        personas = campaign.icp_buyer_personas
        if isinstance(personas, list) and len(personas) > 0:
            context_parts.append("\n\nBuyer Personas:")
            for idx, persona in enumerate(personas[:3], 1):  # Limit to top 3
                if isinstance(persona, dict):
                    role = persona.get("role", "Unknown Role")
                    resp = persona.get("responsibilities", "")
                    triggers = persona.get("triggers", [])
                    persona_text = f"{idx}. {role}"
                    if resp:
                        persona_text += f"\n   Responsibilities: {resp}"
                    if triggers and isinstance(triggers, list):
                        persona_text += f"\n   Triggers: {', '.join(triggers[:3])}"
                    context_parts.append(persona_text)
    
    if campaign.icp_messaging_angles:
        angles = campaign.icp_messaging_angles
        if isinstance(angles, dict):
            msg_parts = []
            if angles.get("positioning_statement"):
                msg_parts.append(f"Positioning: {angles['positioning_statement']}")
            if angles.get("emotional_hook"):
                msg_parts.append(f"Emotional Hook: {angles['emotional_hook']}")
            if angles.get("rational_hook"):
                msg_parts.append(f"Rational Hook: {angles['rational_hook']}")
            if msg_parts:
                context_parts.append("\n\nMessaging Angles:\n" + "\n".join(msg_parts))
    
    if campaign.icp_psychographics:
        psycho = campaign.icp_psychographics
        if isinstance(psycho, dict):
            psycho_parts = []
            if psycho.get("values") and isinstance(psycho["values"], list):
                psycho_parts.append(f"Values: {', '.join(psycho['values'][:5])}")
            if psycho.get("motivations") and isinstance(psycho["motivations"], list):
                psycho_parts.append(f"Motivations: {', '.join(psycho['motivations'][:5])}")
            if psycho_parts:
                context_parts.append("\n\nPsychographics:\n" + "\n".join(psycho_parts))
    
    # Add structured VOC data
    if campaign.voc_pain_themes:
        themes = campaign.voc_pain_themes
        if isinstance(themes, list) and len(themes) > 0:
            context_parts.append("\n\nVoice of Customer Pain Themes:")
            for theme in themes[:5]:  # Limit to top 5 themes
                if isinstance(theme, dict):
                    theme_name = theme.get("theme", "Unnamed Theme")
                    normalised = theme.get("normalised_pain", "")
                    quotes = theme.get("raw_quotes", [])
                    theme_text = f"- {theme_name}"
                    if normalised:
                        theme_text += f": {normalised}"
                    if quotes and isinstance(quotes, list) and len(quotes) > 0:
                        theme_text += f"\n  Quotes: {'; '.join(quotes[:2])}"
                    context_parts.append(theme_text)
    
    if campaign.voc_language_bank:
        lb = campaign.voc_language_bank
        if isinstance(lb, dict):
            lang_parts = []
            if lb.get("phrases") and isinstance(lb["phrases"], list):
                lang_parts.append(f"Customer Phrases: {', '.join(lb['phrases'][:5])}")
            if lb.get("idioms") and isinstance(lb["idioms"], list):
                lang_parts.append(f"Idioms: {', '.join(lb['idioms'][:3])}")
            if lb.get("industry_shorthand") and isinstance(lb["industry_shorthand"], list):
                lang_parts.append(f"Industry Terms: {', '.join(lb['industry_shorthand'][:3])}")
            if lang_parts:
                context_parts.append("\n\nCustomer Language Bank:\n" + "\n".join(lang_parts))
    
    if campaign.voc_objections:
        objections = campaign.voc_objections
        if isinstance(objections, list) and len(objections) > 0:
            context_parts.append("\n\nCustomer Objections:")
            for obj in objections[:3]:  # Limit to top 3
                if isinstance(obj, dict):
                    obj_text = f"- {obj.get('objection', 'Unknown objection')}"
                    quotes = obj.get("quotes", [])
                    if quotes and isinstance(quotes, list) and len(quotes) > 0:
                        obj_text += f" (Quotes: {'; '.join(quotes[:1])})"
                    context_parts.append(obj_text)
    
    if campaign.voc_implications:
        impl = campaign.voc_implications
        if isinstance(impl, dict):
            impl_parts = []
            if impl.get("never_say") and isinstance(impl["never_say"], list):
                impl_parts.append(f"Never Say: {', '.join(impl['never_say'][:3])}")
            if impl.get("acknowledge_early") and isinstance(impl["acknowledge_early"], list):
                impl_parts.append(f"Acknowledge Early: {', '.join(impl['acknowledge_early'][:2])}")
            if impl.get("engaging_tone"):
                impl_parts.append(f"Engaging Tone: {impl['engaging_tone']}")
            if impl.get("disengaging_tone"):
                impl_parts.append(f"Disengaging Tone: {impl['disengaging_tone']}")
            if impl_parts:
                context_parts.append("\n\nCopy Implications:\n" + "\n".join(impl_parts))
    
    # RAG: Get relevant voice samples
    voice_chunks = query_similar(
        f"email outreach {campaign.pain_points}",
        n_results=3,
        where={"doc_type": "company_voice"}
    )
    
    if voice_chunks:
        context_parts.append("\n\nYour Voice Samples (match this tone):")
        for chunk in voice_chunks:
            context_parts.append(f"---\n{chunk['document'][:500]}\n---")
    
    # RAG: Get VOC samples
    voc_chunks = query_similar(
        campaign.pain_points,
        n_results=3,
        where={"doc_type": "voice_of_customer"}
    )
    
    if voc_chunks:
        context_parts.append("\n\nVoice of Customer Documents (mirror their language):")
        for chunk in voc_chunks:
            context_parts.append(f"---\n{chunk['document'][:300]}\n---")
    
    return "\n".join(context_parts)


async def generate_single_pair(
    campaign: Campaign,
    angle: str,
    context: str,
    db: Session,
    custom_instructions: str = None,
    progress_callback: Callable[[str], Awaitable[None]] = None
) -> Dict[str, Any]:
    """Generate a single lead + follow-up pair using overflow capture."""
    if progress_callback:
        await progress_callback(f"Generating variant ({angle} angle)...")
    
    client = Anthropic(api_key=settings.anthropic_api_key)
    
    # Add variable instructions to prompt
    variable_instruction = f"""
Use template variables naturally where personalization improves the message:
- {{company_name}} - Recipient's company name
- {{industry}} - Their industry (current: {campaign.industry or 'N/A'})
- {{location}} - Their location (current: {campaign.geography or 'N/A'})
- {{first_name}} - Recipient's first name

Use variables where they feel natural. Do not force them.
"""
    
    prompt_context = context
    if custom_instructions:
        prompt_context += f"\n\nCustom Instructions:\n{custom_instructions}"
    
    prompt_context += f"\n\n{variable_instruction}"
    
    response = client.messages.create(
        model=settings.claude_model,
        max_tokens=settings.max_tokens,
        messages=[
            {
                "role": "user",
                "content": OVERFLOW_GENERATION_PROMPT.format(
                    context=prompt_context,
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
    
    if progress_callback:
        await progress_callback(f"Writing lead copy ({angle})...")
    
    # Create lead variant
    lead_body = result.get("lead_body", "")
    lead_thesis = result.get("lead_thesis", f"{angle} | Testing offer resonance")
    lead_variables = detect_variables(lead_body)
    lead = Variant(
        campaign_id=campaign.id,
        touch="lead",
        chunk="base",
        angle=angle,
        body=lead_body,
        thesis=lead_thesis,
        variables_used=lead_variables,
        word_count=count_words(lead_body),
        readability_grade=get_readability_grade(lead_body),
        qa_pass=False,
        qa_notes=None
    )
    
    # Run QA on lead with fail-fast option
    lead_qa = check_variant_qa(lead)
    retries = 0

    while not lead_qa["pass"] and retries < settings.max_qa_retries:
        try:
            lead.body = await rewrite_for_qa(lead, lead_qa["issues"])
            lead.word_count = count_words(lead.body)
            lead.readability_grade = get_readability_grade(lead.body)
            lead_qa = check_variant_qa(lead)
            retries += 1
        except Exception as e:
            if settings.qa_fail_fast:
                print(f"QA rewrite failed for lead ({angle}), continuing anyway: {e}")
                break
            raise

    lead.qa_pass = lead_qa["pass"]
    lead.qa_notes = lead_qa.get("notes")
    if retries >= settings.max_qa_retries and not lead.qa_pass and settings.qa_fail_fast:
        lead.qa_notes = f"Failed QA after {retries} retries (fail-fast enabled): {lead_qa.get('notes', '')}"
    
    db.add(lead)
    db.flush()  # Get lead ID for follow-up reference
    
    if progress_callback:
        await progress_callback(f"Writing follow-up copy ({angle})...")
    
    # Create follow-up variant
    followup_body = result.get("followup_body", "")
    followup_thesis = result.get("followup_thesis", f"{angle} | Supporting context from cut content")
    followup_variables = detect_variables(followup_body)
    followup = Variant(
        campaign_id=campaign.id,
        lead_variant_id=lead.id,
        touch="followup",
        chunk="base",
        angle=angle,
        body=followup_body,
        thesis=followup_thesis,
        variables_used=followup_variables,
        word_count=count_words(followup_body),
        readability_grade=get_readability_grade(followup_body),
        qa_pass=False,
        qa_notes=None
    )
    
    # Run QA on follow-up with fail-fast option
    followup_qa = check_variant_qa(followup)
    retries = 0

    while not followup_qa["pass"] and retries < settings.max_qa_retries:
        try:
            followup.body = await rewrite_for_qa(followup, followup_qa["issues"])
            followup.word_count = count_words(followup.body)
            followup.readability_grade = get_readability_grade(followup.body)
            followup_qa = check_variant_qa(followup)
            retries += 1
        except Exception as e:
            if settings.qa_fail_fast:
                print(f"QA rewrite failed for followup ({angle}), continuing anyway: {e}")
                break
            raise

    followup.qa_pass = followup_qa["pass"]
    followup.qa_notes = followup_qa.get("notes")
    if retries >= settings.max_qa_retries and not followup.qa_pass and settings.qa_fail_fast:
        followup.qa_notes = f"Failed QA after {retries} retries (fail-fast enabled): {followup_qa.get('notes', '')}"
    
    if progress_callback:
        await progress_callback(f"Running QA checks ({angle})...")
    
    db.add(followup)
    db.commit()
    db.refresh(lead)
    db.refresh(followup)
    
    print(f"✓ Created lead variant: {lead.id}, campaign: {lead.campaign_id}, angle: {angle}")
    print(f"✓ Created followup variant: {followup.id}, linked to lead: {lead.id}")
    
    return {
        "angle": angle,
        "lead": lead.to_dict(),
        "followup": followup.to_dict(),
        "cut_content": result.get("cut_content", "")
    }


async def generate_variant_pairs(
    campaign: Campaign,
    angles: List[str],
    db: Session,
    parallel: bool = True,
    custom_instructions: str = None,
    chunk_preference: str = None,
    progress_callback: Callable[[str, int, int], Awaitable[None]] = None
) -> List[Dict[str, Any]]:
    """
    Generate multiple lead + follow-up pairs.

    Args:
        campaign: Campaign to generate for
        angles: List of angles to generate
        db: Database session
        parallel: If True, generate all pairs concurrently (default: True, 75-90% faster)
        custom_instructions: Optional custom instructions for generation
        chunk_preference: Optional chunk preference ("base", "up", "down")

    Returns:
        List of variant pairs
    """
    if progress_callback:
        await progress_callback("Building context from documents...", 0, len(angles))
    
    context = build_context(campaign, db=db, custom_instructions=custom_instructions)
    
    if progress_callback:
        await progress_callback("Retrieving voice samples...", 0, len(angles))

    if not parallel:
        # Sequential generation (original behavior)
        pairs = []
        for idx, angle in enumerate(angles, 1):
            try:
                if progress_callback:
                    await progress_callback(f"Generating variant {idx}/{len(angles)} ({angle} angle)...", idx - 1, len(angles))
                pair = await generate_single_pair(campaign, angle, context, db, custom_instructions, progress_callback)
                # Apply chunk preference if specified
                # Note: Base variants are kept in response, chunked variants are created and saved to DB
                # Both will be available after refetch
                if chunk_preference and chunk_preference != "base":
                    if pair.get("lead"):
                        lead_variant = db.query(Variant).filter(Variant.id == pair["lead"]["id"]).first()
                        if lead_variant:
                            chunked_lead = await generate_chunk_variant(lead_variant, chunk_preference, db)
                            # Chunked variant is saved to DB, base remains in response
                            print(f"✓ Created chunked {chunk_preference} variant for lead: {chunked_lead.id} (base: {lead_variant.id})")
                    if pair.get("followup"):
                        followup_variant = db.query(Variant).filter(Variant.id == pair["followup"]["id"]).first()
                        if followup_variant:
                            chunked_followup = await generate_chunk_variant(followup_variant, chunk_preference, db)
                            print(f"✓ Created chunked {chunk_preference} variant for followup: {chunked_followup.id} (base: {followup_variant.id})")
                pairs.append(pair)
            except Exception as e:
                print(f"Error generating pair for angle {angle}: {e}")
                continue
        return pairs

    # Parallel generation - 75-90% faster for 8 variants
    async def generate_with_error_handling(angle: str, idx: int) -> Dict[str, Any] | None:
        try:
            if progress_callback:
                await progress_callback(f"Generating variant {idx + 1}/{len(angles)} ({angle} angle)...", idx, len(angles))
            pair = await generate_single_pair(campaign, angle, context, db, custom_instructions, progress_callback)
            # Apply chunk preference if specified
            # Note: Base variants are kept in response, chunked variants are created and saved to DB
            # Both will be available after refetch
            if chunk_preference and chunk_preference != "base":
                if pair.get("lead"):
                    lead_variant = db.query(Variant).filter(Variant.id == pair["lead"]["id"]).first()
                    if lead_variant:
                        chunked_lead = await generate_chunk_variant(lead_variant, chunk_preference, db)
                        # Chunked variant is saved to DB, base remains in response
                        print(f"✓ Created chunked {chunk_preference} variant for lead: {chunked_lead.id} (base: {lead_variant.id})")
                if pair.get("followup"):
                    followup_variant = db.query(Variant).filter(Variant.id == pair["followup"]["id"]).first()
                    if followup_variant:
                        chunked_followup = await generate_chunk_variant(followup_variant, chunk_preference, db)
                        print(f"✓ Created chunked {chunk_preference} variant for followup: {chunked_followup.id} (base: {followup_variant.id})")
            return pair
        except Exception as e:
            print(f"Error generating pair for angle {angle}: {e}")
            return None

    # Generate all pairs concurrently
    tasks = [generate_with_error_handling(angle, idx) for idx, angle in enumerate(angles)]
    results = await asyncio.gather(*tasks)

    # Filter out None (failed generations)
    pairs = [pair for pair in results if pair is not None]

    return pairs


async def generate_chunk_variant(
    base_variant: Variant,
    direction: str,  # "up" or "down"
    db: Session
) -> Variant:
    """Generate a chunk up or chunk down version of a variant."""
    client = Anthropic(api_key=settings.anthropic_api_key)
    
    if direction == "down":
        instruction = "Remove words, be more direct"
    else:  # direction == "up"
        instruction = (
            "Add ONE sentence of approximately 20-25 words that adds emotional context, "
            "credibility, or deeper relevance. Focus on emotive writing that connects "
            "with the reader's situation. Do not exceed 25 additional words."
        )
    
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
                    instruction=instruction
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
    db.refresh(chunk_variant)
    
    print(f"✓ Chunked variant saved: {chunk_variant.id}, chunk: {chunk_variant.chunk}, base angle: {base_variant.angle}")
    
    return chunk_variant
