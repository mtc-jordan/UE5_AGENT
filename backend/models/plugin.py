"""
UE5 AI Studio - Plugin Models
==============================

Database models for the plugin system.

Version: 2.2.0
"""

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, ForeignKey,
    Enum as SQLEnum, JSON, UniqueConstraint, Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from datetime import datetime
import enum

from core.database import Base


class PluginCategory(enum.Enum):
    """Plugin categories."""
    UTILITY = "utility"
    CODE_GENERATION = "code_generation"
    ASSET_MANAGEMENT = "asset_management"
    LEVEL_DESIGN = "level_design"
    ANIMATION = "animation"
    AUDIO = "audio"
    UI_UX = "ui_ux"
    DEBUGGING = "debugging"
    OPTIMIZATION = "optimization"
    INTEGRATION = "integration"
    CUSTOM = "custom"


class PluginStatus(enum.Enum):
    """Plugin status."""
    DRAFT = "draft"
    ACTIVE = "active"
    DISABLED = "disabled"
    DEPRECATED = "deprecated"


class PluginVisibility(enum.Enum):
    """Plugin visibility."""
    PRIVATE = "private"
    PUBLIC = "public"
    SHARED = "shared"  # Shared with specific users


class Plugin(Base):
    """
    Plugin model for custom Python tools.
    
    Plugins are user-created Python scripts that extend the platform's
    capabilities. They can be invoked by AI agents or manually by users.
    """
    __tablename__ = "plugins"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Basic info
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=False, index=True)
    description = Column(Text, nullable=True)
    version = Column(String(20), default="1.0.0")
    
    # Categorization
    category = Column(SQLEnum(PluginCategory), default=PluginCategory.CUSTOM)
    tags = Column(JSON, default=list)  # List of string tags
    
    # Status and visibility
    status = Column(SQLEnum(PluginStatus), default=PluginStatus.DRAFT)
    visibility = Column(SQLEnum(PluginVisibility), default=PluginVisibility.PRIVATE)
    
    # Code
    code = Column(Text, nullable=False)
    entry_function = Column(String(100), default="main")
    
    # Configuration schema (JSON Schema format)
    config_schema = Column(JSON, default=dict)
    default_config = Column(JSON, default=dict)
    
    # Input/Output schema for AI integration
    input_schema = Column(JSON, default=dict)
    output_schema = Column(JSON, default=dict)
    
    # AI integration
    ai_description = Column(Text, nullable=True)  # Description for AI to understand when to use
    ai_examples = Column(JSON, default=list)  # Example invocations for AI
    
    # Permissions and security
    requires_mcp = Column(Boolean, default=False)  # Requires MCP connection
    requires_workspace = Column(Boolean, default=False)  # Requires workspace access
    allowed_imports = Column(JSON, default=list)  # Allowed Python imports
    timeout_seconds = Column(Integer, default=30)  # Execution timeout
    max_memory_mb = Column(Integer, default=256)  # Memory limit
    
    # Ownership
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Statistics
    execution_count = Column(Integer, default=0)
    success_count = Column(Integer, default=0)
    error_count = Column(Integer, default=0)
    avg_execution_time_ms = Column(Integer, default=0)
    
    # Ratings (for public plugins)
    rating_sum = Column(Integer, default=0)
    rating_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())
    published_at = Column(DateTime, nullable=True)
    
    # Relationships
    author = relationship("User", back_populates="plugins")
    executions = relationship("PluginExecution", back_populates="plugin", cascade="all, delete-orphan")
    installations = relationship("PluginInstallation", back_populates="plugin", cascade="all, delete-orphan")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("author_id", "slug", name="uq_plugin_author_slug"),
        Index("ix_plugin_category", "category"),
        Index("ix_plugin_status", "status"),
        Index("ix_plugin_visibility", "visibility"),
    )
    
    @property
    def rating(self) -> float:
        """Calculate average rating."""
        if self.rating_count == 0:
            return 0.0
        return self.rating_sum / self.rating_count
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate."""
        if self.execution_count == 0:
            return 0.0
        return self.success_count / self.execution_count * 100


class PluginExecution(Base):
    """
    Plugin execution history.
    
    Tracks each execution of a plugin for debugging and analytics.
    """
    __tablename__ = "plugin_executions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # References
    plugin_id = Column(Integer, ForeignKey("plugins.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    chat_id = Column(Integer, ForeignKey("chats.id"), nullable=True)
    
    # Execution details
    input_data = Column(JSON, default=dict)
    output_data = Column(JSON, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # Status
    success = Column(Boolean, default=False)
    execution_time_ms = Column(Integer, default=0)
    memory_used_mb = Column(Integer, default=0)
    
    # Context
    triggered_by = Column(String(50), default="user")  # user, ai, scheduled
    
    # Timestamps
    started_at = Column(DateTime, default=func.now())
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    plugin = relationship("Plugin", back_populates="executions")
    user = relationship("User")
    
    # Indexes
    __table_args__ = (
        Index("ix_execution_plugin_user", "plugin_id", "user_id"),
        Index("ix_execution_started", "started_at"),
    )


class PluginInstallation(Base):
    """
    Plugin installation by users.
    
    Tracks which users have installed which plugins.
    """
    __tablename__ = "plugin_installations"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # References
    plugin_id = Column(Integer, ForeignKey("plugins.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Configuration
    config = Column(JSON, default=dict)  # User's custom configuration
    is_enabled = Column(Boolean, default=True)
    
    # Timestamps
    installed_at = Column(DateTime, default=func.now())
    last_used_at = Column(DateTime, nullable=True)
    
    # Relationships
    plugin = relationship("Plugin", back_populates="installations")
    user = relationship("User", back_populates="installed_plugins")
    
    # Constraints
    __table_args__ = (
        UniqueConstraint("plugin_id", "user_id", name="uq_installation_plugin_user"),
    )


class PluginTemplate(Base):
    """
    Plugin templates for quick start.
    
    Pre-built templates to help users create plugins faster.
    """
    __tablename__ = "plugin_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Basic info
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    category = Column(SQLEnum(PluginCategory), default=PluginCategory.CUSTOM)
    
    # Template code
    code = Column(Text, nullable=False)
    
    # Configuration
    default_config_schema = Column(JSON, default=dict)
    default_input_schema = Column(JSON, default=dict)
    default_output_schema = Column(JSON, default=dict)
    
    # Metadata
    difficulty = Column(String(20), default="beginner")  # beginner, intermediate, advanced
    estimated_time_minutes = Column(Integer, default=15)
    
    # Timestamps
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


# =============================================================================
# DEFAULT PLUGIN TEMPLATES
# =============================================================================

DEFAULT_PLUGIN_TEMPLATES = [
    {
        "name": "Basic UE5 Tool",
        "description": "A simple plugin template for basic UE5 operations",
        "category": PluginCategory.UTILITY,
        "difficulty": "beginner",
        "estimated_time_minutes": 10,
        "code": '''"""
