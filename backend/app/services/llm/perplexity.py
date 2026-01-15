"""Perplexity provider."""
import httpx
from typing import Optional
from app.config import get_settings
from .base import LLMProvider, LLMResponse

settings = get_settings()


class PerplexityProvider(LLMProvider):
    """Perplexity provider for research."""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.perplexity_api_key
        if not self.api_key:
            raise ValueError("Perplexity API key not configured")
        self.base_url = "https://api.perplexity.ai"
    
    def get_default_model(self) -> str:
        return settings.perplexity_model
    
    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: float = 0.7,
        **kwargs
    ) -> LLMResponse:
        """Generate text using Perplexity."""
        try:
            model_name = model or self.get_default_model()
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers={
                        "Authorization": f"Bearer {self.api_key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": model_name,
                        "messages": [
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        "temperature": temperature,
                        "max_tokens": max_tokens or settings.max_tokens,
                        **kwargs
                    },
                    timeout=60.0
                )
                response.raise_for_status()
                data = response.json()
            
            text = data["choices"][0]["message"]["content"] if data.get("choices") else ""
            
            usage = None
            if "usage" in data:
                usage = {
                    "prompt_tokens": data["usage"].get("prompt_tokens", 0),
                    "completion_tokens": data["usage"].get("completion_tokens", 0),
                    "total_tokens": data["usage"].get("total_tokens", 0),
                }
            
            return LLMResponse(
                text=text,
                model=model_name,
                usage=usage
            )
        except Exception as e:
            return LLMResponse(
                text="",
                model=model or self.get_default_model(),
                error=str(e)
            )
