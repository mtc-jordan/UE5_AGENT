import httpx
import json
import asyncio
import logging
from typing import AsyncGenerator, Optional, List, Dict, Any, Union
from core.config import settings
from models.agent import DEFAULT_AGENTS

logger = logging.getLogger(__name__)


class AIService:
    """Unified AI service supporting DeepSeek, Claude, and Google Gemini models."""
    
    DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
    ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1"
    GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai"
    
    MODEL_CONFIGS = {
        # DeepSeek Models
        "deepseek-chat": {
            "provider": "deepseek",
            "model": "deepseek-chat",
            "max_tokens": 8192,
            "display_name": "DeepSeek Chat",
            "description": "Fast and efficient general-purpose model"
        },
        "deepseek-reasoner": {
            "provider": "deepseek",
            "model": "deepseek-reasoner",
            "max_tokens": 8192,
            "display_name": "DeepSeek Reasoner",
            "description": "Advanced reasoning capabilities"
        },
        # Anthropic Claude Models
        "claude-3-5-sonnet": {
            "provider": "anthropic",
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 8192,
            "display_name": "Claude 3.5 Sonnet",
            "description": "Best balance of intelligence and speed"
        },
        "claude-3-opus": {
            "provider": "anthropic",
            "model": "claude-3-opus-20240229",
            "max_tokens": 4096,
            "display_name": "Claude 3 Opus",
            "description": "Most powerful Claude model"
        },
        # Google Gemini Models
        "gemini-2.5-flash": {
            "provider": "google",
            "model": "gemini-2.5-flash",
            "max_tokens": 8192,
            "display_name": "Gemini 2.5 Flash",
            "description": "Balanced model with 1M token context"
        },
        "gemini-2.5-flash-lite": {
            "provider": "google",
            "model": "gemini-2.5-flash-lite",
            "max_tokens": 8192,
            "display_name": "Gemini 2.5 Flash Lite",
            "description": "Fastest and most cost-efficient"
        },
        "gemini-2.5-pro": {
            "provider": "google",
            "model": "gemini-2.5-pro",
            "max_tokens": 8192,
            "display_name": "Gemini 2.5 Pro",
            "description": "Powerful reasoning and coding"
        },
        "gemini-2.0-flash": {
            "provider": "google",
            "model": "gemini-2.0-flash",
            "max_tokens": 8192,
            "display_name": "Gemini 2.0 Flash",
            "description": "Previous generation flash model"
        },
    }
    
    def __init__(self):
        # Don't load API keys in __init__ - load them dynamically on each request
        # This ensures keys saved in Settings are immediately available
        self.agents = {agent["key"]: agent for agent in DEFAULT_AGENTS}
    
    @property
    def deepseek_key(self) -> Optional[str]:
        """Get DeepSeek API key from file or environment"""
        from api.api_keys import get_api_key
        return get_api_key('deepseek') or settings.DEEPSEEK_API_KEY
    
    @property
    def anthropic_key(self) -> Optional[str]:
        """Get Anthropic API key from file or environment"""
        from api.api_keys import get_api_key
        return get_api_key('anthropic') or settings.ANTHROPIC_API_KEY
    
    @property
    def google_key(self) -> Optional[str]:
        """Get Google API key from file or environment"""
        from api.api_keys import get_api_key
        return get_api_key('google') or settings.GOOGLE_API_KEY
    
    def get_available_models(self) -> List[Dict[str, Any]]:
        """Get list of available models with their configurations."""
        models = []
        for key, config in self.MODEL_CONFIGS.items():
            provider = config["provider"]
            available = False
            
            if provider == "deepseek" and self.deepseek_key:
                available = True
            elif provider == "anthropic" and self.anthropic_key:
                available = True
            elif provider == "google" and self.google_key:
                available = True
            
            models.append({
                "id": key,
                "provider": provider,
                "display_name": config.get("display_name", key),
                "description": config.get("description", ""),
                "max_tokens": config["max_tokens"],
                "available": available
            })
        
        return models
    
    def get_provider_status(self) -> Dict[str, bool]:
        """Get status of each AI provider."""
        return {
            "deepseek": bool(self.deepseek_key),
            "anthropic": bool(self.anthropic_key),
            "google": bool(self.google_key)
        }
    
    def get_agent_prompt(self, agent_key: str) -> str:
        """Get system prompt for an agent."""
        agent = self.agents.get(agent_key)
        if agent:
            return agent["system_prompt"]
        return "You are a helpful AI assistant for Unreal Engine 5 development."
    
    def get_agent_info(self, agent_key: str) -> Dict[str, Any]:
        """Get full agent information."""
        return self.agents.get(agent_key, {
            "key": agent_key,
            "name": "Assistant",
            "color": "gray",
            "icon": "Bot"
        })
    
    async def chat_completion_stream(
        self,
        messages: List[Dict[str, str]],
        model: str = "deepseek-chat",
        agent_key: Optional[str] = None,
        temperature: float = 0.7
    ) -> AsyncGenerator[str, None]:
        """Stream chat completion response."""
        config = self.MODEL_CONFIGS.get(model, self.MODEL_CONFIGS["deepseek-chat"])
        
        if agent_key:
            system_prompt = self.get_agent_prompt(agent_key)
            messages = [{"role": "system", "content": system_prompt}] + messages
        
        provider = config["provider"]
        
        if provider == "deepseek":
            async for chunk in self._deepseek_stream(messages, config, temperature):
                yield chunk
        elif provider == "anthropic":
            async for chunk in self._anthropic_stream(messages, config, temperature):
                yield chunk
        elif provider == "google":
            async for chunk in self._gemini_stream(messages, config, temperature):
                yield chunk
        else:
            raise ValueError(f"Unknown provider: {provider}")
    
    async def chat_completion(
        self,
        messages: List[Dict[str, str]],
        model: str = "deepseek-chat",
        agent_key: Optional[str] = None,
        temperature: float = 0.7
    ) -> str:
        """Non-streaming chat completion."""
        config = self.MODEL_CONFIGS.get(model, self.MODEL_CONFIGS["deepseek-chat"])
        
        if agent_key:
            system_prompt = self.get_agent_prompt(agent_key)
            messages = [{"role": "system", "content": system_prompt}] + messages
        
        provider = config["provider"]
        
        if provider == "deepseek":
            return await self._deepseek_completion(messages, config, temperature)
        elif provider == "anthropic":
            return await self._anthropic_completion(messages, config, temperature)
        elif provider == "google":
            return await self._gemini_completion(messages, config, temperature)
        else:
            raise ValueError(f"Unknown provider: {provider}")
    
    # ==================== DeepSeek Methods ====================
    
    async def _deepseek_stream(
        self,
        messages: List[Dict[str, str]],
        config: Dict,
        temperature: float
    ) -> AsyncGenerator[str, None]:
        """DeepSeek streaming API with improved error handling."""
        if not self.deepseek_key:
            raise ValueError("DeepSeek API key not configured")
        
        headers = {
            "Authorization": f"Bearer {self.deepseek_key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream"
        }
        
        payload = {
            "model": config["model"],
            "messages": messages,
            "temperature": temperature,
            "max_tokens": config["max_tokens"],
            "stream": True
        }
        
        timeout = httpx.Timeout(connect=30.0, read=300.0, write=30.0, pool=30.0)
        
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.DEEPSEEK_BASE_URL}/chat/completions",
                    headers=headers,
                    json=payload
                ) as response:
                    response.raise_for_status()
                    
                    buffer = ""
                    async for chunk in response.aiter_bytes():
                        buffer += chunk.decode('utf-8')
                        
                        while '\n' in buffer:
                            line, buffer = buffer.split('\n', 1)
                            line = line.strip()
                            
                            if not line:
                                continue
                            
                            if line.startswith("data: "):
                                data = line[6:]
                                if data == "[DONE]":
                                    return
                                try:
                                    parsed = json.loads(data)
                                    content = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                    if content:
                                        yield content
                                except json.JSONDecodeError as e:
                                    logger.debug(f"JSON decode error: {e}, data: {data[:100]}")
                                    continue
        except httpx.TimeoutException as e:
            logger.error(f"DeepSeek timeout: {e}")
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"DeepSeek HTTP error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"DeepSeek stream error: {e}")
            raise
    
    async def _deepseek_completion(
        self,
        messages: List[Dict[str, str]],
        config: Dict,
        temperature: float
    ) -> str:
        """DeepSeek non-streaming API."""
        if not self.deepseek_key:
            raise ValueError("DeepSeek API key not configured")
        
        headers = {
            "Authorization": f"Bearer {self.deepseek_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": config["model"],
            "messages": messages,
            "temperature": temperature,
            "max_tokens": config["max_tokens"],
            "stream": False
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.DEEPSEEK_BASE_URL}/chat/completions",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]
    
    # ==================== Anthropic Methods ====================
    
    async def _anthropic_stream(
        self,
        messages: List[Dict[str, str]],
        config: Dict,
        temperature: float
    ) -> AsyncGenerator[str, None]:
        """Anthropic streaming API with improved error handling."""
        if not self.anthropic_key:
            raise ValueError("Anthropic API key not configured")
        
        headers = {
            "x-api-key": self.anthropic_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
            "Accept": "text/event-stream"
        }
        
        system_content = ""
        filtered_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_content += msg["content"] + "\n"
            else:
                filtered_messages.append(msg)
        
        payload = {
            "model": config["model"],
            "messages": filtered_messages,
            "max_tokens": config["max_tokens"],
            "temperature": temperature,
            "stream": True
        }
        
        if system_content:
            payload["system"] = system_content.strip()
        
        timeout = httpx.Timeout(connect=30.0, read=300.0, write=30.0, pool=30.0)
        
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.ANTHROPIC_BASE_URL}/messages",
                    headers=headers,
                    json=payload
                ) as response:
                    response.raise_for_status()
                    
                    buffer = ""
                    async for chunk in response.aiter_bytes():
                        buffer += chunk.decode('utf-8')
                        
                        while '\n' in buffer:
                            line, buffer = buffer.split('\n', 1)
                            line = line.strip()
                            
                            if not line:
                                continue
                            
                            if line.startswith("data: "):
                                data = line[6:]
                                try:
                                    parsed = json.loads(data)
                                    if parsed.get("type") == "content_block_delta":
                                        content = parsed.get("delta", {}).get("text", "")
                                        if content:
                                            yield content
                                    elif parsed.get("type") == "message_stop":
                                        return
                                except json.JSONDecodeError as e:
                                    logger.debug(f"JSON decode error: {e}")
                                    continue
        except httpx.TimeoutException as e:
            logger.error(f"Anthropic timeout: {e}")
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"Anthropic HTTP error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Anthropic stream error: {e}")
            raise
    
    async def _anthropic_completion(
        self,
        messages: List[Dict[str, str]],
        config: Dict,
        temperature: float
    ) -> str:
        """Anthropic non-streaming API."""
        if not self.anthropic_key:
            raise ValueError("Anthropic API key not configured")
        
        headers = {
            "x-api-key": self.anthropic_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }
        
        system_content = ""
        filtered_messages = []
        for msg in messages:
            if msg["role"] == "system":
                system_content += msg["content"] + "\n"
            else:
                filtered_messages.append(msg)
        
        payload = {
            "model": config["model"],
            "messages": filtered_messages,
            "max_tokens": config["max_tokens"],
            "temperature": temperature,
            "stream": False
        }
        
        if system_content:
            payload["system"] = system_content.strip()
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.ANTHROPIC_BASE_URL}/messages",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            return data["content"][0]["text"]
    
    # ==================== Google Gemini Methods ====================
    
    async def _gemini_stream(
        self,
        messages: List[Dict[str, str]],
        config: Dict,
        temperature: float
    ) -> AsyncGenerator[str, None]:
        """Google Gemini streaming API using OpenAI compatibility layer."""
        if not self.google_key:
            raise ValueError("Google API key not configured")
        
        headers = {
            "Authorization": f"Bearer {self.google_key}",
            "Content-Type": "application/json",
            "Accept": "text/event-stream"
        }
        
        payload = {
            "model": config["model"],
            "messages": messages,
            "temperature": temperature,
            "max_tokens": config["max_tokens"],
            "stream": True
        }
        
        timeout = httpx.Timeout(connect=30.0, read=300.0, write=30.0, pool=30.0)
        
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream(
                    "POST",
                    f"{self.GEMINI_BASE_URL}/chat/completions",
                    headers=headers,
                    json=payload
                ) as response:
                    response.raise_for_status()
                    
                    buffer = ""
                    async for chunk in response.aiter_bytes():
                        buffer += chunk.decode('utf-8')
                        
                        while '\n' in buffer:
                            line, buffer = buffer.split('\n', 1)
                            line = line.strip()
                            
                            if not line:
                                continue
                            
                            if line.startswith("data: "):
                                data = line[6:]
                                if data == "[DONE]":
                                    return
                                try:
                                    parsed = json.loads(data)
                                    content = parsed.get("choices", [{}])[0].get("delta", {}).get("content", "")
                                    if content:
                                        yield content
                                except json.JSONDecodeError as e:
                                    logger.debug(f"Gemini JSON decode error: {e}, data: {data[:100]}")
                                    continue
        except httpx.TimeoutException as e:
            logger.error(f"Gemini timeout: {e}")
            raise
        except httpx.HTTPStatusError as e:
            logger.error(f"Gemini HTTP error: {e.response.status_code} - {e.response.text}")
            raise
        except Exception as e:
            logger.error(f"Gemini stream error: {e}")
            raise
    
    async def _gemini_completion(
        self,
        messages: List[Dict[str, str]],
        config: Dict,
        temperature: float
    ) -> str:
        """Google Gemini non-streaming API using OpenAI compatibility layer."""
        if not self.google_key:
            raise ValueError("Google API key not configured")
        
        headers = {
            "Authorization": f"Bearer {self.google_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "model": config["model"],
            "messages": messages,
            "temperature": temperature,
            "max_tokens": config["max_tokens"],
            "stream": False
        }
        
        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(
                f"{self.GEMINI_BASE_URL}/chat/completions",
                headers=headers,
                json=payload
            )
            response.raise_for_status()
            data = response.json()
            return data["choices"][0]["message"]["content"]


