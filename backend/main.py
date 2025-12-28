"""
UE5 AI Studio - FastAPI Backend
===============================

AI-powered development assistant for Unreal Engine 5 with:
- Multi-agent AI chat system
- MCP (Model Context Protocol) integration
- Project and chat management
- Real-time streaming responses
- Real-time collaboration with WebSocket

Version: 2.1.0
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import os
import sys
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Ensure backend directory is in path for imports
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from core.config import settings
from core.database import init_db, engine, async_session
from api import api_router
from models.agent import Agent, DEFAULT_AGENTS
from services.mcp import mcp_manager
from services.presence import presence_service
from services.realtime_chat import realtime_chat
from services.realtime_workspace import realtime_workspace
from services.agent_relay import agent_relay
from api.viewport import set_agent_relay_service


async def seed_default_agents():
    """Seed default agents if they don't exist."""
    from sqlalchemy import select
    
    async with async_session() as db:
        # Check if default agents exist
        result = await db.execute(select(Agent).where(Agent.is_default == True))
        existing = result.scalars().all()
        
        if not existing:
            for agent_data in DEFAULT_AGENTS:
                agent = Agent(
                    user_id=None,
                    key=agent_data["key"],
                    name=agent_data["name"],
                    description=agent_data["description"],
                    system_prompt=agent_data["system_prompt"],
                    color=agent_data["color"],
                    icon=agent_data["icon"],
                    is_default=True
                )
                db.add(agent)
            await db.commit()
            logger.info("Default agents seeded successfully")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan events.
    
    Handles:
    - Database initialization
    - Default data seeding
    - Real-time services startup
    - MCP connection cleanup on shutdown
    """
    # Startup
    logger.info(f"Starting {settings.APP_NAME} v2.1.0...")
    
    # Initialize database
    await init_db()
    logger.info("Database initialized")
    
    # Seed default data
    await seed_default_agents()
    
    # Start real-time services
    await presence_service.start()
    await realtime_chat.start()
    await realtime_workspace.start()
    await agent_relay.start()
    set_agent_relay_service(agent_relay)
    logger.info("Real-time services started")
    
    logger.info(f"{settings.APP_NAME} is ready!")
    
    yield
    
    # Shutdown
    logger.info("Shutting down...")
    
    # Stop real-time services
    await agent_relay.stop()
    await realtime_workspace.stop()
    await realtime_chat.stop()
    await presence_service.stop()
    logger.info("Real-time services stopped")
    
    # Gracefully close all MCP connections
    await mcp_manager.shutdown()
    logger.info("MCP connections closed")
    
    # Close database connections
    await engine.dispose()
    logger.info("Database connections closed")
    
    logger.info("Shutdown complete")


app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered development assistant for Unreal Engine 5",
    version="2.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router)


@app.get("/health")
async def health_check():
    """
    Health check endpoint.
    
    Returns basic application health status.
    """
    from services.websocket import connection_manager
    
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": "2.1.0",
        "websocket_connections": connection_manager.connection_count,
        "online_users": len(presence_service.get_online_users())
    }


@app.get("/api/info")
async def app_info():
    """
    Application information endpoint.
    
    Returns detailed information about the application.
    """
    return {
        "name": settings.APP_NAME,
        "version": "2.1.0",
        "description": "AI-powered development assistant for Unreal Engine 5",
        "features": [
            "Multi-agent AI chat (Solo, Team, Roundtable modes)",
            "MCP integration with 101 UE5 editor tools",
            "Project and chat management",
            "Agent memory for context persistence",
            "Real-time streaming responses",
            "Real-time collaboration with WebSocket",
            "Persistent file workspace",
            "Plugin system with custom Python tools",
            "Multi-provider AI support (DeepSeek, Claude, Gemini)"
        ],
        "mcp_tools_count": 101,
        "supported_ai_providers": ["DeepSeek", "Anthropic Claude", "Google Gemini"]
    }


# Serve static files (frontend) in production
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=5000,
        reload=settings.DEBUG
    )
