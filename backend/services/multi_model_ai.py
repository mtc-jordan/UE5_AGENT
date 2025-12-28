"""
Multi-Model AI Service

Provides a unified interface for multiple AI providers:
- OpenAI (GPT-4, GPT-4 Turbo, GPT-4o)
- Anthropic (Claude 3.5 Sonnet, Claude 3 Opus)
- Google (Gemini Pro, Gemini 1.5)
- DeepSeek (DeepSeek Chat, DeepSeek Coder)

Each provider can be optimized for different tasks:
- Code generation
- Creative content
- Technical analysis
- Asset generation prompts
"""

import os
import json
import asyncio
from abc import ABC, abstractmethod
from typing import Optional, Dict, List, Any, AsyncGenerator
from dataclasses import dataclass, field
from enum import Enum
import httpx
from openai import AsyncOpenAI
import logging

logger = logging.getLogger(__name__)


class AIProvider(str, Enum):
    """Supported AI providers"""
    OPENAI = "openai"
    ANTHROPIC = "anthropic"
    GOOGLE = "google"
    DEEPSEEK = "deepseek"


class AIModel(str, Enum):
    """Available AI models"""
    # OpenAI Models
    GPT_4 = "gpt-4"
    GPT_4_TURBO = "gpt-4-turbo"
    GPT_4O = "gpt-4o"
    GPT_4O_MINI = "gpt-4o-mini"
    GPT_4_1_MINI = "gpt-4.1-mini"
    GPT_4_1_NANO = "gpt-4.1-nano"
    
    # Anthropic Models
    CLAUDE_3_5_SONNET = "claude-3-5-sonnet-20241022"
    CLAUDE_3_OPUS = "claude-3-opus-20240229"
    CLAUDE_3_SONNET = "claude-3-sonnet-20240229"
    CLAUDE_3_HAIKU = "claude-3-haiku-20240307"
    
    # Google Models
    GEMINI_PRO = "gemini-pro"
    GEMINI_1_5_PRO = "gemini-1.5-pro"
    GEMINI_1_5_FLASH = "gemini-1.5-flash"
    GEMINI_2_5_FLASH = "gemini-2.5-flash"
    
    # DeepSeek Models
    DEEPSEEK_CHAT = "deepseek-chat"
    DEEPSEEK_CODER = "deepseek-coder"
    DEEPSEEK_V3 = "deepseek-v3"


class TaskType(str, Enum):
    """Types of tasks for model recommendation"""
    GENERAL_CHAT = "general_chat"
    CODE_GENERATION = "code_generation"
    BLUEPRINT_CREATION = "blueprint_creation"
    MATERIAL_DESIGN = "material_design"
    SCENE_BUILDING = "scene_building"
    TECHNICAL_ANALYSIS = "technical_analysis"
    CREATIVE_WRITING = "creative_writing"
    ASSET_GENERATION = "asset_generation"


@dataclass
class ModelInfo:
    """Information about an AI model"""
    id: str
    name: str
    provider: AIProvider
    description: str
    context_window: int
    strengths: List[str]
    best_for: List[TaskType]
    cost_tier: str  # "low", "medium", "high"
    supports_vision: bool = False
    supports_streaming: bool = True


