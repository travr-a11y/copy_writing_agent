"""Research service using Gemini or Perplexity for pain point research."""
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.orm.attributes import flag_modified

from app.config import get_settings
from app.models.campaign import Campaign
from app.models.document import Document
from app.services.llm import PerplexityProvider
from app.services.ingestion import process_document
from app.prompts.icp_definition_agent import ICP_DEFINITION_SYSTEM_PROMPT, ICP_OUTPUT_SCHEMA
from app.prompts.audience_voice_agent import AUDIENCE_VOICE_SYSTEM_PROMPT, AUDIENCE_VOICE_OUTPUT_SCHEMA
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
        doc_type="voice_of_customer",  # Research reports are VOC-related
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


async def run_icp_agent(
    campaign: Campaign,
    industry: str,
    db: Session,
    geography: str = "Australia",
    service_offering: str = "",
    additional_context: str = ""
) -> Dict[str, Any]:
    """
    Run ICP Definition Agent to generate structured ICP.
    
    Args:
        campaign: Campaign to update
        industry: Target industry/vertical
        geography: Target geography (default: Australia)
        service_offering: Service/product being offered
        additional_context: Optional additional context or learnings
        db: Database session
    
    Returns:
        Dict with structured ICP data and metadata
    """
    import time
    start_time = time.time()
    
    # Build prompt with context
    context_parts = [
        f"Service/Product: {service_offering}",
        f"Target Geography: {geography}",
        f"Industry/Vertical: {industry}",
    ]
    
    if additional_context:
        context_parts.append(f"\nAdditional Context/Learnings:\n{additional_context}")
    
    if campaign.icp:
        context_parts.append(f"\nExisting ICP Context:\n{campaign.icp[:500]}")
    
    user_prompt = "\n".join(context_parts)
    
    # Combine system prompt with output schema
    full_prompt = f"""{ICP_DEFINITION_SYSTEM_PROMPT}

{ICP_OUTPUT_SCHEMA}

---

Now, based on the inputs provided, generate the ICP definition:

{user_prompt}

Respond with ONLY a valid JSON object matching the schema above. Do not include markdown formatting or explanatory text."""
    
    # Get Perplexity provider
    try:
        llm_provider = PerplexityProvider()
    except ValueError as e:
        raise ValueError(f"Perplexity not configured: {e}")
    
    # Generate ICP
    response = await llm_provider.generate(
        prompt=full_prompt,
        temperature=0.3,  # Lower temperature for structured output
        max_tokens=4000
    )
    
    if response.error:
        raise Exception(f"ICP generation failed: {response.error}")
    
    # Parse JSON response
    try:
        response_text = response.text.strip()
        # Remove markdown code blocks if present
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        
        # Find JSON boundaries
        if "{" in response_text:
            json_start = response_text.find("{")
            json_end = response_text.rfind("}") + 1
            response_text = response_text[json_start:json_end]
        
        icp_data = json.loads(response_text)
        
        # Validate required sections
        required_sections = [
            "firmographics", "technographics", "buyer_personas", "psychographics",
            "triggers", "qualification", "buying_journey", "messaging_angles", "channels"
        ]
        
        for section in required_sections:
            if section not in icp_data:
                icp_data[section] = {} if section != "buyer_personas" else []
        
    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse ICP JSON: {e}\n\nResponse text: {response.text[:500]}")
    
    # Update campaign with ICP data
    campaign.industry = industry
    campaign.geography = geography
    campaign.service_offering = service_offering
    
    campaign.icp_firmographics = icp_data.get("firmographics", {})
    campaign.icp_technographics = icp_data.get("technographics", {})
    campaign.icp_buyer_personas = icp_data.get("buyer_personas", [])
    campaign.icp_psychographics = icp_data.get("psychographics", {})
    campaign.icp_triggers = icp_data.get("triggers", {})
    campaign.icp_qualification = icp_data.get("qualification", {})
    campaign.icp_buying_journey = icp_data.get("buying_journey", {})
    campaign.icp_messaging_angles = icp_data.get("messaging_angles", {})
    campaign.icp_channels = icp_data.get("channels", {})
    
    # Flag all ICP JSON fields as modified for SQLAlchemy
    flag_modified(campaign, "icp_firmographics")
    flag_modified(campaign, "icp_technographics")
    flag_modified(campaign, "icp_buyer_personas")
    flag_modified(campaign, "icp_psychographics")
    flag_modified(campaign, "icp_triggers")
    flag_modified(campaign, "icp_qualification")
    flag_modified(campaign, "icp_buying_journey")
    flag_modified(campaign, "icp_messaging_angles")
    flag_modified(campaign, "icp_channels")
    
    # Update research version and history
    if campaign.research_version is None:
        campaign.research_version = 1
    else:
        campaign.research_version += 1
    
    # Add to history
    history_entry = {
        "version": campaign.research_version,
        "timestamp": datetime.utcnow().isoformat(),
        "summary": f"ICP research - {industry} in {geography}",
        "type": "icp"
    }
    
    if campaign.research_history is None:
        campaign.research_history = []
    campaign.research_history.append(history_entry)
    flag_modified(campaign, "research_history")  # Tell SQLAlchemy the JSON field changed
    
    campaign.last_research_at = datetime.utcnow()
    
    db.commit()
    db.refresh(campaign)
    
    processing_time = time.time() - start_time
    
    return {
        "success": True,
        "icp": icp_data,
        "research_version": campaign.research_version,
        "processing_time_seconds": round(processing_time, 2),
        "model": response.model
    }


