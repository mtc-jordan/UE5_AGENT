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

__all__ = ["api_router"]
