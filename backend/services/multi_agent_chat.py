"""
Multi-Agent Chat Service

Implements three collaboration modes:
1. Solo Mode: Single agent responds
2. Team Mode: Multiple agents respond sequentially
3. Roundtable Mode: Agents discuss together and synthesize response

Based on user requirements for agent collaboration with role awareness,
shared discussion, and synthesized responses.
"""

import logging
from typing import List, Dict, Any, Optional, AsyncGenerator
from dataclasses import dataclass
from enum import Enum

logger = logging.getLogger(__name__)


class AgentMode(str, Enum):
    SOLO = "solo"
    TEAM = "team"
    ROUNDTABLE = "roundtable"


@dataclass
class AgentProfile:
    """Profile for each UE5 development agent"""
    id: str
    name: str
    role: str
    expertise: List[str]
    system_prompt: str
    icon: str
    color: str


# Define UE5 Agent Profiles
AGENT_PROFILES = {
    "architect": AgentProfile(
        id="architect",
        name="Lead Architect",
        role="System Architecture & Design",
        expertise=["system design", "architecture patterns", "performance optimization", "scalability"],
        system_prompt="""You are the Lead Architect for Unreal Engine 5 projects. Your expertise includes:
- System architecture and design patterns
- Performance optimization and scalability
- Technical decision-making and trade-offs
- Best practices for large-scale UE5 projects

When responding, focus on high-level design, architecture decisions, and system-wide implications.""",
        icon="Cpu",
        color="blue"
    ),
    
    "developer": AgentProfile(
        id="developer",
        name="C++ Developer",
        role="C++ Implementation",
        expertise=["C++ programming", "UE5 API", "gameplay programming", "code optimization"],
        system_prompt="""You are a Senior C++ Developer specializing in Unreal Engine 5. Your expertise includes:
- C++ programming and UE5 C++ API
- Gameplay programming and systems
- Code optimization and debugging
- Memory management and performance

When responding, provide concrete C++ code examples and implementation details.""",
        icon="Code",
        color="green"
    ),
    
    "blueprint": AgentProfile(
        id="blueprint",
        name="Blueprint Specialist",
        role="Visual Scripting",
        expertise=["blueprint systems", "visual scripting", "rapid prototyping", "game logic"],
        system_prompt="""You are a Blueprint Specialist for Unreal Engine 5. Your expertise includes:
- Blueprint visual scripting and node-based programming
- Rapid prototyping and iteration
- Game logic and gameplay mechanics
- Blueprint optimization and best practices

When responding, explain blueprint solutions and visual scripting approaches.""",
        icon="Workflow",
        color="purple"
    ),
    
    "qa": AgentProfile(
        id="qa",
        name="QA Engineer",
        role="Quality Assurance & Testing",
        expertise=["testing strategies", "debugging", "quality assurance", "performance profiling"],
        system_prompt="""You are a QA Engineer for Unreal Engine 5 projects. Your expertise includes:
- Testing strategies and test automation
- Debugging and issue reproduction
- Performance profiling and analysis
- Quality assurance best practices

When responding, focus on testing approaches, potential issues, and quality concerns.""",
        icon="Shield",
        color="red"
    ),
    
    "devops": AgentProfile(
        id="devops",
        name="DevOps Engineer",
        role="Build & Deployment",
        expertise=["build systems", "CI/CD", "deployment", "version control"],
        system_prompt="""You are a DevOps Engineer for Unreal Engine 5 projects. Your expertise includes:
- Build systems and automation
- CI/CD pipelines for UE5
- Deployment and packaging
- Version control and team workflows

When responding, focus on build processes, automation, and deployment strategies.""",
        icon="Server",
        color="orange"
    ),
    
    "artist": AgentProfile(
        id="artist",
        name="Technical Artist",
        role="Visuals & Optimization",
        expertise=["materials", "shaders", "rendering", "visual optimization"],
        system_prompt="""You are a Technical Artist for Unreal Engine 5. Your expertise includes:
- Material creation and shader development
- Rendering techniques and optimization
- Visual effects and post-processing
- Art pipeline and workflow optimization

When responding, focus on visual quality, materials, shaders, and rendering optimization.""",
        icon="Palette",
        color="pink"
    )
}


