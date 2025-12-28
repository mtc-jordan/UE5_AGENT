# UE5 AI Studio

**AI-powered development assistant for Unreal Engine 5**

[![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](https://github.com/mtc-jordan/UE5_AGENT)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## Overview

UE5 AI Studio is a comprehensive platform that connects AI agents with Unreal Engine 5 through the Model Context Protocol (MCP). It enables natural language interaction with the UE5 editor, allowing developers to automate tasks, generate code, and manipulate the editor through conversational AI.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        UE5 AI Studio                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   React     │◄──►│   FastAPI   │◄──►│   MCP Bridge        │ │
│  │   Frontend  │    │   Backend   │    │   (UE5 Plugin)      │ │
│  └─────────────┘    └─────────────┘    └─────────────────────┘ │
│        │                  │                      │              │
│        │                  ▼                      ▼              │
│        │           ┌─────────────┐    ┌─────────────────────┐  │
│        │           │  AI Service │    │   Unreal Engine 5   │  │
│        │           │  (DeepSeek/ │    │   Editor            │  │
│        │           │   Claude)   │    │                     │  │
│        │           └─────────────┘    └─────────────────────┘  │
│        │                                                        │
│        ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    Electron Agent                        │   │
│  │              (Local Bridge Application)                  │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## Features

### Multi-Agent AI System
- **Solo Mode**: Single agent conversation
- **Team Mode**: Multiple agents collaborating
- **Roundtable Mode**: Agents discussing and debating solutions

### MCP Integration (101 Tools)
- **Actor Management**: Spawn, delete, modify actors
- **Blueprint Operations**: Create, compile, manage blueprints
- **Material System**: Create materials, set parameters
- **Animation & Sequencer**: Play animations, control sequences
- **Viewport Control**: Camera, screenshots, view modes
- **And much more...**

### Enterprise-Grade Reliability
- **Circuit Breaker Pattern**: Prevents cascade failures
- **Connection Pooling**: Persistent HTTP/2 sessions
- **Exponential Backoff**: Automatic retry with jitter
- **Thread-Safe Operations**: Concurrent access protection

## Project Structure

```
UE5_AGENT/
├── backend/                 # FastAPI backend
│   ├── api/                # API endpoints
│   ├── core/               # Configuration & database
│   ├── models/             # SQLAlchemy models
│   ├── services/           # Business logic
│   └── tests/              # Unit tests
├── frontend/               # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── pages/          # Page components
│   │   └── lib/            # Utilities & API client
│   └── package.json
├── mcp-bridge/             # UE5 MCP Bridge Plugin
│   └── UE5MCPBridge/
│       └── Source/
└── agent-source/           # Electron desktop agent
    └── src/
```

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Unreal Engine 5.3+

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your configuration
python run.py
```

### Frontend Setup

```bash
cd frontend
pnpm install  # or npm install
pnpm dev      # or npm run dev
```

### UE5 Plugin Setup

1. Copy `mcp-bridge/UE5MCPBridge` to your UE5 project's `Plugins` folder
2. Enable the plugin in UE5 Editor
3. The MCP server will start automatically on port 55557

## API Endpoints

### MCP Connection Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mcp/connections` | GET | List all connections |
| `/api/mcp/connections` | POST | Create new connection |
| `/api/mcp/connections/{id}/connect` | POST | Establish connection |
| `/api/mcp/connections/{id}/disconnect` | POST | Close connection |
| `/api/mcp/connections/{id}/reconnect` | POST | Reconnect |
| `/api/mcp/connections/{id}/status` | GET | Detailed status |
| `/api/mcp/connections/{id}/health` | GET | Health check |

### Tool Operations

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/mcp/connections/{id}/tools` | GET | List available tools |
| `/api/mcp/connections/{id}/call` | POST | Call a tool |
| `/api/mcp/connections/{id}/batch` | POST | Batch tool calls |
| `/api/mcp/tools/catalog` | GET | Complete tool catalog |

## MCP Tools Reference

### Actor Management (19 tools)
- `get_actor_list` - Get all actors in level
- `spawn_actor` - Spawn new actor
- `delete_actor` - Delete actor
- `duplicate_actor` - Duplicate actor
- `set_actor_property` - Set location/rotation/scale
- And more...

### Blueprint Operations (9 tools)
- `create_blueprint` - Create new Blueprint
- `compile_blueprint` - Compile Blueprint
- `add_blueprint_variable` - Add variable
- And more...

### Material Operations (7 tools)
- `create_material_instance` - Create material instance
- `set_material_scalar` - Set scalar parameter
- `apply_material_to_actor` - Apply material
- And more...

[See full tool documentation](docs/MCP_TOOLS.md)

## Configuration

### Environment Variables

```env
# Backend
DATABASE_URL=sqlite+aiosqlite:///./ue5_ai_studio.db
SECRET_KEY=your-secret-key
DEEPSEEK_API_KEY=your-deepseek-key
ANTHROPIC_API_KEY=your-anthropic-key

# MCP
MCP_DEFAULT_PORT=55557
```

## Testing

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Unreal Engine by Epic Games
- Model Context Protocol specification
- DeepSeek and Anthropic for AI capabilities

---

**Version 2.0.0** - Enhanced MCP Service with Circuit Breaker, Connection Pooling, and Thread-Safe Operations