Basic UE5 Tool Plugin
=====================

A simple plugin template for UE5 operations.
"""

def main(input_data: dict, context: dict) -> dict:
    """
    Main entry point for the plugin.
    
    Args:
        input_data: Input parameters from user or AI
        context: Execution context (mcp, workspace, etc.)
    
    Returns:
        Result dictionary with output data
    """
    # Get input parameters
    message = input_data.get("message", "Hello from plugin!")
    
    # Perform operations
    result = {
        "status": "success",
        "message": message,
        "processed": True
    }
    
    return result
''',
        "default_input_schema": {
            "type": "object",
            "properties": {
                "message": {
                    "type": "string",
                    "description": "Message to process"
                }
            }
        },
        "default_output_schema": {
            "type": "object",
            "properties": {
                "status": {"type": "string"},
                "message": {"type": "string"},
                "processed": {"type": "boolean"}
            }
        }
    },
    {
        "name": "Actor Spawner",
        "description": "Plugin to spawn actors in UE5 via MCP",
        "category": PluginCategory.LEVEL_DESIGN,
        "difficulty": "intermediate",
        "estimated_time_minutes": 20,
        "code": '''"""
Actor Spawner Plugin
====================

Spawns actors in UE5 using MCP connection.
"""

async def main(input_data: dict, context: dict) -> dict:
    """
    Spawn actors in UE5.
    
    Args:
        input_data: Actor configuration
        context: Execution context with MCP client
    
    Returns:
        Result with spawned actor information
    """
    mcp = context.get("mcp")
    if not mcp:
        return {"error": "MCP connection required"}
    
    # Get input parameters
    actor_class = input_data.get("actor_class", "StaticMeshActor")
    location = input_data.get("location", {"x": 0, "y": 0, "z": 0})
    rotation = input_data.get("rotation", {"pitch": 0, "yaw": 0, "roll": 0})
    count = input_data.get("count", 1)
    
    spawned = []
    
    for i in range(count):
        # Calculate offset for multiple actors
        offset_location = {
            "x": location["x"] + (i * 200),
            "y": location["y"],
            "z": location["z"]
        }
        
        # Call MCP to spawn actor
        result = await mcp.call_tool("spawn_actor", {
            "actor_class": actor_class,
            "location": offset_location,
            "rotation": rotation
        })
        
        if result.get("success"):
            spawned.append(result.get("actor_name"))
    
    return {
        "status": "success",
        "spawned_count": len(spawned),
        "actors": spawned
    }
''',
        "default_input_schema": {
            "type": "object",
            "properties": {
                "actor_class": {"type": "string", "default": "StaticMeshActor"},
                "location": {
                    "type": "object",
                    "properties": {
                        "x": {"type": "number"},
                        "y": {"type": "number"},
                        "z": {"type": "number"}
                    }
                },
                "rotation": {
                    "type": "object",
                    "properties": {
                        "pitch": {"type": "number"},
                        "yaw": {"type": "number"},
                        "roll": {"type": "number"}
                    }
                },
                "count": {"type": "integer", "default": 1}
            }
        },
        "default_output_schema": {
            "type": "object",
            "properties": {
                "status": {"type": "string"},
                "spawned_count": {"type": "integer"},
                "actors": {"type": "array", "items": {"type": "string"}}
            }
        }
    },
    {
        "name": "Code Generator",
        "description": "Generate UE5 C++ code from templates",
        "category": PluginCategory.CODE_GENERATION,
        "difficulty": "intermediate",
        "estimated_time_minutes": 25,
        "code": '''"""