# Model registry with detailed information
MODEL_REGISTRY: Dict[str, ModelInfo] = {
    # OpenAI Models
    "gpt-4.1-mini": ModelInfo(
        id="gpt-4.1-mini",
        name="GPT-4.1 Mini",
        provider=AIProvider.OPENAI,
        description="Fast and efficient for most tasks",
        context_window=128000,
        strengths=["Fast responses", "Good balance of speed/quality", "Cost effective"],
        best_for=[TaskType.GENERAL_CHAT, TaskType.CODE_GENERATION, TaskType.SCENE_BUILDING],
        cost_tier="low",
        supports_vision=True
    ),
    "gpt-4.1-nano": ModelInfo(
        id="gpt-4.1-nano",
        name="GPT-4.1 Nano",
        provider=AIProvider.OPENAI,
        description="Fastest model for simple tasks",
        context_window=128000,
        strengths=["Extremely fast", "Very low cost", "Good for simple queries"],
        best_for=[TaskType.GENERAL_CHAT],
        cost_tier="low"
    ),
    "gpt-4o": ModelInfo(
        id="gpt-4o",
        name="GPT-4o",
        provider=AIProvider.OPENAI,
        description="Most capable OpenAI model with vision",
        context_window=128000,
        strengths=["Multimodal", "High quality", "Fast"],
        best_for=[TaskType.CODE_GENERATION, TaskType.TECHNICAL_ANALYSIS, TaskType.ASSET_GENERATION],
        cost_tier="medium",
        supports_vision=True
    ),
    
    # Anthropic Models
    "claude-3-5-sonnet-20241022": ModelInfo(
        id="claude-3-5-sonnet-20241022",
        name="Claude 3.5 Sonnet",
        provider=AIProvider.ANTHROPIC,
        description="Best for coding and technical tasks",
        context_window=200000,
        strengths=["Excellent coding", "Long context", "Detailed analysis"],
        best_for=[TaskType.CODE_GENERATION, TaskType.BLUEPRINT_CREATION, TaskType.TECHNICAL_ANALYSIS],
        cost_tier="medium",
        supports_vision=True
    ),
    "claude-3-opus-20240229": ModelInfo(
        id="claude-3-opus-20240229",
        name="Claude 3 Opus",
        provider=AIProvider.ANTHROPIC,
        description="Most powerful Claude model",
        context_window=200000,
        strengths=["Highest quality", "Complex reasoning", "Creative tasks"],
        best_for=[TaskType.CREATIVE_WRITING, TaskType.MATERIAL_DESIGN, TaskType.ASSET_GENERATION],
        cost_tier="high",
        supports_vision=True
    ),
    "claude-3-haiku-20240307": ModelInfo(
        id="claude-3-haiku-20240307",
        name="Claude 3 Haiku",
        provider=AIProvider.ANTHROPIC,
        description="Fast and affordable Claude model",
        context_window=200000,
        strengths=["Very fast", "Low cost", "Good quality"],
        best_for=[TaskType.GENERAL_CHAT, TaskType.SCENE_BUILDING],
        cost_tier="low",
        supports_vision=True
    ),
    
    # Google Models
    "gemini-2.5-flash": ModelInfo(
        id="gemini-2.5-flash",
        name="Gemini 2.5 Flash",
        provider=AIProvider.GOOGLE,
        description="Latest fast Gemini model",
        context_window=1000000,
        strengths=["Massive context", "Fast", "Multimodal"],
        best_for=[TaskType.GENERAL_CHAT, TaskType.TECHNICAL_ANALYSIS, TaskType.SCENE_BUILDING],
        cost_tier="low",
        supports_vision=True
    ),
    "gemini-1.5-pro": ModelInfo(
        id="gemini-1.5-pro",
        name="Gemini 1.5 Pro",
        provider=AIProvider.GOOGLE,
        description="Powerful Gemini model with huge context",
        context_window=2000000,
        strengths=["Largest context window", "Multimodal", "Good reasoning"],
        best_for=[TaskType.TECHNICAL_ANALYSIS, TaskType.CODE_GENERATION],
        cost_tier="medium",
        supports_vision=True
    ),
    
    # DeepSeek Models
    "deepseek-chat": ModelInfo(
        id="deepseek-chat",
        name="DeepSeek Chat",
        provider=AIProvider.DEEPSEEK,
        description="General purpose DeepSeek model",
        context_window=64000,
        strengths=["Very low cost", "Good quality", "Fast"],
        best_for=[TaskType.GENERAL_CHAT, TaskType.CODE_GENERATION],
        cost_tier="low"
    ),
    "deepseek-coder": ModelInfo(
        id="deepseek-coder",
        name="DeepSeek Coder",
        provider=AIProvider.DEEPSEEK,
        description="Specialized for code generation",
        context_window=64000,
        strengths=["Excellent coding", "Very low cost", "Code completion"],
        best_for=[TaskType.CODE_GENERATION, TaskType.BLUEPRINT_CREATION],
        cost_tier="low"
    ),
    "deepseek-v3": ModelInfo(
        id="deepseek-v3",
        name="DeepSeek V3",
        provider=AIProvider.DEEPSEEK,
        description="Latest DeepSeek model with improved capabilities",
        context_window=128000,
        strengths=["State-of-the-art", "Low cost", "Strong reasoning"],
        best_for=[TaskType.CODE_GENERATION, TaskType.TECHNICAL_ANALYSIS, TaskType.BLUEPRINT_CREATION],
        cost_tier="low"
    )
}


# Task-specific model recommendations
TASK_RECOMMENDATIONS: Dict[TaskType, List[str]] = {
    TaskType.GENERAL_CHAT: ["gpt-4.1-mini", "claude-3-haiku-20240307", "gemini-2.5-flash", "deepseek-chat"],
    TaskType.CODE_GENERATION: ["claude-3-5-sonnet-20241022", "deepseek-coder", "gpt-4o", "deepseek-v3"],
    TaskType.BLUEPRINT_CREATION: ["claude-3-5-sonnet-20241022", "deepseek-coder", "gpt-4.1-mini"],
    TaskType.MATERIAL_DESIGN: ["claude-3-opus-20240229", "gpt-4o", "gemini-1.5-pro"],
    TaskType.SCENE_BUILDING: ["gpt-4.1-mini", "gemini-2.5-flash", "claude-3-haiku-20240307"],
    TaskType.TECHNICAL_ANALYSIS: ["claude-3-5-sonnet-20241022", "gemini-1.5-pro", "deepseek-v3"],
    TaskType.CREATIVE_WRITING: ["claude-3-opus-20240229", "gpt-4o", "gemini-1.5-pro"],
    TaskType.ASSET_GENERATION: ["claude-3-opus-20240229", "gpt-4o", "claude-3-5-sonnet-20241022"]
}


