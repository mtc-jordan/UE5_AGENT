import httpx
import json
import asyncio
import logging
from typing import AsyncGenerator, Optional, List, Dict, Any, Union
from core.config import settings
from models.agent import DEFAULT_AGENTS

logger = logging.getLogger(__name__)


class AIService:
    """Unified AI service supporting DeepSeek and Claude models."""
    
    DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1"
    ANTHROPIC_BASE_URL = "https://api.anthropic.com/v1"
    
    MODEL_CONFIGS = {
        "deepseek-chat": {
            "provider": "deepseek",
            "model": "deepseek-chat",
            "max_tokens": 8192
        },
        "deepseek-reasoner": {
            "provider": "deepseek",
            "model": "deepseek-reasoner",
            "max_tokens": 8192
        },
        "claude-3-5-sonnet": {
            "provider": "anthropic",
            "model": "claude-3-5-sonnet-20241022",
            "max_tokens": 8192
        },
        "claude-3-opus": {
            "provider": "anthropic",
            "model": "claude-3-opus-20240229",
            "max_tokens": 4096
        }
    }
    
    def __init__(self):
        self.deepseek_key = settings.DEEPSEEK_API_KEY
        self.anthropic_key = settings.ANTHROPIC_API_KEY
        self.agents = {agent["key"]: agent for agent in DEFAULT_AGENTS}
    
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
        
        if config["provider"] == "deepseek":
            async for chunk in self._deepseek_stream(messages, config, temperature):
                yield chunk
        else:
            async for chunk in self._anthropic_stream(messages, config, temperature):
                yield chunk
    
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
        
        if config["provider"] == "deepseek":
            return await self._deepseek_completion(messages, config, temperature)
        else:
            return await self._anthropic_completion(messages, config, temperature)
    
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
        
        # Phase 2: Planning
        yield {
            "type": "phase",
            "phase": "planning",
            "message": f"{self.ai.get_agent_info(coordinator)['name']} is planning the approach..."
        }
        
        # Get coordinator's response first
        coordinator_info = self.ai.get_agent_info(coordinator)
        coordinator_content = ""
        
        try:
            async for chunk in self.ai.chat_completion_stream(
                messages=messages,
                model=model,
                agent_key=coordinator
            ):
                coordinator_content += chunk
                yield {
                    "type": "chunk",
                    "agent": coordinator,
                    "agent_name": coordinator_info["name"],
                    "agent_color": coordinator_info["color"],
                    "content": chunk
                }
        except Exception as e:
            logger.error(f"Team mode coordinator error: {e}")
            yield {
                "type": "error",
                "agent": coordinator,
                "message": str(e)
            }
            return
        
        yield {
            "type": "complete",
            "agent": coordinator,
            "agent_name": coordinator_info["name"],
            "content": coordinator_content
        }
        
        # Phase 3: Other agents can add their input
        other_agents = [a for a in active_agents if a != coordinator]
        
        for agent_key in other_agents[:2]:  # Limit to 2 additional agents
            yield {
                "type": "phase",
                "phase": "contributing",
                "message": f"{self.ai.get_agent_info(agent_key)['name']} is adding insights..."
            }
            
            agent_info = self.ai.get_agent_info(agent_key)
            
            # Build context with coordinator's response
            context_messages = messages + [
                {"role": "assistant", "content": f"[{coordinator}]: {coordinator_content}"},
                {"role": "user", "content": f"Based on the above response from {coordinator_info['name']}, please add your specialized insights or suggestions from your perspective as {agent_info['name']}."}
            ]
            
            agent_content = ""
            try:
                async for chunk in self.ai.chat_completion_stream(
                    messages=context_messages,
                    model=model,
                    agent_key=agent_key
                ):
                    agent_content += chunk
                    yield {
                        "type": "chunk",
                        "agent": agent_key,
                        "agent_name": agent_info["name"],
                        "agent_color": agent_info["color"],
                        "content": chunk
                    }
            except Exception as e:
                logger.error(f"Team mode agent {agent_key} error: {e}")
                yield {
                    "type": "error",
                    "agent": agent_key,
                    "message": str(e)
                }
                continue
            
            yield {
                "type": "complete",
                "agent": agent_key,
                "agent_name": agent_info["name"],
                "content": agent_content
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
        model: str
    ) -> AsyncGenerator[Dict[str, Any], None]:
        """Round Table mode: Agents discuss together as a collaborative team.
        
        This mode creates a true collaborative discussion where:
        1. All agents are aware of each other's roles and expertise
        2. Agents build on each other's ideas
        3. The discussion is synthesized into a final recommendation
        """
        
        # Define agent roles at the table
        AGENT_ROLES = {
            "architect": {
                "table_role": "Discussion Lead",
                "responsibility": "Facilitates the discussion, ensures all perspectives are heard, and synthesizes the final recommendation"
            },
            "developer": {
                "table_role": "Implementation Expert",
                "responsibility": "Provides concrete C++ implementation details and code architecture insights"
            },
            "blueprint": {
                "table_role": "Visual Systems Specialist",
                "responsibility": "Offers Blueprint solutions and visual scripting alternatives"
            },
            "qa": {
                "table_role": "Quality Advocate",
                "responsibility": "Identifies potential issues, edge cases, and ensures robust solutions"
            },
            "devops": {
                "table_role": "Infrastructure Advisor",
                "responsibility": "Addresses build, deployment, and workflow considerations"
            },
            "artist": {
                "table_role": "Visual Quality Expert",
                "responsibility": "Ensures visual fidelity and performance balance"
            }
        }
        
        query = messages[-1]["content"] if messages else ""
        
        # Build the team introduction
        team_intro = "## Round Table Discussion\n\n**Participants at the table:**\n"
        for agent_key in active_agents:
            agent_info = self.ai.get_agent_info(agent_key)
            role_info = AGENT_ROLES.get(agent_key, {"table_role": "Specialist", "responsibility": "Provides expert input"})
            team_intro += f"- **{agent_info['name']}** ({role_info['table_role']}): {role_info['responsibility']}\n"
        
        # Phase 1: Opening the discussion
        yield {
            "type": "phase",
            "phase": "opening",
            "message": "Opening the Round Table discussion..."
        }
        
        # Determine the lead (architect if available, otherwise first agent)
        lead_agent = "architect" if "architect" in active_agents else active_agents[0]
        lead_info = self.ai.get_agent_info(lead_agent)
        lead_role = AGENT_ROLES.get(lead_agent, {"table_role": "Lead"})
        
        # Create the round table system prompt
        roundtable_system = f"""You are participating in a Round Table discussion with other UE5 experts.

{team_intro}

**Discussion Rules:**
1. Address other team members by name when building on their ideas
2. Be collaborative, not competitive
3. Acknowledge good points from others
4. Offer constructive alternatives when disagreeing
5. Focus on practical, implementable solutions

**Your Role:** {lead_info['name']} - {lead_role['table_role']}
{lead_role.get('responsibility', '')}

As the Discussion Lead, open the discussion by:
1. Briefly summarizing the user's request
2. Identifying the key technical challenges
3. Inviting specific team members to share their expertise on relevant aspects
4. Setting the direction for the discussion"""
        
        # Lead opens the discussion
        lead_messages = [{"role": "system", "content": roundtable_system}] + messages
        
        lead_content = ""
        try:
            async for chunk in self.ai.chat_completion_stream(
                messages=lead_messages,
                model=model,
                agent_key=None  # Use custom system prompt
            ):
                lead_content += chunk
                yield {
                    "type": "chunk",
                    "agent": lead_agent,
                    "agent_name": f"{lead_info['name']} (Lead)",
                    "agent_color": lead_info["color"],
                    "content": chunk
                }
        except Exception as e:
            logger.error(f"Round table lead error: {e}")
            yield {"type": "error", "agent": lead_agent, "message": str(e)}
            return
        
        yield {
            "type": "complete",
            "agent": lead_agent,
            "agent_name": f"{lead_info['name']} (Lead)",
            "content": lead_content
        }
        
        # Phase 2: Discussion - Each agent contributes
        discussion_history = [{"speaker": lead_info['name'], "content": lead_content}]
        other_agents = [a for a in active_agents if a != lead_agent]
        
        for i, agent_key in enumerate(other_agents):
            agent_info = self.ai.get_agent_info(agent_key)
            role_info = AGENT_ROLES.get(agent_key, {"table_role": "Specialist", "responsibility": "Provides expert input"})
            
            yield {
                "type": "phase",
                "phase": "discussing",
                "message": f"{agent_info['name']} is contributing to the discussion..."
            }
            
            # Build discussion context
            discussion_context = "\n\n".join([
                f"**{d['speaker']}:** {d['content']}" for d in discussion_history
            ])
            
            agent_system = f"""You are participating in a Round Table discussion with other UE5 experts.

{team_intro}

**Discussion So Far:**
{discussion_context}

**Your Role:** {agent_info['name']} - {role_info['table_role']}
{role_info.get('responsibility', '')}

**Your Task:**
Contribute to the discussion by:
1. Acknowledging relevant points made by others (reference them by name)
2. Adding your specialized perspective and expertise
3. Suggesting specific solutions or approaches from your domain
4. If you see potential issues, raise them constructively
5. Build on ideas rather than starting from scratch

Keep your response focused and collaborative. You're part of a team discussion, not giving a solo presentation."""
            
            agent_messages = [
                {"role": "system", "content": agent_system},
                {"role": "user", "content": query}
            ]
            
            agent_content = ""
            try:
                async for chunk in self.ai.chat_completion_stream(
                    messages=agent_messages,
                    model=model,
                    agent_key=None
                ):
                    agent_content += chunk
                    yield {
                        "type": "chunk",
                        "agent": agent_key,
                        "agent_name": agent_info["name"],
                        "agent_color": agent_info["color"],
                        "content": chunk
                    }
            except Exception as e:
                logger.error(f"Round table agent {agent_key} error: {e}")
                yield {"type": "error", "agent": agent_key, "message": str(e)}
                continue
            
            discussion_history.append({"speaker": agent_info['name'], "content": agent_content})
            
            yield {
                "type": "complete",
                "agent": agent_key,
                "agent_name": agent_info["name"],
                "content": agent_content
            }
        
        # Phase 3: Synthesis - Lead summarizes the discussion
        yield {
            "type": "phase",
            "phase": "synthesizing",
            "message": f"{lead_info['name']} is synthesizing the team's recommendations..."
        }
        
        full_discussion = "\n\n".join([
            f"**{d['speaker']}:** {d['content']}" for d in discussion_history
        ])
        
        synthesis_system = f"""You are the Discussion Lead synthesizing a Round Table discussion.

{team_intro}

**Complete Discussion:**
{full_discussion}

**Your Task:**
As {lead_info['name']}, provide a final synthesis that:
1. Summarizes the key recommendations from the team
2. Highlights areas of agreement
3. Notes any trade-offs or decisions to be made
4. Provides a clear, actionable recommendation
5. Thanks the team for their contributions (mention specific valuable points)

Format your response as:
## Team Recommendation
[Summary of the agreed approach]

## Key Implementation Points
[Bullet points of main technical decisions]

## Trade-offs & Considerations
[Any important trade-offs discussed]

## Next Steps
[Actionable items for the user]"""
        
        synthesis_messages = [
            {"role": "system", "content": synthesis_system},
            {"role": "user", "content": f"Please synthesize the team's discussion on: {query}"}
        ]
        
        synthesis_content = ""
        try:
            async for chunk in self.ai.chat_completion_stream(
                messages=synthesis_messages,
                model=model,
                agent_key=None
            ):
                synthesis_content += chunk
                yield {
                    "type": "chunk",
                    "agent": "synthesis",
                    "agent_name": "Team Synthesis",
                    "agent_color": "cyan",
                    "content": chunk
                }
        except Exception as e:
            logger.error(f"Round table synthesis error: {e}")
            yield {"type": "error", "agent": "synthesis", "message": str(e)}
        
        yield {
            "type": "complete",
            "agent": "synthesis",
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
