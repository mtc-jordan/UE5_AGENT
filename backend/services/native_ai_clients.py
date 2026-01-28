"""
Native AI Provider Clients - December 2025

This module provides native API clients for all AI providers:
- OpenAI: Native openai SDK
- Anthropic Claude: Native anthropic SDK  
- Google Gemini: Native google-generativeai SDK
- DeepSeek: Native httpx client with direct API calls

Each provider has its own client class that handles:
- Authentication
- Tool/Function calling in provider-specific format
- Response parsing to unified format
"""

import json
import logging
import os
from typing import List, Dict, Any, Optional
from abc import ABC, abstractmethod

# Native SDKs
from openai import AsyncOpenAI
import anthropic
import google.generativeai as genai
import httpx

# Import API key management
from api.api_keys import get_api_key

logger = logging.getLogger(__name__)


class BaseAIClient(ABC):
    """Abstract base class for AI provider clients"""
    
    @abstractmethod
    async def chat_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        model: str,
        system_prompt: str
    ) -> Dict[str, Any]:
        """
        Send a chat request with tool definitions.
        
        Returns unified format:
        {
            "content": str,
            "tool_calls": [{"id": str, "name": str, "arguments": dict}],
            "finish_reason": str
        }
        """
        pass


class OpenAIClient(BaseAIClient):
    """Native OpenAI client"""
    
    def __init__(self, api_key: str):
        self.client = AsyncOpenAI(api_key=api_key)
        logger.info("OpenAI client initialized")
    
    async def chat_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        model: str,
        system_prompt: str
    ) -> Dict[str, Any]:
        """OpenAI native chat with tools"""
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        
        response = await self.client.chat.completions.create(
            model=model,
            messages=full_messages,
            tools=tools,
            tool_choice="auto",
            temperature=0.7,
            max_tokens=2048
        )
        
        message = response.choices[0].message
        
        result = {
            "content": message.content or "",
            "tool_calls": [],
            "finish_reason": response.choices[0].finish_reason
        }
        
        if message.tool_calls:
            for tc in message.tool_calls:
                result["tool_calls"].append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": json.loads(tc.function.arguments)
                })
        
        return result


