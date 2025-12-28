from services.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_token,
    get_user_by_email,
    get_user_by_username,
    get_user_by_id,
    authenticate_user,
    create_user,
    get_current_user,
    get_current_active_admin
)
from services.ai import AIService, AgentOrchestrator, ai_service, orchestrator
from services.mcp import MCPClient, MCPConnectionManager, mcp_manager
from services.workspace import WorkspaceService, get_workspace_service
from services.plugin import PluginService
from services.plugin_executor import PluginExecutor, ExecutionContext, execute_plugin
from services.plugin_ai import (
    PluginAIService,
    enhance_ai_prompt_with_plugins,
    process_ai_response_for_plugins
)
from services.websocket import (
    ConnectionManager,
    Connection,
    WebSocketMessage,
    EventType,
    connection_manager
)
from services.presence import (
    PresenceService,
    UserPresence,
    UserStatus,
    presence_service
)
from services.realtime_chat import (
    RealtimeChatService,
    realtime_chat
)
from services.realtime_workspace import (
    RealtimeWorkspaceService,
    realtime_workspace
)
from services.comparison import (
    ComparisonService,
    comparison_service
)
from services.rbac import (
    RBACService,
    PermissionCache,
    rbac_service
)

__all__ = [
    # Auth
    "verify_password",
    "get_password_hash",
    "create_access_token",
    "decode_token",
    "get_user_by_email",
    "get_user_by_username",
    "get_user_by_id",
    "authenticate_user",
    "create_user",
    "get_current_user",
    "get_current_active_admin",
    # AI
    "AIService",
    "AgentOrchestrator",
    "ai_service",
    "orchestrator",
    # MCP
    "MCPClient",
    "MCPConnectionManager",
    "mcp_manager",
    # Workspace
    "WorkspaceService",
    "get_workspace_service",
    # Plugins
    "PluginService",
    "PluginExecutor",
    "ExecutionContext",
    "execute_plugin",
    "PluginAIService",
    "enhance_ai_prompt_with_plugins",
    "process_ai_response_for_plugins",
    # WebSocket
    "ConnectionManager",
    "Connection",
    "WebSocketMessage",
    "EventType",
    "connection_manager",
    # Presence
    "PresenceService",
    "UserPresence",
    "UserStatus",
    "presence_service",
    # Real-time Chat
    "RealtimeChatService",
    "realtime_chat",
    # Real-time Workspace
    "RealtimeWorkspaceService",
    "realtime_workspace",
    # Comparison
    "ComparisonService",
    "comparison_service",
    # RBAC
    "RBACService",
    "PermissionCache",
    "rbac_service"
]
