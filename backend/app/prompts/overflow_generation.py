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

GREETING FORMAT (CRITICAL):
- Start EVERY email with: {{first_name}}
- NO "Hey", "Hi", "G'day", "Morning", "Good morning", "Hello", or any greeting word before {{first_name}}
- The greeting is handled externally - just use the variable
- Example: "{{first_name}}, I noticed..." NOT "Hey {{first_name}}, I noticed..."
- Example: "{{first_name}} I saw..." NOT "Hi {{first_name}} I saw..."

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
   
FOLLOW-UP RULES (CRITICAL):
- NEVER say "just following up", "checking in", "in case you got busy", "this might have got lost"
- NEVER open with a reference to the previous email ("As I mentioned...", "Following up on...")
- Lead with NEW value: a fresh insight, idea, angle, or specific observation
- Every word counts - no wasted filler or generic check-ins
- Design for notification preview - first line must hook immediately
- Stay value-first, not "check in" - give a concrete reason to respond
- Explain why you're asking for their time (if asking for a call)
- Align to problem awareness - if awareness is low, educate or de-risk
- Demonstrate effort at scale - include specific, tailored ideas
- Avoid generic AI personalization fluff

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

For each variant (lead and follow-up), generate a THESIS - a testable assumption about the prospect:
- What specific pain or challenge is this ICP facing?
- What outcome would resonate with their current situation?
- Why would this offer appeal to them right now?

Write 1-2 sentences as a hypothesis that copy performance can validate.

Example: "The ICP is experiencing cashflow constraints and is actively seeking external financial backing to stabilize operations."
Example: "The ICP struggles with delayed shipment visibility and values real-time tracking to reduce customer complaints."

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
- If chunking UP: Add approximately 20-25 words maximum. Add ONE sentence that provides emotional context, credibility, or deeper relevance. Focus on emotive writing that connects with the reader's situation. Do not exceed 25 additional words.

Return ONLY the adjusted email text, nothing else."""