Code Generator Plugin
=====================

Generates UE5 C++ code from templates.
"""

ACTOR_TEMPLATE = """// {class_name}.h
#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "{class_name}.generated.h"

UCLASS()
class {module}_API A{class_name} : public AActor
{{
    GENERATED_BODY()

public:
    A{class_name}();

protected:
    virtual void BeginPlay() override;

public:
    virtual void Tick(float DeltaTime) override;

{properties}
{functions}
}};
"""

CPP_TEMPLATE = """// {class_name}.cpp
#include "{class_name}.h"

A{class_name}::A{class_name}()
{{
    PrimaryActorTick.bCanEverTick = true;
}}

void A{class_name}::BeginPlay()
{{
    Super::BeginPlay();
}}

void A{class_name}::Tick(float DeltaTime)
{{
    Super::Tick(DeltaTime);
}}
"""

def main(input_data: dict, context: dict) -> dict:
    """
    Generate UE5 C++ code.
    
    Args:
        input_data: Code generation parameters
        context: Execution context
    
    Returns:
        Generated code files
    """
    class_name = input_data.get("class_name", "MyActor")
    module_name = input_data.get("module_name", "MYPROJECT")
    properties = input_data.get("properties", [])
    functions = input_data.get("functions", [])
    
    # Generate properties
    props_code = ""
    for prop in properties:
        prop_type = prop.get("type", "float")
        prop_name = prop.get("name", "Value")
        props_code += f"    UPROPERTY(EditAnywhere, BlueprintReadWrite)\\n"
        props_code += f"    {prop_type} {prop_name};\\n\\n"
    
    # Generate functions
    funcs_code = ""
    for func in functions:
        func_name = func.get("name", "MyFunction")
        func_return = func.get("return_type", "void")
        funcs_code += f"    UFUNCTION(BlueprintCallable)\\n"
        funcs_code += f"    {func_return} {func_name}();\\n\\n"
    
    # Generate header
    header = ACTOR_TEMPLATE.format(
        class_name=class_name,
        module=module_name,
        properties=props_code,
        functions=funcs_code
    )
    
    # Generate cpp
    cpp = CPP_TEMPLATE.format(class_name=class_name)
    
    return {
        "status": "success",
        "files": {
            f"{class_name}.h": header,
            f"{class_name}.cpp": cpp
        }
    }
''',
        "default_input_schema": {
            "type": "object",
            "properties": {
                "class_name": {"type": "string"},
                "module_name": {"type": "string"},
                "properties": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "type": {"type": "string"},
                            "name": {"type": "string"}
                        }
                    }
                },
                "functions": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "name": {"type": "string"},
                            "return_type": {"type": "string"}
                        }
                    }
                }
            },
            "required": ["class_name"]
        },
        "default_output_schema": {
            "type": "object",
            "properties": {
                "status": {"type": "string"},
                "files": {"type": "object"}
            }
        }
    },
    {
        "name": "Asset Analyzer",
        "description": "Analyze UE5 project assets and generate reports",
        "category": PluginCategory.ASSET_MANAGEMENT,
        "difficulty": "advanced",
        "estimated_time_minutes": 30,
        "code": '''"""