class BaseAIClient(ABC):
    """Abstract base class for AI clients"""
    
    @abstractmethod
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> str:
        """Send a chat completion request"""
        pass
    
    @abstractmethod
    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """Send a streaming chat completion request"""
        pass


class OpenAIClient(BaseAIClient):
    """OpenAI API client"""
    
    def __init__(self):
        self.client = AsyncOpenAI()
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> str:
        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )
        return response.choices[0].message.content
    
    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        stream = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            **kwargs
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class AnthropicClient(BaseAIClient):
    """Anthropic API client"""
    
    def __init__(self):
        self.api_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.base_url = "https://api.anthropic.com/v1"
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> str:
        # Convert messages format
        system_message = ""
        chat_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_message = msg["content"]
            else:
                chat_messages.append(msg)
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": model,
                    "max_tokens": max_tokens or 4096,
                    "system": system_message,
                    "messages": chat_messages,
                    "temperature": temperature
                },
                timeout=120.0
            )
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"]
    
    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        system_message = ""
        chat_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_message = msg["content"]
            else:
                chat_messages.append(msg)
        
        async with httpx.AsyncClient() as client:
            async with client.stream(
                "POST",
                f"{self.base_url}/messages",
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json"
                },
                json={
                    "model": model,
                    "max_tokens": max_tokens or 4096,
                    "system": system_message,
                    "messages": chat_messages,
                    "temperature": temperature,
                    "stream": True
                },
                timeout=120.0
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data = json.loads(line[6:])
                        if data["type"] == "content_block_delta":
                            yield data["delta"]["text"]


class GoogleClient(BaseAIClient):
    """Google Gemini API client (via OpenAI-compatible endpoint)"""
    
    def __init__(self):
        # Use OpenAI-compatible endpoint for Gemini
        self.client = AsyncOpenAI()
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> str:
        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )
        return response.choices[0].message.content
    
    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        stream = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            **kwargs
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class DeepSeekClient(BaseAIClient):
    """DeepSeek API client"""
    
    def __init__(self):
        self.api_key = os.getenv("DEEPSEEK_API_KEY", "")
        self.base_url = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com/v1")
        self.client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url
        )
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> str:
        response = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            **kwargs
        )
        return response.choices[0].message.content
    
    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: str,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        stream = await self.client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            stream=True,
            **kwargs
        )
        async for chunk in stream:
            if chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content


