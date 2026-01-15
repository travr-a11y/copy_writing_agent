"""Google Gemini provider."""
import google.generativeai as genai
from typing import Optional
from app.config import get_settings
from .base import LLMProvider, LLMResponse

settings = get_settings()


class GeminiProvider(LLMProvider):
    """Google Gemini provider for research."""
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or settings.gemini_api_key
        if not self.api_key:
            raise ValueError("Gemini API key not configured")
        genai.configure(api_key=self.api_key)
        self.model_instance = genai.GenerativeModel(self.get_default_model())
    
    def get_default_model(self) -> str:
        return settings.gemini_model
    
    async def generate(
        self,
        prompt: str,
        model: Optional[str] = None,
        max_tokens: Optional[int] = None,
        temperature: float = 0.7,
        **kwargs
    ) -> LLMResponse:
        """Generate text using Gemini."""
        try:
            model_name = model or self.get_default_model()
            model_instance = genai.GenerativeModel(model_name)
            
            generation_config = {
                "temperature": temperature,
            }
            if max_tokens:
                generation_config["max_output_tokens"] = max_tokens
            
            response = await model_instance.generate_content_async(
                prompt,
                generation_config=generation_config,
                **kwargs
            )
            
            text = response.text if response.text else ""
            
            usage = None
            if hasattr(response, 'usage_metadata'):
                usage = {
                    "prompt_tokens": getattr(response.usage_metadata, 'prompt_token_count', 0),
                    "completion_tokens": getattr(response.usage_metadata, 'completion_token_count', 0),
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
