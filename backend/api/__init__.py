from fastapi import APIRouter
from api.auth import router as auth_router
from api.projects import router as projects_router
from api.chats import router as chats_router
from api.agents import router as agents_router
from api.mcp import router as mcp_router
from api.ai import router as ai_router
from api.preferences import router as preferences_router
from api.memory import router as memory_router
from api.workspace import router as workspace_router
from api.workspace_ai import router as workspace_ai_router
from api.plugin import router as plugin_router
from api.websocket import router as websocket_router
from api.comparison import router as comparison_router
from api.rbac import router as rbac_router
from api.subscription import router as subscription_router
from api.team import router as team_router
from api.rate_limit import router as rate_limit_router
from api.sso import router as sso_router
from api.analytics import router as analytics_router
from api.mcp_ai import router as mcp_ai_router
from api.downloads import router as downloads_router
from api.agent import router as agent_router
from api.ai_chat import router as ai_chat_router
from api.viewport import router as viewport_router
from api.scene_builder import router as scene_builder_router
from api.action_history import router as action_history_router
from api.blueprint_material import router as blueprint_material_router
from api.texture_generator import router as texture_generator_router
from api.scene_analyzer import router as scene_analyzer_router
from api.performance import router as performance_router
from api.assets import router as assets_router
from api.lighting import router as lighting_router
from api.animation import router as animation_router
from api.collaboration import router as collaboration_router
from api.collaboration_ws import router as collaboration_ws_router
from api.scene_generator import router as scene_generator_router
from api.advanced_ai import router as advanced_ai_router
from api.api_keys import router as api_keys_router
from api.admin import router as admin_router
from api.connection import router as connection_router

api_router = APIRouter(prefix="/api")

api_router.include_router(auth_router)
api_router.include_router(projects_router)
api_router.include_router(chats_router)
api_router.include_router(agents_router)
api_router.include_router(mcp_router)
api_router.include_router(ai_router)
api_router.include_router(preferences_router)
api_router.include_router(memory_router)
api_router.include_router(workspace_router)
api_router.include_router(workspace_ai_router)
api_router.include_router(plugin_router)
api_router.include_router(websocket_router)
api_router.include_router(comparison_router)
api_router.include_router(rbac_router)
api_router.include_router(subscription_router)
api_router.include_router(team_router)
api_router.include_router(rate_limit_router)
api_router.include_router(sso_router)
api_router.include_router(analytics_router)
api_router.include_router(mcp_ai_router)
api_router.include_router(downloads_router)
api_router.include_router(agent_router)
api_router.include_router(ai_chat_router)
api_router.include_router(viewport_router)
api_router.include_router(scene_builder_router)
api_router.include_router(action_history_router)
api_router.include_router(blueprint_material_router)
api_router.include_router(texture_generator_router)
api_router.include_router(scene_analyzer_router)
api_router.include_router(performance_router)
api_router.include_router(assets_router)
api_router.include_router(lighting_router)
api_router.include_router(animation_router)
api_router.include_router(collaboration_router)
api_router.include_router(collaboration_ws_router)
api_router.include_router(scene_generator_router)
api_router.include_router(advanced_ai_router)
api_router.include_router(api_keys_router)
api_router.include_router(admin_router)
api_router.include_router(connection_router)

__all__ = ["api_router"]
