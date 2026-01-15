"""
Overflow capture generation prompt.

This is the core prompt that generates lead + follow-up pairs.
The follow-up is built from content deliberately cut from the lead.
"""

OVERFLOW_GENERATION_PROMPT = """You are writing cold outreach emails for Australian & New Zealand business owners.

Your tone must be:
- Understated and direct (not salesy)
- Conversational (like talking to a mate who runs a business)
- Relationship-first (building trust, not pushing for sale)
- Plain English (Hemingway-style simplicity)

CRITICAL RULES:
1. Grade ~6 readability - use simple words
2. Short sentences - one idea per sentence
3. Max ONE comma per sentence
4. NO hype words: amazing, revolutionary, game-changer, exclusive, etc.
5. NO urgency: limited time, act now, don't miss out
6. NO American phrases: awesome, totally, super, touching base, reaching out
7. ONE open-ended question per email (curiosity-based)
8. NO hard sell - this is first contact, building rapport

Context for this campaign:
{context}

---

Generate a lead email and follow-up using the OVERFLOW CAPTURE method:

1. LEAD EMAIL ({lead_min}-{lead_max} words):
   - Sharp, focused on the single most valuable point
   - Cut anything that's "nice to have" but not essential
   - End with one open-ended question

2. CUT CONTENT:
   - What valuable context did you remove from the lead to keep it tight?
   - This becomes the basis for the follow-up

3. FOLLOW-UP EMAIL ({followup_min}-{followup_max} words):
   - Built FROM the cut content
   - Adds context/relevance that supports the lead
   - Gentle nudge, no guilt, no pressure
   - Different open-ended question

Use this angle: {angle}

Angles explained:
- curiosity: Lead with a question about their situation
- pain: Acknowledge a specific pain point they likely have
- outcome: Focus on what's possible for them
- proof: Reference a similar business/situation you've helped
- authority: Subtle credibility without bragging
- empathy: Show you understand their world
- challenge: Respectfully question current approach
- insight: Share something they might not know

For each variant (lead and follow-up), generate a THESIS statement that describes:
- The angle/hook being used
- The specific offer aspect being tested

Format: "[Angle] | [Specific offer aspect]"
Example: "Curiosity hook | Direct mobile access to account managers"
Example: "Pain point empathy | Communication blackouts during freight issues"

Respond with ONLY this JSON:
{{
    "lead_body": "The complete lead email text",
    "lead_thesis": "The testing hypothesis for the lead variant",
    "cut_content": "What was removed to keep lead tight",
    "followup_body": "The complete follow-up email text",
    "followup_thesis": "The testing hypothesis for the follow-up variant"
}}"""


CHUNK_PROMPT = """You are adjusting an email's length while maintaining AU-centric tone.

Original email ({touch}):
---
{body}
---

Direction: CHUNK {direction}

{instruction}

Rules:
- Keep the same angle and message
- Maintain Grade ~6 readability
- Max ONE comma per sentence
- Keep the open-ended question
- Stay within AU tone (no hype, no Americanisms)

Return ONLY the adjusted email text, nothing else."""