class AgentOrchestrator:
    """Orchestrates multi-agent conversations."""
    
    def __init__(self, ai_service: AIService):
        self.ai = ai_service
    
    async def solo_mode(
        self,
        messages: List[Dict[str, str]],
        agent_key: str,
        model: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Solo mode: Single agent responds to the user."""
        agent_info = self.ai.get_agent_info(agent_key)
        
        content = ""
        try:
            async for chunk in self.ai.chat_completion_stream(
                messages=messages,
                model=model,
                agent_key=agent_key
            ):
                content += chunk
                yield {
                    "type": "chunk",
                    "agent": agent_key,
                    "agent_name": agent_info["name"],
                    "agent_color": agent_info["color"],
                    "content": chunk
                }
        except Exception as e:
            logger.error(f"Solo mode error: {e}")
            yield {
                "type": "error",
                "agent": agent_key,
                "message": str(e)
            }
            return
        
        yield {
            "type": "complete",
            "agent": agent_key,
            "agent_name": agent_info["name"],
            "content": content
        }
    
    async def team_mode(
        self,
        messages: List[Dict[str, str]],
        active_agents: List[str],
        model: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Team mode: Multiple agents collaborate on the response."""
        
        # Phase 1: Analysis
        yield {
            "type": "phase",
            "phase": "analyzing",
            "message": "Analyzing the request..."
        }
        
        # Determine which agents should respond based on the query
        query = messages[-1]["content"] if messages else ""
        
        # For team mode, we'll have the lead architect coordinate
        coordinator = "architect"
        if coordinator not in active_agents:
            coordinator = active_agents[0] if active_agents else "architect"
        
        # Phase 2: Coordination
        yield {
            "type": "phase",
            "phase": "coordinating",
            "message": f"{self.ai.get_agent_info(coordinator)['name']} is coordinating the team..."
        }
        
        # Get coordinator's analysis
        coord_messages = messages + [{
            "role": "user",
            "content": f"""As the team coordinator, briefly analyze this request and determine which team members should contribute.
            
Available team members: {', '.join([self.ai.get_agent_info(a)['name'] for a in active_agents])}

Provide a brief 1-2 sentence analysis of what's needed."""
        }]
        
        try:
            analysis = await self.ai.chat_completion(
                messages=coord_messages,
                model=model,
                agent_key=coordinator,
                temperature=0.5
            )
            
            yield {
                "type": "analysis",
                "agent": coordinator,
                "agent_name": self.ai.get_agent_info(coordinator)["name"],
                "content": analysis
            }
        except Exception as e:
            logger.error(f"Coordination error: {e}")
            analysis = "Let's have each team member contribute their expertise."
        
        # Phase 3: Team contributions
        yield {
            "type": "phase",
            "phase": "contributing",
            "message": "Team members are contributing..."
        }
        
        contributions = []
        for agent_key in active_agents:
            agent_info = self.ai.get_agent_info(agent_key)
            
            yield {
                "type": "agent_start",
                "agent": agent_key,
                "agent_name": agent_info["name"],
                "agent_color": agent_info["color"]
            }
            
            content = ""
            try:
                async for chunk in self.ai.chat_completion_stream(
                    messages=messages,
                    model=model,
                    agent_key=agent_key
                ):
                    content += chunk
                    yield {
                        "type": "chunk",
                        "agent": agent_key,
                        "agent_name": agent_info["name"],
                        "agent_color": agent_info["color"],
                        "content": chunk
                    }
                
                contributions.append({
                    "agent": agent_key,
                    "agent_name": agent_info["name"],
                    "content": content
                })
                
                yield {
                    "type": "agent_complete",
                    "agent": agent_key,
                    "agent_name": agent_info["name"],
                    "content": content
                }
            except Exception as e:
                logger.error(f"Agent {agent_key} error: {e}")
                yield {
                    "type": "agent_error",
                    "agent": agent_key,
                    "message": str(e)
                }
        
        # Phase 4: Synthesis
        yield {
            "type": "phase",
            "phase": "synthesizing",
            "message": "Synthesizing team contributions..."
        }
        
        # Create synthesis prompt
        synthesis_prompt = f"""Based on the team's contributions, provide a unified, comprehensive response.

Team Contributions:
{chr(10).join([f"**{c['agent_name']}**: {c['content'][:500]}..." for c in contributions])}

Synthesize these into a cohesive response that incorporates the best insights from each team member."""
        
        synthesis_messages = messages + [{"role": "user", "content": synthesis_prompt}]
        
        synthesis_content = ""
        try:
            async for chunk in self.ai.chat_completion_stream(
                messages=synthesis_messages,
                model=model,
                agent_key=coordinator
            ):
                synthesis_content += chunk
                yield {
                    "type": "synthesis_chunk",
                    "content": chunk
                }
        except Exception as e:
            logger.error(f"Synthesis error: {e}")
            synthesis_content = "\n\n".join([c["content"] for c in contributions])
        
        yield {
            "type": "synthesis_complete",
            "content": synthesis_content
        }
        
        # Final phase
        yield {
            "type": "phase",
            "phase": "complete",
            "message": "Team collaboration complete"
        }
    
    async def roundtable_mode(
        self,
        messages: List[Dict[str, str]],
        active_agents: List[str],
        model: str,
        rounds: int = 2
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Roundtable mode: Agents discuss and debate the topic."""
        
        yield {
            "type": "phase",
            "phase": "starting",
            "message": "Starting Round Table discussion..."
        }
        
        discussion_history = []
        
        for round_num in range(1, rounds + 1):
            yield {
                "type": "round_start",
                "round": round_num,
                "total_rounds": rounds
            }
            
            for agent_key in active_agents:
                agent_info = self.ai.get_agent_info(agent_key)
                
                # Build context with previous discussion
                context = ""
                if discussion_history:
                    context = "\n\nPrevious discussion:\n" + "\n".join([
                        f"**{d['agent_name']}**: {d['content'][:300]}..."
                        for d in discussion_history[-4:]  # Last 4 contributions
                    ])
                
                round_messages = messages + [{
                    "role": "user",
                    "content": f"""This is round {round_num} of a team discussion.{context}

Please provide your perspective, building on or respectfully disagreeing with previous points if relevant."""
                }]
                
                yield {
                    "type": "agent_start",
                    "agent": agent_key,
                    "agent_name": agent_info["name"],
                    "agent_color": agent_info["color"],
                    "round": round_num
                }
                
                content = ""
                try:
                    async for chunk in self.ai.chat_completion_stream(
                        messages=round_messages,
                        model=model,
                        agent_key=agent_key
                    ):
                        content += chunk
                        yield {
                            "type": "chunk",
                            "agent": agent_key,
                            "agent_name": agent_info["name"],
                            "agent_color": agent_info["color"],
                            "content": chunk,
                            "round": round_num
                        }
                    
                    discussion_history.append({
                        "agent": agent_key,
                        "agent_name": agent_info["name"],
                        "content": content,
                        "round": round_num
                    })
                    
                    yield {
                        "type": "agent_complete",
                        "agent": agent_key,
                        "agent_name": agent_info["name"],
                        "content": content,
                        "round": round_num
                    }
                except Exception as e:
                    logger.error(f"Roundtable agent {agent_key} error: {e}")
                    yield {
                        "type": "agent_error",
                        "agent": agent_key,
                        "message": str(e),
                        "round": round_num
                    }
            
            yield {
                "type": "round_complete",
                "round": round_num
            }
        
        # Final synthesis
        yield {
            "type": "phase",
            "phase": "synthesizing",
            "message": "Creating final synthesis..."
        }
        
        synthesis_prompt = f"""Based on the roundtable discussion, provide a final synthesis that:
1. Summarizes the key points of agreement
2. Notes any important disagreements or alternative perspectives
3. Provides actionable recommendations

Discussion summary:
{chr(10).join([f"Round {d['round']} - **{d['agent_name']}**: {d['content'][:200]}..." for d in discussion_history])}"""
        
        synthesis_messages = messages + [{"role": "user", "content": synthesis_prompt}]
        
        coordinator = active_agents[0] if active_agents else "architect"
        
        synthesis_content = ""
        try:
            async for chunk in self.ai.chat_completion_stream(
                messages=synthesis_messages,
                model=model,
                agent_key=coordinator
            ):
                synthesis_content += chunk
                yield {
                    "type": "synthesis_chunk",
                    "content": chunk
                }
        except Exception as e:
            logger.error(f"Roundtable synthesis error: {e}")
        
        yield {
            "type": "synthesis_complete",
            "agent": coordinator,
            "agent_name": "Team Synthesis",
            "content": synthesis_content
        }
        
        # Final phase
        yield {
            "type": "phase",
            "phase": "complete",
            "message": "Round Table discussion complete"
        }


# Singleton instances
ai_service = AIService()
orchestrator = AgentOrchestrator(ai_service)
