"""
UE5 AI Studio - Plugin AI Integration Service
==============================================

Service for integrating plugins with the AI chat system.

Version: 2.2.0
"""

import re
import json
import logging
from typing import Optional, List, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession

from services.plugin import PluginService
from services.plugin_executor import ExecutionContext

logger = logging.getLogger(__name__)


class PluginAIService:
    """
    Service for AI-plugin integration.
    
    Handles:
    - Formatting plugin info for AI system prompts
    - Parsing AI responses for plugin invocations
    - Executing plugins triggered by AI
    - Formatting plugin results for AI context
    """
    
    # Pattern to match plugin invocation in AI responses
    PLUGIN_INVOKE_PATTERN = re.compile(
        r'```plugin:(\d+|[\w-]+)\s*\n(.*?)\n```',
        re.DOTALL
    )
    
    # Alternative pattern for JSON-style invocation
    PLUGIN_JSON_PATTERN = re.compile(
        r'<plugin\s+id=["\']?(\d+|[\w-]+)["\']?\s*>\s*(.*?)\s*</plugin>',
        re.DOTALL
    )
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.plugin_service = PluginService(db)
    
    async def get_system_prompt_extension(
        self,
        user_id: int,
        include_examples: bool = True
    ) -> str:
        """
        Generate system prompt extension with available plugins.
        
        Args:
            user_id: User ID
            include_examples: Whether to include usage examples
            
        Returns:
            System prompt extension string
        """
        plugins = await self.plugin_service.get_ai_available_plugins(user_id)
        
        if not plugins:
            return ""
        
        lines = [
            "",
            "## Available Plugins",
            "",
            "You have access to the following custom plugins. To use a plugin, wrap your invocation in a code block with the plugin ID:",
            "",
            "```plugin:<plugin_id>",
            "{",
            '  "param1": "value1",',
            '  "param2": "value2"',
            "}",
            "```",
            "",
            "### Installed Plugins:",
            ""
        ]
        
        for plugin in plugins:
            lines.append(f"#### {plugin['name']} (ID: {plugin['id']})")
            lines.append(f"{plugin['description']}")
            lines.append("")
            
            if plugin.get('input_schema') and plugin['input_schema'].get('properties'):
                lines.append("**Parameters:**")
                for prop_name, prop_info in plugin['input_schema']['properties'].items():
                    prop_type = prop_info.get('type', 'any')
                    prop_desc = prop_info.get('description', '')
                    lines.append(f"- `{prop_name}` ({prop_type}): {prop_desc}")
                lines.append("")
            
            if include_examples and plugin.get('examples'):
                lines.append("**Examples:**")
                for example in plugin['examples'][:2]:
                    if isinstance(example, dict):
                        lines.append(f"```plugin:{plugin['id']}")
                        lines.append(json.dumps(example.get('input', example), indent=2))
                        lines.append("```")
                    else:
                        lines.append(f"- {example}")
                lines.append("")
            
            if plugin.get('requires_mcp'):
                lines.append("*Requires UE5 MCP connection*")
                lines.append("")
            
            if plugin.get('requires_workspace'):
                lines.append("*Requires workspace access*")
                lines.append("")
        
        return "\n".join(lines)
    
    def parse_plugin_invocations(
        self,
        ai_response: str
    ) -> List[Dict[str, Any]]:
        """
        Parse AI response for plugin invocations.
        
        Args:
            ai_response: AI response text
            
        Returns:
            List of plugin invocations with id and input
        """
        invocations = []
        
        # Check for code block style invocations
        for match in self.PLUGIN_INVOKE_PATTERN.finditer(ai_response):
            plugin_id = match.group(1)
            input_json = match.group(2).strip()
            
            try:
                input_data = json.loads(input_json) if input_json else {}
            except json.JSONDecodeError:
                # Try to parse as key-value pairs
                input_data = self._parse_simple_params(input_json)
            
            invocations.append({
                "plugin_id": plugin_id,
                "input_data": input_data,
                "raw_match": match.group(0)
            })
        
        # Check for XML-style invocations
        for match in self.PLUGIN_JSON_PATTERN.finditer(ai_response):
            plugin_id = match.group(1)
            input_json = match.group(2).strip()
            
            try:
                input_data = json.loads(input_json) if input_json else {}
            except json.JSONDecodeError:
                input_data = self._parse_simple_params(input_json)
            
            invocations.append({
                "plugin_id": plugin_id,
                "input_data": input_data,
                "raw_match": match.group(0)
            })
        
        return invocations
    
    def _parse_simple_params(self, text: str) -> Dict[str, Any]:
        """Parse simple key=value or key: value parameters."""
        params = {}
        for line in text.split('\n'):
            line = line.strip()
            if '=' in line:
                key, value = line.split('=', 1)
                params[key.strip()] = value.strip().strip('"\'')
            elif ':' in line:
                key, value = line.split(':', 1)
                params[key.strip()] = value.strip().strip('"\'')
        return params
    
    async def execute_plugin_invocations(
        self,
        user_id: int,
        invocations: List[Dict[str, Any]],
        chat_id: int = None,
        mcp_context: Dict = None,
        workspace_context: Dict = None
    ) -> List[Dict[str, Any]]:
        """
        Execute plugin invocations from AI response.
        
        Args:
            user_id: User ID
            invocations: List of parsed invocations
            chat_id: Optional chat ID
            mcp_context: Optional MCP context
            workspace_context: Optional workspace context
            
        Returns:
            List of execution results
        """
        results = []
        
        for invocation in invocations:
            plugin_id = invocation["plugin_id"]
            input_data = invocation["input_data"]
            
            # Resolve plugin ID (could be numeric or slug)
            try:
                plugin_id_int = int(plugin_id)
            except ValueError:
                # Try to find by slug
                plugin = await self.plugin_service.get_plugin_by_slug(user_id, plugin_id)
                if plugin:
                    plugin_id_int = plugin.id
                else:
                    results.append({
                        "plugin_id": plugin_id,
                        "success": False,
                        "error": f"Plugin not found: {plugin_id}",
                        "raw_match": invocation.get("raw_match")
                    })
                    continue
            
            # Create execution context
            context = ExecutionContext(
                user_id=user_id,
                mcp_client=mcp_context.get("client") if mcp_context else None,
                workspace_path=workspace_context.get("path") if workspace_context else None
            )
            
            # Execute plugin
            result = await self.plugin_service.execute_plugin(
                plugin_id=plugin_id_int,
                user_id=user_id,
                input_data=input_data,
                context=context,
                chat_id=chat_id,
                triggered_by="ai"
            )
            
            result["plugin_id"] = plugin_id
            result["raw_match"] = invocation.get("raw_match")
            results.append(result)
        
        return results
    
    def format_results_for_ai(
        self,
        results: List[Dict[str, Any]]
    ) -> str:
        """
        Format plugin execution results for AI context.
        
        Args:
            results: List of execution results
            
        Returns:
            Formatted string for AI context
        """
        if not results:
            return ""
        
        lines = [
            "",
            "## Plugin Execution Results",
            ""
        ]
        
        for i, result in enumerate(results, 1):
            plugin_id = result.get("plugin_id", "unknown")
            success = result.get("success", False)
            
            lines.append(f"### Plugin {plugin_id} - {'Success' if success else 'Failed'}")
            
            if success:
                output = result.get("output")
                if output:
                    lines.append("**Output:**")
                    lines.append("```json")
                    lines.append(json.dumps(output, indent=2))
                    lines.append("```")
            else:
                error = result.get("error", "Unknown error")
                lines.append(f"**Error:** {error}")
            
            execution_time = result.get("execution_time_ms", 0)
            lines.append(f"*Execution time: {execution_time}ms*")
            lines.append("")
        
        return "\n".join(lines)
    
    def replace_invocations_with_results(
        self,
        ai_response: str,
        results: List[Dict[str, Any]]
    ) -> str:
        """
        Replace plugin invocations in AI response with results.
        
        Args:
            ai_response: Original AI response
            results: Execution results
            
        Returns:
            Modified response with results
        """
        modified_response = ai_response
        
        for result in results:
            raw_match = result.get("raw_match")
            if not raw_match:
                continue
            
            plugin_id = result.get("plugin_id", "unknown")
            success = result.get("success", False)
            
            if success:
                output = result.get("output")
                replacement = f"**Plugin {plugin_id} executed successfully:**\n```json\n{json.dumps(output, indent=2)}\n```"
            else:
                error = result.get("error", "Unknown error")
                replacement = f"**Plugin {plugin_id} failed:** {error}"
            
            modified_response = modified_response.replace(raw_match, replacement)
        
        return modified_response
    
    async def process_ai_response(
        self,
        user_id: int,
        ai_response: str,
        chat_id: int = None,
        mcp_context: Dict = None,
        workspace_context: Dict = None,
        auto_execute: bool = True
    ) -> Tuple[str, List[Dict[str, Any]]]:
        """
        Process AI response for plugin invocations.
        
        Args:
            user_id: User ID
            ai_response: AI response text
            chat_id: Optional chat ID
            mcp_context: Optional MCP context
            workspace_context: Optional workspace context
            auto_execute: Whether to auto-execute plugins
            
        Returns:
            Tuple of (modified response, execution results)
        """
        # Parse invocations
        invocations = self.parse_plugin_invocations(ai_response)
        
        if not invocations:
            return ai_response, []
        
        logger.info(f"Found {len(invocations)} plugin invocations in AI response")
        
        if not auto_execute:
            return ai_response, [{"pending": True, **inv} for inv in invocations]
        
        # Execute plugins
        results = await self.execute_plugin_invocations(
            user_id=user_id,
            invocations=invocations,
            chat_id=chat_id,
            mcp_context=mcp_context,
            workspace_context=workspace_context
        )
        
        # Replace invocations with results
        modified_response = self.replace_invocations_with_results(ai_response, results)
        
        return modified_response, results


async def enhance_ai_prompt_with_plugins(
    db: AsyncSession,
    user_id: int,
    system_prompt: str
) -> str:
    """
    Enhance AI system prompt with available plugins.
    
    Args:
        db: Database session
        user_id: User ID
        system_prompt: Original system prompt
        
    Returns:
        Enhanced system prompt
    """
    service = PluginAIService(db)
    extension = await service.get_system_prompt_extension(user_id)
    
    if extension:
        return system_prompt + extension
    
    return system_prompt


async def process_ai_response_for_plugins(
    db: AsyncSession,
    user_id: int,
    ai_response: str,
    chat_id: int = None,
    mcp_context: Dict = None,
    workspace_context: Dict = None
) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Process AI response for plugin invocations.
    
    Args:
        db: Database session
        user_id: User ID
        ai_response: AI response text
        chat_id: Optional chat ID
        mcp_context: Optional MCP context
        workspace_context: Optional workspace context
        
    Returns:
        Tuple of (modified response, execution results)
    """
    service = PluginAIService(db)
    return await service.process_ai_response(
        user_id=user_id,
        ai_response=ai_response,
        chat_id=chat_id,
        mcp_context=mcp_context,
        workspace_context=workspace_context
    )
