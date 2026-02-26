"""LLM provider abstractions for research agents."""
import httpx
from dataclasses import dataclass
from typing import Optional

from app.config import get_settings

settings = get_settings()


@dataclass
class LLMResponse:
    text: str
    model: str
    error: Optional[str] = None


class PerplexityProvider:
    """Perplexity API provider for research queries."""

    def __init__(self):
        if not settings.perplexity_api_key:
            raise ValueError("PERPLEXITY_API_KEY is not set")
        self.api_key = settings.perplexity_api_key
        self.model = settings.perplexity_model

    async def generate(
        self,
        prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 4000,
    ) -> LLMResponse:
        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    "https://api.perplexity.ai/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": self.model,
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": temperature,
                        "max_tokens": max_tokens,
                    },
                )
                response.raise_for_status()
                data = response.json()
                text = data["choices"][0]["message"]["content"]
                return LLMResponse(text=text, model=self.model)
        except Exception as e:
            return LLMResponse(text="", model=self.model, error=str(e))


class GeminiProvider:
    """Google Gemini API provider for research queries."""

    def __init__(self):
        if not settings.gemini_api_key:
            raise ValueError("GEMINI_API_KEY is not set")
        self.api_key = settings.gemini_api_key
        self.model = settings.gemini_model

    async def generate(
        self,
        prompt: str,
        temperature: float = 0.3,
        max_tokens: int = 4000,
    ) -> LLMResponse:
        try:
            import google.generativeai as genai

            genai.configure(api_key=self.api_key)
            model = genai.GenerativeModel(self.model)
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=temperature,
                    max_output_tokens=max_tokens,
                ),
            )
            return LLMResponse(text=response.text, model=self.model)
        except Exception as e:
            return LLMResponse(text="", model=self.model, error=str(e))
