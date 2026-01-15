"""AI-powered document tag suggestion using Claude."""
import json
from anthropic import Anthropic

from app.config import get_settings
from app.services.ingestion import read_file_content

settings = get_settings()

TAG_SUGGEST_PROMPT = """Analyze this document and suggest appropriate metadata tags.

Document content (first 2000 chars):
---
{content}
---

Based on the content, suggest the following tags:

1. doc_type: What type of document is this?
   - "voice" = Author's own writing (emails, proposals, notes showing their personal style)
   - "voc" = Voice of customer (reviews, testimonials, customer feedback, complaints)
   - "campaign_context" = Campaign materials (offer descriptions, ICP definitions, pain points)

2. channel: What communication channel does this relate to?
   - "email" = Email communication
   - "linkedin" = LinkedIn messages
   - "call" = Phone/video call transcripts
   - null if not applicable

3. industry: What industry does this relate to?
   - Examples: "construction", "logistics", "manufacturing", "professional_services", "civil"
   - null if not clear

4. role: What role/persona does this relate to?
   - Examples: "owner", "founder", "director", "head_of", "gm"
   - null if not clear

Respond with ONLY a JSON object:
{{
    "doc_type": "voice|voc|campaign_context",
    "channel": "email|linkedin|call|null",
    "industry": "string or null",
    "role": "string or null",
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation"
}}"""


async def suggest_document_tags(file_path: str, file_type: str) -> dict:
    """Use Claude to suggest metadata tags for a document."""
    # Read document content
    content = read_file_content(file_path, file_type)
    
    # Truncate for prompt
    content_preview = content[:2000]
    
    client = Anthropic(api_key=settings.anthropic_api_key)
    
    response = client.messages.create(
        model=settings.claude_model,
        max_tokens=500,
        messages=[
            {
                "role": "user",
                "content": TAG_SUGGEST_PROMPT.format(content=content_preview)
            }
        ]
    )
    
    # Parse response
    response_text = response.content[0].text.strip()
    
    # Extract JSON from response
    try:
        # Handle potential markdown code blocks
        if "```" in response_text:
            json_start = response_text.find("{")
            json_end = response_text.rfind("}") + 1
            response_text = response_text[json_start:json_end]
        
        result = json.loads(response_text)
        
        return {
            "doc_type": result.get("doc_type", "campaign_context"),
            "channel": result.get("channel"),
            "industry": result.get("industry"),
            "role": result.get("role"),
            "confidence": result.get("confidence", 0.5),
            "reasoning": result.get("reasoning", "")
        }
    except json.JSONDecodeError:
        # Fallback if parsing fails
        return {
            "doc_type": "campaign_context",
            "channel": None,
            "industry": None,
            "role": None,
            "confidence": 0.0,
            "reasoning": "Failed to parse AI response"
        }
