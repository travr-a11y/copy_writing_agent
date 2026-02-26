"""QA checks and rewrite logic for email variants."""
import re
import textstat
from typing import Dict, Any, List
from anthropic import Anthropic

from app.config import get_settings, BANNED_PHRASES, AMERICANISM_PATTERNS
from app.models.variant import Variant

settings = get_settings()


def count_words(text: str) -> int:
    """Count words in text."""
    return len(text.split())


def get_readability_grade(text: str) -> float:
    """Get Flesch-Kincaid grade level."""
    try:
        return textstat.flesch_kincaid_grade(text)
    except Exception:
        return 10.0


def check_comma_rule(text: str) -> List[str]:
    """Check for sentences with more than one comma."""
    violations = []
    # Split into sentences
    sentences = re.split(r'[.!?]+', text)
    
    for sentence in sentences:
        sentence = sentence.strip()
        if not sentence:
            continue
        comma_count = sentence.count(',')
        if comma_count > settings.max_commas_per_sentence:
            violations.append(f"'{sentence[:50]}...' has {comma_count} commas")
    
    return violations


def check_banned_phrases(text: str) -> List[str]:
    """Check for banned phrases."""
    found = []
    text_lower = text.lower()
    
    for phrase in BANNED_PHRASES:
        if phrase.lower() in text_lower:
            found.append(phrase)
    
    return found


def check_americanisms(text: str) -> List[str]:
    """Check for Americanism patterns."""
    found = []
    
    for pattern in AMERICANISM_PATTERNS:
        matches = re.findall(pattern, text, re.IGNORECASE)
        if matches:
            found.extend(matches)
    
    return found


def check_greeting_format(text: str) -> List[str]:
    """Check that email starts with {first_name} only, no greeting words."""
    issues = []
    
    # Greeting patterns that should NOT appear at the start
    greeting_patterns = [
        (r"^Hey\s+", "Hey"),
        (r"^Hi\s+", "Hi"),
        (r"^G'day\s+", "G'day"),
        (r"^Morning\s+", "Morning"),
        (r"^Good morning\s+", "Good morning"),
        (r"^Good afternoon\s+", "Good afternoon"),
        (r"^Hello\s+", "Hello"),
        (r"^Hiya\s+", "Hiya"),
        (r"^Gday\s+", "Gday"),
    ]
    
    text_stripped = text.strip()
    
    for pattern, greeting in greeting_patterns:
        if re.match(pattern, text_stripped, re.IGNORECASE):
            issues.append(f"Starts with '{greeting}' - should start with {{first_name}} only")
    
    # Check if it starts with {first_name} (with or without comma)
    if not re.match(r"^\{\{first_name\}\}", text_stripped):
        # If no greeting word found but also doesn't start with {first_name}, that's also an issue
        # But only flag if we found a greeting word (already handled above)
        # or if it doesn't start with any variable at all
        if not re.match(r"^\{\{", text_stripped):
            issues.append("Should start with {{first_name}}")
    
    return issues


def has_open_question(text: str) -> bool:
    """Check if text contains an open-ended question."""
    # Look for question marks
    if "?" not in text:
        return False
    
    # Check for open-ended question starters
    open_starters = [
        r'\bwhat\b', r'\bhow\b', r'\bwhy\b', r'\bwhen\b', 
        r'\bwhere\b', r'\bwhich\b', r'\bwho\b',
        r'\bcurious\b', r'\bwondering\b', r'\binterested\b'
    ]
    
    text_lower = text.lower()
    for pattern in open_starters:
        if re.search(pattern, text_lower):
            return True
    
    return False


def check_variant_qa(variant: Variant) -> Dict[str, Any]:
    """
    Run all QA checks on a variant.
    Returns dict with 'pass' boolean and 'notes' string.
    """
    issues = []
    
    # Word count check
    word_count = count_words(variant.body)
    if variant.touch == "lead":
        if word_count < settings.lead_min_words:
            issues.append(f"Too short: {word_count} words (min {settings.lead_min_words})")
        elif word_count > settings.lead_max_words:
            issues.append(f"Too long: {word_count} words (max {settings.lead_max_words})")
    else:  # followup
        if word_count < settings.followup_min_words:
            issues.append(f"Too short: {word_count} words (min {settings.followup_min_words})")
        elif word_count > settings.followup_max_words:
            issues.append(f"Too long: {word_count} words (max {settings.followup_max_words})")
    
    # Readability check
    grade = get_readability_grade(variant.body)
    if grade > settings.target_readability_grade + 2:
        issues.append(f"Readability too high: Grade {grade:.1f} (target ~{settings.target_readability_grade})")
    
    # Comma rule check
    comma_violations = check_comma_rule(variant.body)
    if comma_violations:
        issues.append(f"Comma violations: {len(comma_violations)} sentences")
    
    # Banned phrases check
    banned = check_banned_phrases(variant.body)
    if banned:
        issues.append(f"Banned phrases: {', '.join(banned[:3])}")
    
    # Americanism check
    americanisms = check_americanisms(variant.body)
    if americanisms:
        issues.append(f"Americanisms detected: {', '.join(set(americanisms)[:3])}")
    
    # Open question check
    if not has_open_question(variant.body):
        issues.append("Missing open-ended question")
    
    # Greeting format check
    greeting_issues = check_greeting_format(variant.body)
    if greeting_issues:
        issues.extend(greeting_issues)
    
    return {
        "pass": len(issues) == 0,
        "notes": "; ".join(issues) if issues else None,
        "issues": issues,
        "metrics": {
            "word_count": word_count,
            "readability_grade": grade,
            "comma_violations": len(comma_violations),
            "banned_count": len(banned),
            "americanism_count": len(americanisms),
            "has_question": has_open_question(variant.body),
            "greeting_issues": len(greeting_issues)
        }
    }


QA_REWRITE_PROMPT = """You are rewriting an email to fix specific QA issues while maintaining the AU-centric tone.

Original email ({touch} - {chunk}):
---
{body}
---

Issues to fix:
{issues}

AU Writing Rules:
- Grade ~6 readability (simple words, short sentences)
- Max 1 comma per sentence
- No hype, urgency, or Americanisms
- One open-ended question required
- Word count: {min_words}-{max_words} words
- Start with {{first_name}} only - NO greeting words (Hey, Hi, G'day, etc.)

Rewrite the email to fix ALL issues while keeping the same angle and message.
Return ONLY the rewritten email text, nothing else."""


async def rewrite_for_qa(variant: Variant, issues: List[str]) -> str:
    """Use Claude to rewrite a variant to pass QA."""
    min_words = settings.lead_min_words if variant.touch == "lead" else settings.followup_min_words
    max_words = settings.lead_max_words if variant.touch == "lead" else settings.followup_max_words
    
    client = Anthropic(api_key=settings.anthropic_api_key)
    
    response = client.messages.create(
        model=settings.claude_model,
        max_tokens=1000,
        messages=[
            {
                "role": "user",
                "content": QA_REWRITE_PROMPT.format(
                    touch=variant.touch,
                    chunk=variant.chunk,
                    body=variant.body,
                    issues="\n".join(f"- {issue}" for issue in issues),
                    min_words=min_words,
                    max_words=max_words
                )
            }
        ]
    )
    
    return response.content[0].text.strip()
