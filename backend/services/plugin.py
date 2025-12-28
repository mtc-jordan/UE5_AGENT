"""
UE5 AI Studio - Plugin Management Service
==========================================

Service for managing plugins: CRUD, installation, execution, and marketplace.

Version: 2.2.0
"""

import re
import logging
from typing import Optional, List, Dict, Any
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, func, or_, and_
from sqlalchemy.orm import selectinload

from models.plugin import (
    Plugin, PluginExecution, PluginInstallation, PluginTemplate,
    PluginCategory, PluginStatus, PluginVisibility, DEFAULT_PLUGIN_TEMPLATES
)
from services.plugin_executor import (
    PluginExecutor, ExecutionContext, CodeValidator, execute_plugin
)

logger = logging.getLogger(__name__)


class PluginService:
    """
    Service for plugin management.
    
    Handles:
    - Plugin CRUD operations
    - Plugin installation/uninstallation
    - Plugin execution with tracking
    - Marketplace features (public plugins, ratings)
    - Template management
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.executor = PluginExecutor()
    
    # =========================================================================
    # SLUG GENERATION
    # =========================================================================
    
    @staticmethod
    def generate_slug(name: str) -> str:
        """Generate a URL-friendly slug from name."""
        slug = name.lower()
        slug = re.sub(r'[^a-z0-9\s-]', '', slug)
        slug = re.sub(r'[\s_]+', '-', slug)
        slug = re.sub(r'-+', '-', slug)
        slug = slug.strip('-')
        return slug[:100]
    
    async def _ensure_unique_slug(self, user_id: int, slug: str, exclude_id: int = None) -> str:
        """Ensure slug is unique for user, append number if needed."""
        base_slug = slug
        counter = 1
        
        while True:
            query = select(Plugin).where(
                Plugin.author_id == user_id,
                Plugin.slug == slug
            )
            if exclude_id:
                query = query.where(Plugin.id != exclude_id)
            
            result = await self.db.execute(query)
            existing = result.scalar_one_or_none()
            
            if not existing:
                return slug
            
            slug = f"{base_slug}-{counter}"
            counter += 1
    
    # =========================================================================
    # PLUGIN CRUD
    # =========================================================================
    
    async def create_plugin(
        self,
        user_id: int,
        name: str,
        code: str,
        description: str = None,
        category: PluginCategory = PluginCategory.CUSTOM,
        tags: List[str] = None,
        config_schema: Dict = None,
        input_schema: Dict = None,
        output_schema: Dict = None,
        ai_description: str = None,
        ai_examples: List[Dict] = None,
        requires_mcp: bool = False,
        requires_workspace: bool = False,
        allowed_imports: List[str] = None,
        timeout_seconds: int = 30
    ) -> Plugin:
        """
        Create a new plugin.
        
        Args:
            user_id: Author user ID
            name: Plugin name
            code: Plugin Python code
            description: Plugin description
            category: Plugin category
            tags: List of tags
            config_schema: JSON Schema for configuration
            input_schema: JSON Schema for input
            output_schema: JSON Schema for output
            ai_description: Description for AI
            ai_examples: Example invocations for AI
            requires_mcp: Whether MCP is required
            requires_workspace: Whether workspace access is required
            allowed_imports: List of allowed imports
            timeout_seconds: Execution timeout
            
        Returns:
            Created plugin
        """
        # Validate code
        is_valid, error = CodeValidator.validate(code, allowed_imports)
        if not is_valid:
            raise ValueError(f"Invalid plugin code: {error}")
        
        # Generate unique slug
        slug = self.generate_slug(name)
        slug = await self._ensure_unique_slug(user_id, slug)
        
        plugin = Plugin(
            author_id=user_id,
            name=name,
            slug=slug,
            description=description,
            code=code,
            category=category,
            tags=tags or [],
            config_schema=config_schema or {},
            input_schema=input_schema or {},
            output_schema=output_schema or {},
            ai_description=ai_description,
            ai_examples=ai_examples or [],
            requires_mcp=requires_mcp,
            requires_workspace=requires_workspace,
            allowed_imports=allowed_imports or [],
            timeout_seconds=timeout_seconds,
            status=PluginStatus.DRAFT,
            visibility=PluginVisibility.PRIVATE
        )
        
        self.db.add(plugin)
        await self.db.commit()
        await self.db.refresh(plugin)
        
        logger.info(f"Created plugin {plugin.id}: {name}")
        return plugin
    
    async def get_plugin(self, plugin_id: int, user_id: int = None) -> Optional[Plugin]:
        """
        Get a plugin by ID.
        
        Args:
            plugin_id: Plugin ID
            user_id: Optional user ID for access check
            
        Returns:
            Plugin or None
        """
        query = select(Plugin).where(Plugin.id == plugin_id)
        result = await self.db.execute(query)
        plugin = result.scalar_one_or_none()
        
        if not plugin:
            return None
        
        # Check access
        if user_id and plugin.visibility == PluginVisibility.PRIVATE:
            if plugin.author_id != user_id:
                return None
        
        return plugin
    
    async def get_plugin_by_slug(self, user_id: int, slug: str) -> Optional[Plugin]:
        """Get a plugin by author and slug."""
        query = select(Plugin).where(
            Plugin.author_id == user_id,
            Plugin.slug == slug
        )
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def update_plugin(
        self,
        plugin_id: int,
        user_id: int,
        **updates
    ) -> Optional[Plugin]:
        """
        Update a plugin.
        
        Args:
            plugin_id: Plugin ID
            user_id: User ID (must be author)
            **updates: Fields to update
            
        Returns:
            Updated plugin or None
        """
        plugin = await self.get_plugin(plugin_id)
        if not plugin or plugin.author_id != user_id:
            return None
        
        # Validate code if being updated
        if 'code' in updates:
            allowed_imports = updates.get('allowed_imports', plugin.allowed_imports)
            is_valid, error = CodeValidator.validate(updates['code'], allowed_imports)
            if not is_valid:
                raise ValueError(f"Invalid plugin code: {error}")
        
        # Update name -> regenerate slug
        if 'name' in updates and updates['name'] != plugin.name:
            slug = self.generate_slug(updates['name'])
            updates['slug'] = await self._ensure_unique_slug(user_id, slug, plugin_id)
        
        # Apply updates
        for key, value in updates.items():
            if hasattr(plugin, key):
                setattr(plugin, key, value)
        
        plugin.updated_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(plugin)
        
        logger.info(f"Updated plugin {plugin_id}")
        return plugin
    
    async def delete_plugin(self, plugin_id: int, user_id: int) -> bool:
        """
        Delete a plugin.
        
        Args:
            plugin_id: Plugin ID
            user_id: User ID (must be author)
            
        Returns:
            True if deleted
        """
        plugin = await self.get_plugin(plugin_id)
        if not plugin or plugin.author_id != user_id:
            return False
        
        await self.db.delete(plugin)
        await self.db.commit()
        
        logger.info(f"Deleted plugin {plugin_id}")
        return True
    
    async def list_user_plugins(
        self,
        user_id: int,
        category: PluginCategory = None,
        status: PluginStatus = None,
        search: str = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Plugin]:
        """
        List plugins created by a user.
        
        Args:
            user_id: User ID
            category: Filter by category
            status: Filter by status
            search: Search in name/description
            limit: Max results
            offset: Offset for pagination
            
        Returns:
            List of plugins
        """
        query = select(Plugin).where(Plugin.author_id == user_id)
        
        if category:
            query = query.where(Plugin.category == category)
        
        if status:
            query = query.where(Plugin.status == status)
        
        if search:
            query = query.where(
                or_(
                    Plugin.name.ilike(f"%{search}%"),
                    Plugin.description.ilike(f"%{search}%")
                )
            )
        
        query = query.order_by(Plugin.updated_at.desc())
        query = query.limit(limit).offset(offset)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    # =========================================================================
    # MARKETPLACE
    # =========================================================================
    
    async def list_public_plugins(
        self,
        category: PluginCategory = None,
        search: str = None,
        sort_by: str = "popular",
        limit: int = 50,
        offset: int = 0
    ) -> List[Plugin]:
        """
        List public plugins in the marketplace.
        
        Args:
            category: Filter by category
            search: Search in name/description
            sort_by: Sort order (popular, recent, rating)
            limit: Max results
            offset: Offset
            
        Returns:
            List of public plugins
        """
        query = select(Plugin).where(
            Plugin.visibility == PluginVisibility.PUBLIC,
            Plugin.status == PluginStatus.ACTIVE
        )
        
        if category:
            query = query.where(Plugin.category == category)
        
        if search:
            query = query.where(
                or_(
                    Plugin.name.ilike(f"%{search}%"),
                    Plugin.description.ilike(f"%{search}%"),
                    Plugin.tags.contains([search])
                )
            )
        
        # Sorting
        if sort_by == "popular":
            query = query.order_by(Plugin.execution_count.desc())
        elif sort_by == "recent":
            query = query.order_by(Plugin.published_at.desc())
        elif sort_by == "rating":
            query = query.order_by(
                (Plugin.rating_sum / func.nullif(Plugin.rating_count, 0)).desc()
            )
        
        query = query.limit(limit).offset(offset)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def publish_plugin(self, plugin_id: int, user_id: int) -> Optional[Plugin]:
        """
        Publish a plugin to the marketplace.
        
        Args:
            plugin_id: Plugin ID
            user_id: User ID (must be author)
            
        Returns:
            Published plugin or None
        """
        plugin = await self.get_plugin(plugin_id)
        if not plugin or plugin.author_id != user_id:
            return None
        
        plugin.visibility = PluginVisibility.PUBLIC
        plugin.status = PluginStatus.ACTIVE
        plugin.published_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(plugin)
        
        logger.info(f"Published plugin {plugin_id}")
        return plugin
    
    async def unpublish_plugin(self, plugin_id: int, user_id: int) -> Optional[Plugin]:
        """Unpublish a plugin from the marketplace."""
        plugin = await self.get_plugin(plugin_id)
        if not plugin or plugin.author_id != user_id:
            return None
        
        plugin.visibility = PluginVisibility.PRIVATE
        
        await self.db.commit()
        await self.db.refresh(plugin)
        
        return plugin
    
    async def rate_plugin(
        self,
        plugin_id: int,
        user_id: int,
        rating: int
    ) -> Optional[Plugin]:
        """
        Rate a plugin (1-5 stars).
        
        Args:
            plugin_id: Plugin ID
            user_id: User ID
            rating: Rating 1-5
            
        Returns:
            Updated plugin
        """
        if rating < 1 or rating > 5:
            raise ValueError("Rating must be between 1 and 5")
        
        plugin = await self.get_plugin(plugin_id)
        if not plugin:
            return None
        
        # Simple rating (could be enhanced with per-user tracking)
        plugin.rating_sum += rating
        plugin.rating_count += 1
        
        await self.db.commit()
        await self.db.refresh(plugin)
        
        return plugin
    
    # =========================================================================
    # INSTALLATION
    # =========================================================================
    
    async def install_plugin(
        self,
        plugin_id: int,
        user_id: int,
        config: Dict = None
    ) -> Optional[PluginInstallation]:
        """
        Install a plugin for a user.
        
        Args:
            plugin_id: Plugin ID
            user_id: User ID
            config: Custom configuration
            
        Returns:
            Installation record
        """
        plugin = await self.get_plugin(plugin_id, user_id)
        if not plugin:
            return None
        
        # Check if already installed
        query = select(PluginInstallation).where(
            PluginInstallation.plugin_id == plugin_id,
            PluginInstallation.user_id == user_id
        )
        result = await self.db.execute(query)
        existing = result.scalar_one_or_none()
        
        if existing:
            # Update config if provided
            if config:
                existing.config = config
                await self.db.commit()
                await self.db.refresh(existing)
            return existing
        
        # Create installation
        installation = PluginInstallation(
            plugin_id=plugin_id,
            user_id=user_id,
            config=config or plugin.default_config,
            is_enabled=True
        )
        
        self.db.add(installation)
        await self.db.commit()
        await self.db.refresh(installation)
        
        logger.info(f"User {user_id} installed plugin {plugin_id}")
        return installation
    
    async def uninstall_plugin(self, plugin_id: int, user_id: int) -> bool:
        """Uninstall a plugin for a user."""
        query = delete(PluginInstallation).where(
            PluginInstallation.plugin_id == plugin_id,
            PluginInstallation.user_id == user_id
        )
        result = await self.db.execute(query)
        await self.db.commit()
        
        return result.rowcount > 0
    
    async def get_installed_plugins(
        self,
        user_id: int,
        enabled_only: bool = True
    ) -> List[PluginInstallation]:
        """Get all installed plugins for a user."""
        query = select(PluginInstallation).where(
            PluginInstallation.user_id == user_id
        ).options(selectinload(PluginInstallation.plugin))
        
        if enabled_only:
            query = query.where(PluginInstallation.is_enabled == True)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def toggle_plugin(
        self,
        plugin_id: int,
        user_id: int,
        enabled: bool
    ) -> Optional[PluginInstallation]:
        """Enable or disable an installed plugin."""
        query = select(PluginInstallation).where(
            PluginInstallation.plugin_id == plugin_id,
            PluginInstallation.user_id == user_id
        )
        result = await self.db.execute(query)
        installation = result.scalar_one_or_none()
        
        if not installation:
            return None
        
        installation.is_enabled = enabled
        await self.db.commit()
        await self.db.refresh(installation)
        
        return installation
    
    # =========================================================================
    # EXECUTION
    # =========================================================================
    
    async def execute_plugin(
        self,
        plugin_id: int,
        user_id: int,
        input_data: Dict[str, Any] = None,
        context: ExecutionContext = None,
        chat_id: int = None,
        triggered_by: str = "user"
    ) -> Dict[str, Any]:
        """
        Execute a plugin.
        
        Args:
            plugin_id: Plugin ID
            user_id: User ID
            input_data: Input parameters
            context: Execution context
            chat_id: Optional chat ID for tracking
            triggered_by: Who triggered (user, ai, scheduled)
            
        Returns:
            Execution result
        """
        plugin = await self.get_plugin(plugin_id, user_id)
        if not plugin:
            return {
                "success": False,
                "error": "Plugin not found or access denied"
            }
        
        if plugin.status != PluginStatus.ACTIVE and plugin.author_id != user_id:
            return {
                "success": False,
                "error": "Plugin is not active"
            }
        
        # Create execution record
        execution = PluginExecution(
            plugin_id=plugin_id,
            user_id=user_id,
            chat_id=chat_id,
            input_data=input_data or {},
            triggered_by=triggered_by
        )
        self.db.add(execution)
        await self.db.commit()
        
        # Setup context
        if context is None:
            context = ExecutionContext(
                user_id=user_id,
                config=plugin.default_config
            )
        
        # Execute
        result = await execute_plugin(
            code=plugin.code,
            input_data=input_data,
            context=context,
            timeout=plugin.timeout_seconds
        )
        
        # Update execution record
        execution.success = result.get("success", False)
        execution.output_data = result.get("output")
        execution.error_message = result.get("error")
        execution.execution_time_ms = result.get("execution_time_ms", 0)
        execution.completed_at = datetime.utcnow()
        
        # Update plugin stats
        plugin.execution_count += 1
        if result.get("success"):
            plugin.success_count += 1
        else:
            plugin.error_count += 1
        
        # Update average execution time
        total_time = plugin.avg_execution_time_ms * (plugin.execution_count - 1)
        plugin.avg_execution_time_ms = int(
            (total_time + execution.execution_time_ms) / plugin.execution_count
        )
        
        # Update installation last used
        if triggered_by == "user":
            query = select(PluginInstallation).where(
                PluginInstallation.plugin_id == plugin_id,
                PluginInstallation.user_id == user_id
            )
            inst_result = await self.db.execute(query)
            installation = inst_result.scalar_one_or_none()
            if installation:
                installation.last_used_at = datetime.utcnow()
        
        await self.db.commit()
        
        logger.info(
            f"Executed plugin {plugin_id} for user {user_id}: "
            f"success={result.get('success')}, time={result.get('execution_time_ms')}ms"
        )
        
        return result
    
    async def get_execution_history(
        self,
        user_id: int,
        plugin_id: int = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[PluginExecution]:
        """Get execution history for a user."""
        query = select(PluginExecution).where(
            PluginExecution.user_id == user_id
        )
        
        if plugin_id:
            query = query.where(PluginExecution.plugin_id == plugin_id)
        
        query = query.order_by(PluginExecution.started_at.desc())
        query = query.limit(limit).offset(offset)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    # =========================================================================
    # TEMPLATES
    # =========================================================================
    
    async def get_templates(
        self,
        category: PluginCategory = None
    ) -> List[PluginTemplate]:
        """Get plugin templates."""
        query = select(PluginTemplate)
        
        if category:
            query = query.where(PluginTemplate.category == category)
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def create_from_template(
        self,
        user_id: int,
        template_id: int,
        name: str
    ) -> Plugin:
        """Create a plugin from a template."""
        query = select(PluginTemplate).where(PluginTemplate.id == template_id)
        result = await self.db.execute(query)
        template = result.scalar_one_or_none()
        
        if not template:
            raise ValueError("Template not found")
        
        return await self.create_plugin(
            user_id=user_id,
            name=name,
            code=template.code,
            description=f"Created from template: {template.name}",
            category=template.category,
            config_schema=template.default_config_schema,
            input_schema=template.default_input_schema,
            output_schema=template.default_output_schema
        )
    
    async def seed_templates(self):
        """Seed default plugin templates."""
        for template_data in DEFAULT_PLUGIN_TEMPLATES:
            # Check if exists
            query = select(PluginTemplate).where(
                PluginTemplate.name == template_data["name"]
            )
            result = await self.db.execute(query)
            existing = result.scalar_one_or_none()
            
            if not existing:
                template = PluginTemplate(
                    name=template_data["name"],
                    description=template_data["description"],
                    category=template_data["category"],
                    code=template_data["code"],
                    difficulty=template_data["difficulty"],
                    estimated_time_minutes=template_data["estimated_time_minutes"],
                    default_config_schema={},
                    default_input_schema=template_data.get("default_input_schema", {}),
                    default_output_schema=template_data.get("default_output_schema", {})
                )
                self.db.add(template)
        
        await self.db.commit()
        logger.info("Seeded plugin templates")
    
    # =========================================================================
    # AI INTEGRATION
    # =========================================================================
    
    async def get_ai_available_plugins(
        self,
        user_id: int
    ) -> List[Dict[str, Any]]:
        """
        Get plugins available for AI to use.
        
        Returns plugin info formatted for AI system prompts.
        """
        # Get user's installed plugins
        installations = await self.get_installed_plugins(user_id, enabled_only=True)
        
        # Get user's own active plugins
        own_plugins = await self.list_user_plugins(
            user_id,
            status=PluginStatus.ACTIVE
        )
        
        # Combine and format
        plugins = []
        seen_ids = set()
        
        for inst in installations:
            if inst.plugin_id not in seen_ids:
                seen_ids.add(inst.plugin_id)
                plugin = inst.plugin
                plugins.append({
                    "id": plugin.id,
                    "name": plugin.name,
                    "slug": plugin.slug,
                    "description": plugin.ai_description or plugin.description,
                    "input_schema": plugin.input_schema,
                    "output_schema": plugin.output_schema,
                    "examples": plugin.ai_examples,
                    "requires_mcp": plugin.requires_mcp,
                    "requires_workspace": plugin.requires_workspace
                })
        
        for plugin in own_plugins:
            if plugin.id not in seen_ids:
                seen_ids.add(plugin.id)
                plugins.append({
                    "id": plugin.id,
                    "name": plugin.name,
                    "slug": plugin.slug,
                    "description": plugin.ai_description or plugin.description,
                    "input_schema": plugin.input_schema,
                    "output_schema": plugin.output_schema,
                    "examples": plugin.ai_examples,
                    "requires_mcp": plugin.requires_mcp,
                    "requires_workspace": plugin.requires_workspace
                })
        
        return plugins
    
    def format_plugins_for_ai(self, plugins: List[Dict[str, Any]]) -> str:
        """Format plugin list for AI system prompt."""
        if not plugins:
            return ""
        
        lines = [
            "## Available Plugins",
            "",
            "You can use the following plugins by calling them with the specified input:",
            ""
        ]
        
        for plugin in plugins:
            lines.append(f"### {plugin['name']} (ID: {plugin['id']})")
            lines.append(f"{plugin['description']}")
            lines.append("")
            
            if plugin.get('input_schema'):
                lines.append("**Input:**")
                lines.append(f"```json")
                lines.append(str(plugin['input_schema']))
                lines.append("```")
                lines.append("")
            
            if plugin.get('examples'):
                lines.append("**Examples:**")
                for ex in plugin['examples'][:2]:
                    lines.append(f"- {ex}")
                lines.append("")
        
        return "\n".join(lines)
