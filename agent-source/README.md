# UE5 AI Studio Agent

A local companion application that connects your Unreal Engine 5 instance to the UE5 AI Studio cloud platform.

## Overview

The UE5 AI Studio Agent runs on your local machine and acts as a secure bridge between:
- **Cloud Platform**: UE5 AI Studio hosted online
- **Local UE5**: Your Unreal Engine 5 editor with the MCP plugin

## Features

- **Secure Connection**: WebSocket connection with JWT authentication
- **Auto-Reconnect**: Automatically reconnects if connection is lost
- **System Tray**: Runs in the background with easy access
- **MCP Integration**: Communicates with UE5 via the Model Context Protocol
- **Cross-Platform**: Works on Windows, macOS, and Linux

## Installation

### Pre-built Installers

Download the latest installer for your platform from the [Releases](https://github.com/your-repo/releases) page:

- **Windows**: `UE5-AI-Studio-Agent-Setup.exe`
- **macOS**: `UE5-AI-Studio-Agent.dmg`
- **Linux**: `UE5-AI-Studio-Agent.AppImage`

### Build from Source

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for your platform
npm run build

# Build for all platforms
npm run build:all
```

## Setup

1. **Get Your Token**
   - Log into UE5 AI Studio
   - Go to Settings → Agent Token
   - Copy your personal agent token

2. **Configure the Agent**
   - Open the agent application
   - Go to the Account tab
   - Paste your token and click Save

3. **Connect to Cloud**
   - Click "Connect" on the Cloud Platform card
   - Wait for the connection to establish

4. **Start Unreal Engine**
   - Open your UE5 project with the MCP plugin installed
   - The MCP server should start automatically on port 55557

5. **Connect to UE5**
   - Click "Connect" on the Unreal Engine 5 card
   - The agent will connect to your local MCP server

## Configuration

### Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Cloud Server URL | WebSocket URL of the cloud platform | `wss://your-server.com/api/agent/ws` |
| MCP Host | Host where UE5 MCP server is running | `localhost` |
| MCP Port | Port of the UE5 MCP server | `55557` |
| Auto-connect | Connect automatically on startup | `true` |
| Minimize to tray | Keep running in system tray when closed | `true` |
| Start with system | Launch agent when system starts | `false` |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    UE5 AI Studio (Cloud)                        │
│  ┌──────────────┐    ┌──────────────────────────────────────┐  │
│  │   Web UI     │───▶│  WebSocket Relay Server              │  │
│  └──────────────┘    └───────────────┬──────────────────────┘  │
└──────────────────────────────────────┼──────────────────────────┘
                                       │ WebSocket (wss://)
                                       │
┌──────────────────────────────────────┼──────────────────────────┐
│                    Your Local Machine │                          │
│  ┌───────────────────────────────────▼────────────────────────┐ │
│  │              UE5 AI Studio Agent                            │ │
│  │  ┌─────────────────┐    ┌────────────────────────────────┐ │ │
│  │  │ WebSocket Client│◀──▶│  MCP Protocol Handler          │ │ │
│  │  └─────────────────┘    └───────────────┬────────────────┘ │ │
│  └─────────────────────────────────────────┼──────────────────┘ │
│                                            │ TCP (localhost)     │
│  ┌─────────────────────────────────────────▼──────────────────┐ │
│  │              Unreal Engine 5                                │ │
│  │  ┌──────────────────────────────────────────────────────┐  │ │
│  │  │           MCP Server Plugin                           │  │ │
│  │  └──────────────────────────────────────────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### Connection Issues

**Cloud Connection Failed**
- Verify your token is correct
- Check if the server URL is correct
- Ensure you have internet connectivity

**UE5 Connection Failed**
- Make sure Unreal Engine is running
- Verify the MCP plugin is installed and enabled
- Check that the MCP server is running on the correct port
- Try restarting Unreal Engine

### Logs

Logs are stored in:
- **Windows**: `%APPDATA%\ue5-ai-studio-agent\logs`
- **macOS**: `~/Library/Logs/ue5-ai-studio-agent`
- **Linux**: `~/.config/ue5-ai-studio-agent/logs`

## Development

### Project Structure

```
agent/
├── src/
│   ├── main.js           # Main Electron process
│   ├── preload.js        # Secure IPC bridge
│   ├── index.html        # UI template
│   ├── renderer.js       # UI logic
│   ├── websocket-client.js  # Cloud connection
│   └── mcp-client.js     # UE5 MCP connection
├── assets/
│   ├── icon.png          # Application icon
│   └── tray-icon.png     # System tray icon
├── package.json
└── README.md
```

### Building

```bash
# Development
npm run dev

# Production builds
npm run build:win    # Windows
npm run build:mac    # macOS
npm run build:linux  # Linux
npm run build:all    # All platforms
```

## License

MIT License - See LICENSE file for details.