class MultiAgentChatService:
    """
    Service for multi-agent collaboration in UE5 development.
    
    Supports three modes:
    - Solo: Single agent responds
    - Team: Multiple agents respond sequentially
    - Roundtable: Agents discuss together and synthesize
    """
    
    def __init__(self, ai_service):
        """
        Initialize multi-agent service.
        
        Args:
            ai_service: The underlying AI service (UE5AIChatService)
        """
        self.ai_service = ai_service
        self.agents = AGENT_PROFILES
    
    def get_agent_system_prompt(self, agent_id: str, mode: AgentMode, other_agents: List[str] = None) -> str:
        """
        Get system prompt for an agent based on mode.
        
        Args:
            agent_id: ID of the agent
            mode: Collaboration mode
            other_agents: List of other agent IDs (for roundtable)
        
        Returns:
            System prompt string
        """
        agent = self.agents.get(agent_id)
        if not agent:
            return ""
        
        base_prompt = agent.system_prompt
        
        if mode == AgentMode.ROUNDTABLE and other_agents:
            # Add collaboration context for roundtable
            other_agent_names = [self.agents[aid].name for aid in other_agents if aid in self.agents and aid != agent_id]
            collaboration_context = f"""

## Roundtable Collaboration Mode

You are participating in a collaborative discussion with other UE5 experts:
{', '.join(other_agent_names)}

Guidelines for collaboration:
1. Reference and build upon other agents' suggestions when relevant
2. Acknowledge good ideas from teammates
3. Offer your specialized perspective
4. Work towards a consensus solution
5. Be concise but thorough

Your role is to contribute your expertise while being aware of the broader team discussion."""
            
            return base_prompt + collaboration_context
        
        return base_prompt
    
    async def chat_solo(
        self,
        messages: List[Dict[str, Any]],
        agent_id: str,
        model: str,
        execute_tools: bool = True,
        tool_executor: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Solo mode: Single agent responds.
        
        Args:
            messages: Chat history
            agent_id: ID of the agent to use
            model: AI model to use
            execute_tools: Whether to execute tools
            tool_executor: Tool execution function
        
        Returns:
            Response dict with agent info
        """
        agent = self.agents.get(agent_id)
        if not agent:
            return {"error": f"Unknown agent: {agent_id}"}
        
        logger.info(f"Solo mode: {agent.name} responding")
        
        # Prepend agent's system prompt
        agent_messages = [
            {"role": "system", "content": self.get_agent_system_prompt(agent_id, AgentMode.SOLO)}
        ] + messages
        
        # Get response from AI service
        result = await self.ai_service.chat(
            messages=agent_messages,
            model=model,
            execute_tools=execute_tools,
            tool_executor=tool_executor
        )
        
        # Add agent metadata
        result["agent"] = {
            "id": agent.id,
            "name": agent.name,
            "role": agent.role
        }
        result["mode"] = "solo"
        
        return result
    
    async def chat_team(
        self,
        messages: List[Dict[str, Any]],
        agent_ids: List[str],
        model: str,
        execute_tools: bool = True,
        tool_executor: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Team mode: Multiple agents respond sequentially.
        
        Args:
            messages: Chat history
            agent_ids: List of agent IDs to use
            model: AI model to use
            execute_tools: Whether to execute tools
            tool_executor: Tool execution function
        
        Returns:
            Combined response with all agent responses
        """
        if not agent_ids:
            return {"error": "No agents specified for team mode"}
        
        logger.info(f"Team mode: {len(agent_ids)} agents responding sequentially")
        
        agent_responses = []
        all_tool_calls = []
        all_tool_results = []
        
        for agent_id in agent_ids:
            agent = self.agents.get(agent_id)
            if not agent:
                logger.warning(f"Unknown agent: {agent_id}, skipping")
                continue
            
            logger.info(f"  {agent.name} is responding...")
            
            # Prepend agent's system prompt
            agent_messages = [
                {"role": "system", "content": self.get_agent_system_prompt(agent_id, AgentMode.TEAM)}
            ] + messages
            
            # Get response from AI service
            result = await self.ai_service.chat(
                messages=agent_messages,
                model=model,
                execute_tools=execute_tools,
                tool_executor=tool_executor
            )
            
            agent_responses.append({
                "agent": {
                    "id": agent.id,
                    "name": agent.name,
                    "role": agent.role,
                    "icon": agent.icon,
                    "color": agent.color
                },
                "content": result.get("content", ""),
                "tool_calls": result.get("tool_calls", [])
            })
            
            # Collect tool calls and results
            all_tool_calls.extend(result.get("tool_calls", []))
            all_tool_results.extend(result.get("tool_results", []))
        
        # Combine all responses
        combined_content = "\n\n".join([
            f"**{resp['agent']['name']}** ({resp['agent']['role']}):\n{resp['content']}"
            for resp in agent_responses
        ])
        
        return {
            "content": combined_content,
            "mode": "team",
            "agents": agent_responses,
            "tool_calls": all_tool_calls,
            "tool_results": all_tool_results
        }
    
    async def chat_roundtable(
        self,
        messages: List[Dict[str, Any]],
        agent_ids: List[str],
        model: str,
        execute_tools: bool = True,
        tool_executor: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Roundtable mode: Agents discuss together and synthesize response.
        
        This implements collaborative discussion where:
        1. Agents are aware of each other
        2. Each agent contributes their perspective
        3. Agents can reference each other's ideas
        4. A synthesized response is created
        
        Args:
            messages: Chat history
            agent_ids: List of agent IDs to use
            model: AI model to use
            execute_tools: Whether to execute tools
            tool_executor: Tool execution function
        
        Returns:
            Synthesized response with discussion history
        """
        if not agent_ids:
            return {"error": "No agents specified for roundtable mode"}
        
        logger.info(f"Roundtable mode: {len(agent_ids)} agents discussing collaboratively")
        
        # Phase 1: Initial perspectives from each agent
        agent_perspectives = []
        all_tool_calls = []
        all_tool_results = []
        
        for agent_id in agent_ids:
            agent = self.agents.get(agent_id)
            if not agent:
                continue
            
            logger.info(f"  Phase 1: {agent.name} sharing perspective...")
            
            # Get agent's system prompt with roundtable context
            system_prompt = self.get_agent_system_prompt(agent_id, AgentMode.ROUNDTABLE, agent_ids)
            
            # Add context about other agents' perspectives if we have any
            context_messages = messages.copy()
            if agent_perspectives:
                other_perspectives = "\n\n".join([
                    f"{p['agent']['name']}: {p['content']}"
                    for p in agent_perspectives
                ])
                context_messages.append({
                    "role": "system",
                    "content": f"Other team members have shared:\n{other_perspectives}\n\nNow provide your perspective, building on their ideas where relevant."
                })
            
            agent_messages = [
                {"role": "system", "content": system_prompt}
            ] + context_messages
            
            # Get response
            result = await self.ai_service.chat(
                messages=agent_messages,
                model=model,
                execute_tools=execute_tools,
                tool_executor=tool_executor
            )
            
            agent_perspectives.append({
                "agent": {
                    "id": agent.id,
                    "name": agent.name,
                    "role": agent.role,
                    "icon": agent.icon,
                    "color": agent.color
                },
                "content": result.get("content", ""),
                "tool_calls": result.get("tool_calls", [])
            })
            
            all_tool_calls.extend(result.get("tool_calls", []))
            all_tool_results.extend(result.get("tool_results", []))
        
        # Phase 2: Synthesize all perspectives into cohesive response
        logger.info("  Phase 2: Synthesizing team consensus...")
        
        discussion_summary = "\n\n".join([
            f"**{p['agent']['name']}** ({p['agent']['role']}):\n{p['content']}"
            for p in agent_perspectives
        ])
        
        synthesis_prompt = f"""Based on the roundtable discussion below, synthesize a cohesive response that:
1. Combines the best ideas from all team members
2. Resolves any conflicting suggestions
3. Provides a clear, actionable recommendation
4. Acknowledges different perspectives where relevant

Team Discussion:
{discussion_summary}

Provide a synthesized response that represents the team's consensus."""
        
        synthesis_messages = messages + [
            {"role": "system", "content": synthesis_prompt}
        ]
        
        synthesis_result = await self.ai_service.chat(
            messages=synthesis_messages,
            model=model,
            execute_tools=False,  # Don't execute tools in synthesis
            tool_executor=None
        )
        
        return {
            "content": synthesis_result.get("content", ""),
            "mode": "roundtable",
            "discussion": agent_perspectives,
            "synthesis": synthesis_result.get("content", ""),
            "agents": [p["agent"] for p in agent_perspectives],
            "tool_calls": all_tool_calls,
            "tool_results": all_tool_results,
            "phases": [
                "Agents joining discussion",
                "Sharing perspectives",
                "Building consensus",
                "Synthesizing response"
            ]
        }
    
    async def chat(
        self,
        messages: List[Dict[str, Any]],
        mode: str,
        agent_ids: List[str],
        solo_agent: Optional[str] = None,
        model: str = "gpt-4.1-mini",
        execute_tools: bool = True,
        tool_executor: Optional[callable] = None
    ) -> Dict[str, Any]:
        """
        Main chat method that routes to appropriate mode.
        
        Args:
            messages: Chat history
            mode: Collaboration mode ("solo", "team", "roundtable")
            agent_ids: List of agent IDs for team/roundtable
            solo_agent: Agent ID for solo mode
            model: AI model to use
            execute_tools: Whether to execute tools
            tool_executor: Tool execution function
        
        Returns:
            Response dict with mode-specific structure
        """
        try:
            agent_mode = AgentMode(mode)
        except ValueError:
            agent_mode = AgentMode.SOLO
        
        if agent_mode == AgentMode.SOLO:
            agent_to_use = solo_agent or (agent_ids[0] if agent_ids else "architect")
            return await self.chat_solo(
                messages=messages,
                agent_id=agent_to_use,
                model=model,
                execute_tools=execute_tools,
                tool_executor=tool_executor
            )
        
        elif agent_mode == AgentMode.TEAM:
            return await self.chat_team(
                messages=messages,
                agent_ids=agent_ids or ["architect"],
                model=model,
                execute_tools=execute_tools,
                tool_executor=tool_executor
            )
        
        else:  # ROUNDTABLE
            return await self.chat_roundtable(
                messages=messages,
                agent_ids=agent_ids or ["architect", "developer"],
                model=model,
                execute_tools=execute_tools,
                tool_executor=tool_executor
            )


# Singleton instance
_multi_agent_service: Optional[MultiAgentChatService] = None


def get_multi_agent_service(ai_service) -> MultiAgentChatService:
    """Get or create the multi-agent service singleton"""
    global _multi_agent_service
    if _multi_agent_service is None:
        _multi_agent_service = MultiAgentChatService(ai_service)
    return _multi_agent_service
