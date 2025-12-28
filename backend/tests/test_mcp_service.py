"""
UE5 AI Studio - MCP Service Tests
=================================

Unit tests for the enhanced MCP service including:
- Circuit breaker functionality
- Connection pooling
- Retry logic
- Thread-safe connection management

Run with: pytest tests/test_mcp_service.py -v
"""

import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import httpx

# Import the modules to test
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.mcp import (
    MCPClient,
    MCPConnectionManager,
    CircuitBreaker,
    CircuitState,
    MCPConnectionError,
    MCPCircuitOpenError,
    get_available_tools
)


# =============================================================================
# CIRCUIT BREAKER TESTS
# =============================================================================

class TestCircuitBreaker:
    """Tests for the CircuitBreaker class."""
    
    def test_initial_state_is_closed(self):
        """Circuit breaker should start in closed state."""
        cb = CircuitBreaker()
        assert cb.state == CircuitState.CLOSED
        assert cb.can_execute() is True
    
    def test_opens_after_threshold_failures(self):
        """Circuit breaker should open after reaching failure threshold."""
        cb = CircuitBreaker(failure_threshold=3)
        
        # Record failures
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED
        
        cb.record_failure()
        assert cb.state == CircuitState.CLOSED
        
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        assert cb.can_execute() is False
    
    def test_success_resets_failure_count(self):
        """Recording success should reset failure count."""
        cb = CircuitBreaker(failure_threshold=3)
        
        cb.record_failure()
        cb.record_failure()
        assert cb.failure_count == 2
        
        cb.record_success()
        assert cb.failure_count == 0
        assert cb.state == CircuitState.CLOSED
    
    def test_half_open_after_recovery_timeout(self):
        """Circuit should transition to half-open after recovery timeout."""
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.1)
        
        # Open the circuit
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
        
        # Wait for recovery timeout
        import time
        time.sleep(0.15)
        
        # Should now be half-open
        assert cb.can_execute() is True
        assert cb.state == CircuitState.HALF_OPEN
    
    def test_half_open_closes_on_success(self):
        """Circuit should close when success recorded in half-open state."""
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.1)
        
        # Open the circuit
        cb.record_failure()
        
        # Wait and transition to half-open
        import time
        time.sleep(0.15)
        cb.can_execute()  # Triggers transition
        
        # Record success
        cb.record_success()
        assert cb.state == CircuitState.CLOSED
    
    def test_half_open_reopens_on_failure(self):
        """Circuit should reopen when failure recorded in half-open state."""
        cb = CircuitBreaker(failure_threshold=1, recovery_timeout=0.1)
        
        # Open the circuit
        cb.record_failure()
        
        # Wait and transition to half-open
        import time
        time.sleep(0.15)
        cb.can_execute()  # Triggers transition
        
        # Record failure
        cb.record_failure()
        assert cb.state == CircuitState.OPEN
    
    def test_get_status(self):
        """get_status should return correct status information."""
        cb = CircuitBreaker()
        status = cb.get_status()
        
        assert "state" in status
        assert "failure_count" in status
        assert "success_count" in status
        assert "can_execute" in status


# =============================================================================
# MCP CLIENT TESTS
# =============================================================================

class TestMCPClient:
    """Tests for the MCPClient class."""
    
    @pytest.fixture
    def client(self):
        """Create a test MCP client."""
        return MCPClient("http://localhost:55557")
    
    def test_initialization(self, client):
        """Client should initialize with correct defaults."""
        assert client.endpoint == "http://localhost:55557"
        assert client.connected is False
        assert client.available_tools == []
        assert client._http_client is None
    
    def test_endpoint_trailing_slash_removed(self):
        """Trailing slash should be removed from endpoint."""
        client = MCPClient("http://localhost:55557/")
        assert client.endpoint == "http://localhost:55557"
    
    @pytest.mark.asyncio
    async def test_disconnect_cleans_up_resources(self, client):
        """Disconnect should clean up HTTP client and reset state."""
        # Simulate connected state
        client.connected = True
        client.available_tools = ["test_tool"]
        
        result = await client.disconnect()
        
        assert result["status"] == "disconnected"
        assert client.connected is False
        assert client.available_tools == []
        assert "stats" in result
    
    @pytest.mark.asyncio
    async def test_call_tool_when_not_connected(self, client):
        """call_tool should return error when not connected."""
        result = await client.call_tool("test_tool", {})
        
        assert "error" in result
        assert "Not connected" in result["error"]
    
    @pytest.mark.asyncio
    async def test_call_tool_unknown_tool(self, client):
        """call_tool should return error for unknown tool."""
        client.connected = True
        client.available_tools = ["known_tool"]
        
        result = await client.call_tool("unknown_tool", {})
        
        assert "error" in result
        assert "not found" in result["error"]
    
    def test_get_status(self, client):
        """get_status should return comprehensive status."""
        status = client.get_status()
        
        assert "endpoint" in status
        assert "connected" in status
        assert "circuit_breaker" in status
        assert "stats" in status
        assert "total_requests" in status["stats"]


