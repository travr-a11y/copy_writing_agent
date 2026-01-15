"""Anthropic Claude provider."""
from typing import Optional
from anthropic import Anthropic
from app.config import get_settings
from .base import LLMProvider, LLMResponse

settings = get_settings()


class AnthropicProvider(LLMProvider):
    """Anthropic Claude provider for writing and analytics."""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.anthropic_api_key
        self.client = Anthropic(api_key=self.api_key)
    
    def get_default_model(self) -> str:
        return settings.claude_model
    
    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: float = 0.7,
        **kwargs
    ) -> LLMResponse:
        """Generate text using Claude."""
        try:
            model_name = model or self.get_default_model()
            max_tokens_value = max_tokens or settings.max_tokens
            
            response = self.client.messages.create(
                model=model_name,
                max_tokens=max_tokens_value,
                temperature=temperature,
                messages=[
                    {
                        "role": "user",
                        "content": prompt
                    }
                ],
                **kwargs
            )
            
            text = response.content[0].text if response.content else ""
            
            usage = None
            if hasattr(response, 'usage'):
                usage = {
                    "input_tokens": getattr(response.usage, 'input_tokens', 0),
                    "output_tokens": getattr(response.usage, 'output_tokens', 0),
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