async def run_voice_agent(
    campaign: Campaign,
    icp_summary: str,
    db: Session,
    competitors: Optional[List[str]] = None,
    platforms_priority: Optional[List[str]] = None,
    additional_context: str = ""
) -> Dict[str, Any]:
    """
    Run Audience Voice Research Agent to extract VOC data.
    
    Args:
        campaign: Campaign to update
        icp_summary: Summary of ICP for research context
        db: Database session
        competitors: Optional list of competitors to research
        platforms_priority: Optional list of platforms to prioritize
        additional_context: Optional additional context or learnings
    
    Returns:
        Dict with VOC data and document_id
    """
    import time
    start_time = time.time()
    
    # Build prompt with context
    context_parts = [
        f"ICP Definition: {icp_summary}",
    ]
    
    if competitors:
        context_parts.append(f"Target Competitors: {', '.join(competitors)}")
    
    if platforms_priority:
        context_parts.append(f"Platforms to Prioritize: {', '.join(platforms_priority)}")
    
    if additional_context:
        context_parts.append(f"\nAdditional Context/Learnings:\n{additional_context}")
    
    if campaign.icp:
        context_parts.append(f"\nExisting ICP Context:\n{campaign.icp[:500]}")
    
    user_prompt = "\n".join(context_parts)
    
    # Combine system prompt with output schema
    full_prompt = f"""{AUDIENCE_VOICE_SYSTEM_PROMPT}

{AUDIENCE_VOICE_OUTPUT_SCHEMA}

---

Now, based on the ICP definition provided, conduct research and extract voice-of-customer data:

{user_prompt}

Respond with ONLY a valid JSON object matching the schema above. Do not include markdown formatting or explanatory text."""
    
    # Get Perplexity provider
    try:
        llm_provider = PerplexityProvider()
    except ValueError as e:
        raise ValueError(f"Perplexity not configured: {e}")
    
    # Generate VOC research
    response = await llm_provider.generate(
        prompt=full_prompt,
        temperature=0.3,  # Lower temperature for research
        max_tokens=4000
    )
    
    if response.error:
        raise Exception(f"VOC generation failed: {response.error}")
    
    # Parse JSON response
    try:
        response_text = response.text.strip()
        # Remove markdown code blocks if present
        if "```json" in response_text:
            json_start = response_text.find("```json") + 7
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        elif "```" in response_text:
            json_start = response_text.find("```") + 3
            json_end = response_text.find("```", json_start)
            response_text = response_text[json_start:json_end].strip()
        
        # Find JSON boundaries
        if "{" in response_text:
            json_start = response_text.find("{")
            json_end = response_text.rfind("}") + 1
            response_text = response_text[json_start:json_end]
        
        voc_data = json.loads(response_text)
        
        # Validate required fields
        if "pain_themes" not in voc_data:
            voc_data["pain_themes"] = []
        if "language_bank" not in voc_data:
            voc_data["language_bank"] = {}
        if "objections" not in voc_data:
            voc_data["objections"] = []
        if "implications" not in voc_data:
            voc_data["implications"] = {}
        if "icp_summary" not in voc_data:
            voc_data["icp_summary"] = icp_summary
        
    except json.JSONDecodeError as e:
        raise Exception(f"Failed to parse VOC JSON: {e}\n\nResponse text: {response.text[:500]}")
    
    # Update campaign with VOC data
    campaign.voc_pain_themes = voc_data.get("pain_themes", [])
    campaign.voc_language_bank = voc_data.get("language_bank", {})
    campaign.voc_objections = voc_data.get("objections", [])
    campaign.voc_implications = voc_data.get("implications", {})
    
    # Flag all VOC JSON fields as modified for SQLAlchemy
    flag_modified(campaign, "voc_pain_themes")
    flag_modified(campaign, "voc_language_bank")
    flag_modified(campaign, "voc_objections")
    flag_modified(campaign, "voc_implications")
    
    # Merge pain themes into pain_points field
    pain_theme_texts = []
    for theme in voc_data.get("pain_themes", []):
        theme_name = theme.get("theme", "")
        theme_desc = theme.get("normalised_pain", "")
        if theme_name:
            pain_theme_texts.append(f"{theme_name}: {theme_desc}")
    
    if pain_theme_texts:
        merged_pain = "\n".join(pain_theme_texts)
        if campaign.pain_points:
            campaign.pain_points = f"{campaign.pain_points}\n\n---\n\nVOC Research:\n{merged_pain}"
        else:
            campaign.pain_points = merged_pain
    
    # Update research version and history
    if campaign.research_version is None:
        campaign.research_version = 1
    else:
        campaign.research_version += 1
    
    # Add to history
    history_entry = {
        "version": campaign.research_version,
        "timestamp": datetime.utcnow().isoformat(),
        "summary": "Audience Voice Research",
        "type": "voc"
    }
    
    if campaign.research_history is None:
        campaign.research_history = []
    campaign.research_history.append(history_entry)
    flag_modified(campaign, "research_history")  # Tell SQLAlchemy the JSON field changed
    
    campaign.last_research_at = datetime.utcnow()
    
    # Save VOC report as document in knowledge bank
    report_content = f"""AUDIENCE VOICE RESEARCH REPORT
Generated: {datetime.utcnow().isoformat()}

ICP Summary:
{voc_data.get('icp_summary', '')}

---

PAIN THEMES:
{json.dumps(voc_data.get('pain_themes', []), indent=2)}

---

LANGUAGE BANK:
{json.dumps(voc_data.get('language_bank', {}), indent=2)}

---

OBJECTIONS:
{json.dumps(voc_data.get('objections', []), indent=2)}

---

IMPLICATIONS:
{json.dumps(voc_data.get('implications', {}), indent=2)}

---

SOURCES USED:
{', '.join(voc_data.get('sources_used', []))}

SOURCES LIMITED:
{', '.join(voc_data.get('sources_limited', []))}
"""
    
    file_id = str(uuid.uuid4())
    filename = f"voc_research_{campaign.id[:8]}_{file_id[:4]}.txt"
    file_path = os.path.join(settings.upload_dir, f"{file_id}.txt")
    
    os.makedirs(settings.upload_dir, exist_ok=True)
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(report_content)
    
    # Create document record
    document = Document(
        campaign_id=campaign.id,
        filename=filename,
        file_path=file_path,
        file_type="txt",
        doc_type="voice_of_customer",
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
        print(f"Warning: Failed to process VOC document: {e}")
    
    db.refresh(campaign)
    
    processing_time = time.time() - start_time
    
    return {
        "success": True,
        "voc": voc_data,
        "document_id": document.id,
        "research_version": campaign.research_version,
        "processing_time_seconds": round(processing_time, 2),
        "model": response.model
    }


def calculate_diff(old_data: Dict[str, Any], new_data: Dict[str, Any], prefix: str = "") -> List[str]:
    """Calculate diff between two dictionaries."""
    changes = []
    
    if not isinstance(old_data, dict) or not isinstance(new_data, dict):
        if old_data != new_data:
            changes.append(f"{prefix}: changed")
        return changes
    
    all_keys = set(old_data.keys()) | set(new_data.keys())
    
    for key in all_keys:
        key_path = f"{prefix}.{key}" if prefix else key
        
        if key not in old_data:
            changes.append(f"{key_path}: added")
        elif key not in new_data:
            changes.append(f"{key_path}: removed")
        elif isinstance(old_data[key], dict) and isinstance(new_data[key], dict):
            changes.extend(calculate_diff(old_data[key], new_data[key], key_path))
        elif isinstance(old_data[key], list) and isinstance(new_data[key], list):
            if old_data[key] != new_data[key]:
                changes.append(f"{key_path}: list changed ({len(old_data[key])} -> {len(new_data[key])} items)")
        elif old_data[key] != new_data[key]:
            changes.append(f"{key_path}: changed")
    
    return changes


async def refine_research(
    campaign: Campaign,
    additional_learnings: str,
    db: Session,
    refine_icp: bool = True,
    refine_voc: bool = True
) -> Dict[str, Any]:
    """
    Re-run research agents with additional learnings to refine ICP/VOC.
    
    Args:
        campaign: Campaign to refine
        additional_learnings: Market feedback or learnings to incorporate
        db: Database session
        refine_icp: Whether to refine ICP
        refine_voc: Whether to refine VOC
    
    Returns:
        Dict with new version, updated data, and diff
    """
    # Store previous version data for diff
    prev_icp = {
        "firmographics": campaign.icp_firmographics or {},
        "technographics": campaign.icp_technographics or {},
        "buyer_personas": campaign.icp_buyer_personas or [],
        "psychographics": campaign.icp_psychographics or {},
        "triggers": campaign.icp_triggers or {},
        "qualification": campaign.icp_qualification or {},
        "buying_journey": campaign.icp_buying_journey or {},
        "messaging_angles": campaign.icp_messaging_angles or {},
        "channels": campaign.icp_channels or {},
    }
    
    prev_voc = {
        "pain_themes": campaign.voc_pain_themes or [],
        "language_bank": campaign.voc_language_bank or {},
        "objections": campaign.voc_objections or [],
        "implications": campaign.voc_implications or {},
    }
    
    # Update additional learnings
    campaign.additional_learnings = additional_learnings
    
    icp_changes = []
    voc_changes = []
    
    # Refine ICP if requested
    if refine_icp and campaign.industry:
        try:
            icp_result = await run_icp_agent(
                campaign=campaign,
                industry=campaign.industry,
                db=db,
                geography=campaign.geography or "Australia",
                service_offering=campaign.service_offering or "",
                additional_context=additional_learnings
            )
            
            new_icp = {
                "firmographics": campaign.icp_firmographics or {},
                "technographics": campaign.icp_technographics or {},
                "buyer_personas": campaign.icp_buyer_personas or [],
                "psychographics": campaign.icp_psychographics or {},
                "triggers": campaign.icp_triggers or {},
                "qualification": campaign.icp_qualification or {},
                "buying_journey": campaign.icp_buying_journey or {},
                "messaging_angles": campaign.icp_messaging_angles or {},
                "channels": campaign.icp_channels or {},
            }
            
            icp_changes = calculate_diff(prev_icp, new_icp, "icp")
        except Exception as e:
            icp_changes = [f"ICP refinement failed: {str(e)}"]
    
    # Refine VOC if requested
    if refine_voc:
        try:
            # Build ICP summary from campaign data
            icp_summary_parts = []
            if campaign.industry:
                icp_summary_parts.append(f"Industry: {campaign.industry}")
            if campaign.geography:
                icp_summary_parts.append(f"Geography: {campaign.geography}")
            if campaign.icp_firmographics:
                firmo = campaign.icp_firmographics
                if isinstance(firmo, dict):
                    if firmo.get("industry"):
                        icp_summary_parts.append(firmo["industry"])
            
            icp_summary = " ".join(icp_summary_parts) if icp_summary_parts else campaign.icp or "Target customer profile"
            
            voc_result = await run_voice_agent(
                campaign=campaign,
                icp_summary=icp_summary,
                db=db,
                additional_context=additional_learnings
            )
            
            new_voc = {
                "pain_themes": campaign.voc_pain_themes or [],
                "language_bank": campaign.voc_language_bank or {},
                "objections": campaign.voc_objections or [],
                "implications": campaign.voc_implications or {},
            }
            
            voc_changes = calculate_diff(prev_voc, new_voc, "voc")
        except Exception as e:
            voc_changes = [f"VOC refinement failed: {str(e)}"]
    
    # Add refinement entry to history
    history_entry = {
        "version": campaign.research_version,
        "timestamp": datetime.utcnow().isoformat(),
        "summary": f"Refined with learnings: {additional_learnings[:100]}",
        "type": "refinement",
        "refined_icp": refine_icp,
        "refined_voc": refine_voc
    }
    
    if campaign.research_history is None:
        campaign.research_history = []
    campaign.research_history.append(history_entry)
    
    db.commit()
    db.refresh(campaign)
    
    return {
        "success": True,
        "new_version": campaign.research_version,
        "diff": {
            "icp_changes": icp_changes,
            "voc_changes": voc_changes
        }
    }