# =============================================================================
# CONNECTION MANAGER TESTS
# =============================================================================

class TestMCPConnectionManager:
    """Tests for the MCPConnectionManager class."""
    
    @pytest.fixture
    def manager(self):
        """Create a test connection manager."""
        return MCPConnectionManager()
    
    def test_initialization(self, manager):
        """Manager should initialize with empty connections."""
        assert len(manager._connections) == 0
        assert len(manager._locks) == 0
    
    def test_get_client_not_found(self, manager):
        """get_client should return None for non-existent connection."""
        client = manager.get_client(999)
        assert client is None
    
    def test_is_connected_not_found(self, manager):
        """is_connected should return False for non-existent connection."""
        assert manager.is_connected(999) is False
    
    @pytest.mark.asyncio
    async def test_remove_connection_not_found(self, manager):
        """remove_connection should return not_found for non-existent connection."""
        result = await manager.remove_connection(999)
        assert result["status"] == "not_found"
    
    def test_get_all_connections_empty(self, manager):
        """get_all_connections should return empty dict when no connections."""
        connections = manager.get_all_connections()
        assert connections == {}
    
    @pytest.mark.asyncio
    async def test_shutdown_empty(self, manager):
        """shutdown should complete without error when no connections."""
        await manager.shutdown()
        assert len(manager._connections) == 0


# =============================================================================
# UTILITY FUNCTION TESTS
# =============================================================================

class TestUtilityFunctions:
    """Tests for utility functions."""
    
    def test_get_available_tools_returns_list(self):
        """get_available_tools should return a list of tool definitions."""
        tools = get_available_tools()
        
        assert isinstance(tools, list)
        assert len(tools) > 0
    
    def test_get_available_tools_has_required_fields(self):
        """Each tool should have name, category, and description."""
        tools = get_available_tools()
        
        for tool in tools:
            assert "name" in tool
            assert "category" in tool
            assert "description" in tool
    
    def test_get_available_tools_categories(self):
        """Tools should be organized into expected categories."""
        tools = get_available_tools()
        categories = set(tool["category"] for tool in tools)
        
        expected_categories = {
            "Actor", "Selection", "Viewport", "Level", "PIE",
            "Asset", "Blueprint", "Material", "Physics", "Editor",
            "Bookmark", "Component", "Animation", "Audio", "Landscape"
        }
        
        assert expected_categories.issubset(categories)


# =============================================================================
# INTEGRATION TESTS (Mocked)
# =============================================================================

class TestMCPClientIntegration:
    """Integration tests with mocked HTTP responses."""
    
    @pytest.mark.asyncio
    async def test_connect_success(self):
        """Test successful connection flow."""
        client = MCPClient("http://localhost:55557")
        
        # Mock the HTTP client
        mock_response_init = MagicMock()
        mock_response_init.json.return_value = {
            "serverInfo": {"name": "test-server", "version": "1.0.0"}
        }
        mock_response_init.raise_for_status = MagicMock()
        
        mock_response_tools = MagicMock()
        mock_response_tools.json.return_value = {
            "tools": [
                {"name": "get_actor_list"},
                {"name": "spawn_actor"}
            ]
        }
        mock_response_tools.raise_for_status = MagicMock()
        
        with patch.object(client, '_get_client') as mock_get_client:
            mock_http_client = AsyncMock()
            mock_http_client.post = AsyncMock(
                side_effect=[mock_response_init, mock_response_tools]
            )
            mock_get_client.return_value = mock_http_client
            
            result = await client.connect()
        
        assert result["status"] == "connected"
        assert client.connected is True
        assert len(client.available_tools) == 2
    
    @pytest.mark.asyncio
    async def test_connect_failure_triggers_circuit_breaker(self):
        """Test that connection failures trigger circuit breaker."""
        client = MCPClient("http://localhost:55557")
        client._circuit.failure_threshold = 2
        
        with patch.object(client, '_get_client') as mock_get_client:
            mock_http_client = AsyncMock()
            mock_http_client.post = AsyncMock(
                side_effect=httpx.ConnectError("Connection refused")
            )
            mock_get_client.return_value = mock_http_client
            
            # First attempt
            result1 = await client.connect()
            assert result1["status"] == "error"
            
            # Second attempt - should open circuit
            result2 = await client.connect()
            
            # Third attempt - circuit should be open
            result3 = await client.connect()
            assert result3["status"] == "circuit_open"


# =============================================================================
# RUN TESTS
# =============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
