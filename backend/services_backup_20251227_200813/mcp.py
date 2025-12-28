import httpx
import json
from typing import Optional, List, Dict, Any
from datetime import datetime


class MCPClient:
    """
    Model Context Protocol client for UE5 integration.
    Connects to a local MCP server running alongside Unreal Engine.
    """
    
    def __init__(self, endpoint: str):
        self.endpoint = endpoint.rstrip("/")
        self.connected = False
        self.available_tools: List[str] = []
    
    async def connect(self) -> Dict[str, Any]:
        """
        Connect to the MCP server and discover available tools.
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # Initialize connection
                response = await client.post(
                    f"{self.endpoint}/initialize",
                    json={
                        "protocolVersion": "2024-11-05",
                        "capabilities": {
                            "tools": {}
                        },
                        "clientInfo": {
                            "name": "UE5 AI Studio",
                            "version": "1.0.0"
                        }
                    }
                )
                response.raise_for_status()
                init_data = response.json()
                
                # List available tools
                tools_response = await client.post(
                    f"{self.endpoint}/tools/list",
                    json={}
                )
                tools_response.raise_for_status()
                tools_data = tools_response.json()
                
                self.available_tools = [tool["name"] for tool in tools_data.get("tools", [])]
                self.connected = True
                
                return {
                    "status": "connected",
                    "server_info": init_data.get("serverInfo", {}),
                    "available_tools": self.available_tools
                }
        except Exception as e:
            self.connected = False
            return {
                "status": "error",
                "error": str(e)
            }
    
    async def disconnect(self) -> Dict[str, Any]:
        """Disconnect from the MCP server."""
        self.connected = False
        self.available_tools = []
        return {"status": "disconnected"}
    
    async def call_tool(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """
        Call a tool on the MCP server.
        """
        if not self.connected:
            return {"error": "Not connected to MCP server"}
        
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    f"{self.endpoint}/tools/call",
                    json={
                        "name": tool_name,
                        "arguments": arguments
                    }
                )
                response.raise_for_status()
                return response.json()
        except Exception as e:
            return {"error": str(e)}
    
    # Convenience methods for common UE5 operations
    
    async def create_ue_class(
        self,
        class_name: str,
        parent_class: str,
        header_content: str,
        cpp_content: str,
        module_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new C++ class in the UE5 project."""
        return await self.call_tool("create_ue_class", {
            "class_name": class_name,
            "parent_class": parent_class,
            "header_content": header_content,
            "cpp_content": cpp_content,
            "module_name": module_name
        })
    
    async def create_blueprint(
        self,
        blueprint_name: str,
        parent_class: str,
        path: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create a new Blueprint asset."""
        return await self.call_tool("create_blueprint", {
            "blueprint_name": blueprint_name,
            "parent_class": parent_class,
            "path": path
        })
    
    async def modify_file(
        self,
        file_path: str,
        content: str,
        create_if_missing: bool = True
    ) -> Dict[str, Any]:
        """Modify or create a file in the UE5 project."""
        return await self.call_tool("modify_file", {
            "file_path": file_path,
            "content": content,
            "create_if_missing": create_if_missing
        })
    
    async def compile_project(self, configuration: str = "Development") -> Dict[str, Any]:
        """Trigger a project compilation."""
        return await self.call_tool("compile_project", {
            "configuration": configuration
        })
    
    async def list_project_files(
        self,
        path: str = "/",
        extensions: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """List files in the UE5 project."""
        return await self.call_tool("list_project_files", {
            "path": path,
            "extensions": extensions or [".cpp", ".h", ".uasset"]
        })
    
    async def get_build_errors(self) -> Dict[str, Any]:
        """Get the latest build errors."""
        return await self.call_tool("get_build_errors", {})
    
    async def run_editor_command(self, command: str) -> Dict[str, Any]:
        """Run a command in the Unreal Editor."""
        return await self.call_tool("run_editor_command", {
            "command": command
        })


class MCPConnectionManager:
    """Manages multiple MCP connections."""
    
    def __init__(self):
        self.connections: Dict[int, MCPClient] = {}
    
    def get_client(self, connection_id: int) -> Optional[MCPClient]:
        """Get an existing MCP client."""
        return self.connections.get(connection_id)
    
    async def create_connection(self, connection_id: int, endpoint: str) -> Dict[str, Any]:
        """Create and connect a new MCP client."""
        client = MCPClient(endpoint)
        result = await client.connect()
        
        if result["status"] == "connected":
            self.connections[connection_id] = client
        
        return result
    
    async def remove_connection(self, connection_id: int) -> Dict[str, Any]:
        """Disconnect and remove an MCP client."""
        client = self.connections.pop(connection_id, None)
        if client:
            return await client.disconnect()
        return {"status": "not_found"}
    
    def is_connected(self, connection_id: int) -> bool:
        """Check if a connection is active."""
        client = self.connections.get(connection_id)
        return client.connected if client else False


# Singleton instance
mcp_manager = MCPConnectionManager()