class DeepSeekClient(BaseAIClient):
    """
    Native DeepSeek client using direct HTTP requests.
    
    DeepSeek API Documentation: https://api-docs.deepseek.com/
    Supports:
    - deepseek-chat: DeepSeek-V3 for general conversation
    - deepseek-reasoner: DeepSeek-R1 for reasoning tasks
    """
    
    BASE_URL = "https://api.deepseek.com"
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = httpx.AsyncClient(
            base_url=self.BASE_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            timeout=60.0
        )
        logger.info("DeepSeek native client initialized (using httpx)")
    
    def _convert_tools_to_deepseek_format(self, openai_tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Convert OpenAI tool format to DeepSeek format.
        DeepSeek uses the same format as OpenAI for tools.
        """
        return openai_tools
    
    async def chat_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        model: str,
        system_prompt: str
    ) -> Dict[str, Any]:
        """
        Native DeepSeek chat with tools using direct HTTP requests.
        
        API Endpoint: POST /chat/completions
        """
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        
        # Build request payload
        payload = {
            "model": model,
            "messages": full_messages,
            "temperature": 0.7,
            "max_tokens": 2048,
            "stream": False
        }
        
        # Add tools if provided
        if tools:
            payload["tools"] = self._convert_tools_to_deepseek_format(tools)
            payload["tool_choice"] = "auto"
        
        logger.info(f"DeepSeek API request: model={model}, messages={len(full_messages)}, tools={len(tools) if tools else 0}")
        
        # Make the API request
        response = await self.client.post("/v1/chat/completions", json=payload)
        
        # Raise for status to handle HTTP errors properly
        response.raise_for_status()
        
        # Check for errors
        if response.status_code != 200:
            error_detail = await response.aread()  # Use aread() for async
            error_text = error_detail.decode('utf-8')
            logger.error(f"DeepSeek API error: {response.status_code} - {error_text}")
            raise Exception(f"DeepSeek API error ({response.status_code}): {error_text}")
        
        # Parse response
        data = response.json()
        logger.info(f"DeepSeek API response: {data.get('usage', {})}")
        
        choice = data["choices"][0]
        message = choice["message"]
        
        result = {
            "content": message.get("content") or "",
            "tool_calls": [],
            "finish_reason": choice.get("finish_reason", "stop"),
            "usage": data.get("usage", {})
        }
        
        # Parse tool calls if present
        if message.get("tool_calls"):
            for tc in message["tool_calls"]:
                tool_call = {
                    "id": tc["id"],
                    "name": tc["function"]["name"],
                    "arguments": json.loads(tc["function"]["arguments"]) if isinstance(tc["function"]["arguments"], str) else tc["function"]["arguments"]
                }
                result["tool_calls"].append(tool_call)
        
        # Handle reasoning_content for deepseek-reasoner model
        if message.get("reasoning_content"):
            result["reasoning_content"] = message["reasoning_content"]
            logger.info(f"DeepSeek reasoning content length: {len(message['reasoning_content'])}")
        
        return result
    
    async def close(self):
        """Close the HTTP client"""
        await self.client.aclose()


class AnthropicClient(BaseAIClient):
    """Native Anthropic Claude client"""
    
    def __init__(self, api_key: str):
        self.client = anthropic.AsyncAnthropic(api_key=api_key)
        logger.info("Anthropic Claude client initialized")
    
    def _convert_tools_to_anthropic_format(self, openai_tools: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert OpenAI tool format to Anthropic tool format"""
        anthropic_tools = []
        for tool in openai_tools:
            if tool.get("type") == "function":
                func = tool["function"]
                anthropic_tool = {
                    "name": func["name"],
                    "description": func.get("description", ""),
                    "input_schema": func.get("parameters", {"type": "object", "properties": {}})
                }
                anthropic_tools.append(anthropic_tool)
        return anthropic_tools
    
    def _convert_messages_to_anthropic_format(self, messages: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Convert OpenAI message format to Anthropic format"""
        anthropic_messages = []
        for msg in messages:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            
            # Skip system messages (handled separately in Anthropic)
            if role == "system":
                continue
            
            # Convert tool messages to user messages with tool result
            if role == "tool":
                anthropic_messages.append({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": msg.get("tool_call_id", ""),
                        "content": content
                    }]
                })
            elif role == "assistant" and msg.get("tool_calls"):
                # Convert assistant message with tool calls
                content_blocks = []
                if content:
                    content_blocks.append({"type": "text", "text": content})
                for tc in msg["tool_calls"]:
                    content_blocks.append({
                        "type": "tool_use",
                        "id": tc.get("id", ""),
                        "name": tc.get("function", {}).get("name", tc.get("name", "")),
                        "input": json.loads(tc.get("function", {}).get("arguments", "{}")) if isinstance(tc.get("function", {}).get("arguments"), str) else tc.get("arguments", {})
                    })
                anthropic_messages.append({
                    "role": "assistant",
                    "content": content_blocks
                })
            else:
                anthropic_messages.append({
                    "role": role,
                    "content": content
                })
        
        return anthropic_messages
    
    async def chat_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        model: str,
        system_prompt: str
    ) -> Dict[str, Any]:
        """Anthropic native chat with tools"""
        anthropic_tools = self._convert_tools_to_anthropic_format(tools)
        anthropic_messages = self._convert_messages_to_anthropic_format(messages)
        
        logger.info(f"Calling Anthropic API with model: {model}")
        logger.info(f"Tools count: {len(anthropic_tools)}")
        
        response = await self.client.messages.create(
            model=model,
            max_tokens=2048,
            system=system_prompt,
            tools=anthropic_tools,
            messages=anthropic_messages
        )
        
        # Parse Anthropic response to unified format
        result = {
            "content": "",
            "tool_calls": [],
            "finish_reason": response.stop_reason
        }
        
        for block in response.content:
            if block.type == "text":
                result["content"] += block.text
            elif block.type == "tool_use":
                result["tool_calls"].append({
                    "id": block.id,
                    "name": block.name,
                    "arguments": block.input
                })
        
        return result


class GeminiClient(BaseAIClient):
    """Native Google Gemini client"""
    
    def __init__(self, api_key: str):
        genai.configure(api_key=api_key)
        self.api_key = api_key
        logger.info("Google Gemini client initialized")
    
    def _convert_tools_to_gemini_format(self, openai_tools: List[Dict[str, Any]]) -> List:
        """Convert OpenAI tool format to Gemini function declarations"""
        function_declarations = []
        for tool in openai_tools:
            if tool.get("type") == "function":
                func = tool["function"]
                # Convert OpenAI parameters to Gemini format
                # Gemini uses a different schema format - need to convert
                parameters = func.get("parameters", {})
                
                # Clean up the parameters for Gemini
                gemini_params = self._convert_schema_for_gemini(parameters)
                
                function_declarations.append({
                    "name": func["name"],
                    "description": func.get("description", ""),
                    "parameters": gemini_params
                })
        
        return function_declarations
    
    def _convert_schema_for_gemini(self, schema: Dict[str, Any]) -> Dict[str, Any]:
        """Convert OpenAI JSON schema to Gemini-compatible format"""
        if not schema:
            return {"type": "OBJECT", "properties": {}}
        
        result = {}
        
        # Convert type
        schema_type = schema.get("type", "object")
        type_mapping = {
            "object": "OBJECT",
            "string": "STRING",
            "number": "NUMBER",
            "integer": "INTEGER",
            "boolean": "BOOLEAN",
            "array": "ARRAY"
        }
        result["type"] = type_mapping.get(schema_type, "STRING")
        
        # Convert properties
        if "properties" in schema:
            result["properties"] = {}
            for prop_name, prop_schema in schema["properties"].items():
                result["properties"][prop_name] = self._convert_schema_for_gemini(prop_schema)
        
        # Convert description
        if "description" in schema:
            result["description"] = schema["description"]
        
        # Convert required fields
        if "required" in schema:
            result["required"] = schema["required"]
        
        # Convert items for arrays
        if "items" in schema:
            result["items"] = self._convert_schema_for_gemini(schema["items"])
        
        # Convert enum
        if "enum" in schema:
            result["enum"] = schema["enum"]
        
        return result
    
    async def chat_with_tools(
        self,
        messages: List[Dict[str, Any]],
        tools: List[Dict[str, Any]],
        model: str,
        system_prompt: str
    ) -> Dict[str, Any]:
        """Gemini native chat with tools"""
        import asyncio
        
        # Create the model with tools
        function_declarations = self._convert_tools_to_gemini_format(tools)
        
        gemini_tools = None
        if function_declarations:
            gemini_tools = [genai.protos.Tool(function_declarations=function_declarations)]
        
        gemini_model = genai.GenerativeModel(
            model_name=model,
            system_instruction=system_prompt,
            tools=gemini_tools
        )
        
        # Convert messages to Gemini format
        gemini_history = []
        for msg in messages[:-1]:  # All but the last message go to history
            role = msg.get("role", "user")
            content = msg.get("content", "")
            
            if role == "system":
                continue  # System prompt handled separately
            
            gemini_role = "model" if role == "assistant" else "user"
            gemini_history.append({
                "role": gemini_role,
                "parts": [content]
            })
        
        # Start chat with history
        chat = gemini_model.start_chat(history=gemini_history)
        
        # Get the last user message
        last_message = messages[-1].get("content", "") if messages else ""
        
        # Send message (run in executor since it's sync)
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: chat.send_message(last_message)
        )
        
        # Parse response to unified format
        result = {
            "content": "",
            "tool_calls": [],
            "finish_reason": "stop"
        }
        
        for part in response.parts:
            if hasattr(part, 'text') and part.text:
                result["content"] += part.text
            elif hasattr(part, 'function_call') and part.function_call:
                fc = part.function_call
                result["tool_calls"].append({
                    "id": f"call_{fc.name}_{id(fc)}",
                    "name": fc.name,
                    "arguments": dict(fc.args) if fc.args else {}
                })
                result["finish_reason"] = "tool_calls"
        
        return result


class NativeAIClientFactory:
    """Factory for creating native AI clients"""
    
    _clients: Dict[str, BaseAIClient] = {}
    
    @classmethod
    def get_client(cls, provider: str) -> Optional[BaseAIClient]:
        """Get or create a native client for the provider"""
        
        if provider in cls._clients:
            return cls._clients[provider]
        
        api_key = get_api_key(provider)
        if not api_key:
            logger.warning(f"No API key found for provider: {provider}")
            return None
        
        client = None
        
        if provider == "openai":
            client = OpenAIClient(api_key)
        elif provider == "deepseek":
            client = DeepSeekClient(api_key)
        elif provider == "anthropic":
            client = AnthropicClient(api_key)
        elif provider == "google":
            client = GeminiClient(api_key)
        else:
            logger.warning(f"Unknown provider: {provider}")
            return None
        
        cls._clients[provider] = client
        return client
    
    @classmethod
    def clear_cache(cls):
        """Clear cached clients (useful for testing or key updates)"""
        cls._clients.clear()