class MultiModelAIService:
    """
    Unified service for multiple AI providers.
    
    Handles model selection, provider routing, and task optimization.
    """
    
    def __init__(self):
        self.clients: Dict[AIProvider, BaseAIClient] = {
            AIProvider.OPENAI: OpenAIClient(),
            AIProvider.ANTHROPIC: AnthropicClient(),
            AIProvider.GOOGLE: GoogleClient(),
            AIProvider.DEEPSEEK: DeepSeekClient()
        }
        
        self.default_model = "gpt-4.1-mini"
    
    def get_provider_for_model(self, model: str) -> AIProvider:
        """Get the provider for a given model"""
        if model in MODEL_REGISTRY:
            return MODEL_REGISTRY[model].provider
        
        # Fallback detection by model name
        if "claude" in model.lower():
            return AIProvider.ANTHROPIC
        elif "gemini" in model.lower():
            return AIProvider.GOOGLE
        elif "deepseek" in model.lower():
            return AIProvider.DEEPSEEK
        else:
            return AIProvider.OPENAI
    
    def get_model_info(self, model: str) -> Optional[ModelInfo]:
        """Get information about a model"""
        return MODEL_REGISTRY.get(model)
    
    def get_available_models(self) -> List[Dict[str, Any]]:
        """Get list of all available models with their info"""
        return [
            {
                "id": info.id,
                "name": info.name,
                "provider": info.provider.value,
                "description": info.description,
                "context_window": info.context_window,
                "strengths": info.strengths,
                "best_for": [t.value for t in info.best_for],
                "cost_tier": info.cost_tier,
                "supports_vision": info.supports_vision,
                "supports_streaming": info.supports_streaming
            }
            for info in MODEL_REGISTRY.values()
        ]
    
    def get_models_by_provider(self, provider: AIProvider) -> List[Dict[str, Any]]:
        """Get models for a specific provider"""
        return [
            {
                "id": info.id,
                "name": info.name,
                "description": info.description,
                "cost_tier": info.cost_tier
            }
            for info in MODEL_REGISTRY.values()
            if info.provider == provider
        ]
    
    def recommend_model(self, task_type: TaskType) -> List[str]:
        """Get recommended models for a task type"""
        return TASK_RECOMMENDATIONS.get(task_type, [self.default_model])
    
    def detect_task_type(self, prompt: str) -> TaskType:
        """Detect the task type from a prompt"""
        prompt_lower = prompt.lower()
        
        # Code-related keywords
        if any(kw in prompt_lower for kw in ["code", "function", "class", "implement", "debug", "script"]):
            return TaskType.CODE_GENERATION
        
        # Blueprint keywords
        if any(kw in prompt_lower for kw in ["blueprint", "node", "event graph", "behavior"]):
            return TaskType.BLUEPRINT_CREATION
        
        # Material keywords
        if any(kw in prompt_lower for kw in ["material", "shader", "texture", "pbr", "surface"]):
            return TaskType.MATERIAL_DESIGN
        
        # Scene building keywords
        if any(kw in prompt_lower for kw in ["scene", "spawn", "create", "place", "build", "room", "environment"]):
            return TaskType.SCENE_BUILDING
        
        # Technical analysis keywords
        if any(kw in prompt_lower for kw in ["analyze", "explain", "how does", "performance", "optimize"]):
            return TaskType.TECHNICAL_ANALYSIS
        
        # Creative keywords
        if any(kw in prompt_lower for kw in ["story", "describe", "imagine", "creative", "design"]):
            return TaskType.CREATIVE_WRITING
        
        # Asset generation keywords
        if any(kw in prompt_lower for kw in ["generate", "create asset", "make", "produce"]):
            return TaskType.ASSET_GENERATION
        
        return TaskType.GENERAL_CHAT
    
    async def chat(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        auto_select_model: bool = False,
        **kwargs
    ) -> str:
        """
        Send a chat completion request.
        
        Args:
            messages: Chat messages
            model: Model to use (optional, uses default if not specified)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            auto_select_model: If True, automatically select best model for the task
            
        Returns:
            Generated response text
        """
        # Auto-select model if requested
        if auto_select_model and messages:
            last_user_message = next(
                (m["content"] for m in reversed(messages) if m["role"] == "user"),
                ""
            )
            task_type = self.detect_task_type(last_user_message)
            recommended = self.recommend_model(task_type)
            model = recommended[0] if recommended else self.default_model
        
        model = model or self.default_model
        provider = self.get_provider_for_model(model)
        client = self.clients[provider]
        
        try:
            return await client.chat(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            )
        except Exception as e:
            logger.error(f"Error with {provider.value}/{model}: {e}")
            # Fallback to default model
            if model != self.default_model:
                logger.info(f"Falling back to {self.default_model}")
                return await self.clients[AIProvider.OPENAI].chat(
                    messages=messages,
                    model=self.default_model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **kwargs
                )
            raise
    
    async def chat_stream(
        self,
        messages: List[Dict[str, str]],
        model: Optional[str] = None,
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        auto_select_model: bool = False,
        **kwargs
    ) -> AsyncGenerator[str, None]:
        """
        Send a streaming chat completion request.
        
        Args:
            messages: Chat messages
            model: Model to use (optional, uses default if not specified)
            temperature: Sampling temperature
            max_tokens: Maximum tokens to generate
            auto_select_model: If True, automatically select best model for the task
            
        Yields:
            Generated response text chunks
        """
        # Auto-select model if requested
        if auto_select_model and messages:
            last_user_message = next(
                (m["content"] for m in reversed(messages) if m["role"] == "user"),
                ""
            )
            task_type = self.detect_task_type(last_user_message)
            recommended = self.recommend_model(task_type)
            model = recommended[0] if recommended else self.default_model
        
        model = model or self.default_model
        provider = self.get_provider_for_model(model)
        client = self.clients[provider]
        
        try:
            async for chunk in client.chat_stream(
                messages=messages,
                model=model,
                temperature=temperature,
                max_tokens=max_tokens,
                **kwargs
            ):
                yield chunk
        except Exception as e:
            logger.error(f"Error with {provider.value}/{model}: {e}")
            # Fallback to default model
            if model != self.default_model:
                logger.info(f"Falling back to {self.default_model}")
                async for chunk in self.clients[AIProvider.OPENAI].chat_stream(
                    messages=messages,
                    model=self.default_model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    **kwargs
                ):
                    yield chunk
            else:
                raise


# Global service instance
_multi_model_service: Optional[MultiModelAIService] = None


def get_multi_model_service() -> MultiModelAIService:
    """Get the global multi-model AI service instance"""
    global _multi_model_service
    if _multi_model_service is None:
        _multi_model_service = MultiModelAIService()
    return _multi_model_service
