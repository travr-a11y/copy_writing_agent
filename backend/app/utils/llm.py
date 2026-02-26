"""LLM utility functions."""
import json
from typing import Dict, Any


def extract_json_from_llm_response(text: str, fallback: Dict[str, Any] = None) -> Dict[str, Any]:
    """
    Extract JSON from LLM response, handling markdown code blocks.

    Args:
        text: LLM response text that may contain JSON
        fallback: Optional fallback dict if parsing fails

    Returns:
        Parsed JSON as dictionary

    Raises:
        json.JSONDecodeError: If JSON cannot be parsed and no fallback provided
    """
    # Remove markdown code blocks if present
    if "```json" in text:
        json_start = text.find("```json") + 7
        json_end = text.find("```", json_start)
        text = text[json_start:json_end].strip()
    elif "```" in text:
        json_start = text.find("```") + 3
        json_end = text.find("```", json_start)
        text = text[json_start:json_end].strip()

    # Find JSON boundaries
    if "{" in text:
        json_start = text.find("{")
        json_end = text.rfind("}") + 1
        text = text[json_start:json_end]

    try:
        return json.loads(text)
    except json.JSONDecodeError:
        if fallback is not None:
            return fallback
        raise