Asset Analyzer Plugin
=====================

Analyzes UE5 project assets via MCP.
"""

async def main(input_data: dict, context: dict) -> dict:
    """
    Analyze project assets.
    
    Args:
        input_data: Analysis parameters
        context: Execution context with MCP
    
    Returns:
        Asset analysis report
    """
    mcp = context.get("mcp")
    if not mcp:
        return {"error": "MCP connection required"}
    
    asset_path = input_data.get("path", "/Game")
    include_size = input_data.get("include_size", True)
    
    # Get assets via MCP
    result = await mcp.call_tool("get_assets_by_path", {
        "path": asset_path,
        "recursive": True
    })
    
    if not result.get("success"):
        return {"error": "Failed to get assets"}
    
    assets = result.get("assets", [])
    
    # Analyze by type
    by_type = {}
    total_count = 0
    
    for asset in assets:
        asset_type = asset.get("type", "Unknown")
        if asset_type not in by_type:
            by_type[asset_type] = {"count": 0, "assets": []}
        by_type[asset_type]["count"] += 1
        by_type[asset_type]["assets"].append(asset.get("name"))
        total_count += 1
    
    # Generate report
    report = {
        "status": "success",
        "summary": {
            "total_assets": total_count,
            "asset_types": len(by_type),
            "path_analyzed": asset_path
        },
        "by_type": by_type,
        "recommendations": []
    }
    
    # Add recommendations
    if by_type.get("Texture2D", {}).get("count", 0) > 100:
        report["recommendations"].append(
            "Consider using texture streaming for large texture counts"
        )
    
    if by_type.get("StaticMesh", {}).get("count", 0) > 50:
        report["recommendations"].append(
            "Review static meshes for LOD optimization"
        )
    
    return report
''',
        "default_input_schema": {
            "type": "object",
            "properties": {
                "path": {"type": "string", "default": "/Game"},
                "include_size": {"type": "boolean", "default": True}
            }
        },
        "default_output_schema": {
            "type": "object",
            "properties": {
                "status": {"type": "string"},
                "summary": {"type": "object"},
                "by_type": {"type": "object"},
                "recommendations": {"type": "array"}
            }
        }
    }
]
