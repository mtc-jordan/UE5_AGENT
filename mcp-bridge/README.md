# UE5 MCP Bridge Plugin v2.3.0

This Unreal Engine 5 plugin enables AI-assisted development by implementing the Model Context Protocol (MCP). It allows AI tools like UE5 AI Studio to interact with the Unreal Editor through a standardized protocol.

## Compatibility

- **Unreal Engine**: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
- **Platforms**: Windows, macOS, Linux
- **Plugin Version**: 2.3.0

## Important: Source Plugin Installation

**This plugin is distributed as source code and must be compiled for your specific UE version.**

The error "The following modules are missing or built with a different engine version" occurs because:
1. The plugin needs to be compiled specifically for your UE version
2. Pre-compiled binaries from one UE version won't work with another

### Solution: Build from Source

1. **Copy the plugin to your project's Plugins folder**
2. **Delete any existing Binaries and Intermediate folders** in the plugin directory
3. **Open your project in Unreal Editor** - it will prompt to compile
4. **Click "Yes" to compile** the plugin

If you get "Engine modules are out of date, and cannot be compiled while the engine is running":
- Close Unreal Editor completely
- Build from your IDE (Visual Studio / Xcode / Rider)
- Or use command line build (see below)

## Features

- **TCP Server**: Listens on port 55557 for MCP client connections
- **Actor Management**: List, spawn, delete, and modify actors in your level
- **Property Access**: Get and set actor properties
- **Project Info**: Query project and engine information
- **Asset Browser**: List and search project assets
- **Console Commands**: Execute Unreal console commands remotely

## Supported Tools

| Tool | Description |
|------|-------------|
| `get_actor_list` | List all actors in the current level |
| `spawn_actor` | Spawn a new actor at a specified location |
| `delete_actor` | Delete an actor by name |
| `get_actor_properties` | Get location, rotation, scale of an actor |
| `set_actor_property` | Modify actor properties |
| `get_project_info` | Get project name, engine version, current level |
| `execute_console_command` | Run Unreal console commands |

## Installation

### Method 1: Project Plugins Folder (Recommended)

1. Copy the `UE5MCPBridge` folder to your project's `Plugins` directory:
   ```
   YourProject/
   ├── Content/
   ├── Source/
   └── Plugins/
       └── UE5MCPBridge/    <-- Copy here
           ├── Source/
           └── UE5MCPBridge.uplugin
   ```

2. **Delete any existing compiled files** (if present):
   ```
   rm -rf Plugins/UE5MCPBridge/Binaries
   rm -rf Plugins/UE5MCPBridge/Intermediate
   ```

3. Open your project in Unreal Editor

4. When prompted "The following modules are missing or built with a different engine version", click **Yes** to rebuild

5. If the editor can't compile while running:
   - Close Unreal Editor
   - Build from command line or IDE (see below)

### Method 2: Command Line Build

**Windows (Visual Studio):**
```batch
# Navigate to your UE installation
cd "C:\Program Files\Epic Games\UE_5.7\Engine\Build\BatchFiles"

# Build your project (which includes the plugin)
RunUAT.bat BuildCookRun -project="C:\Path\To\YourProject.uproject" -platform=Win64 -clientconfig=Development -build
```

**macOS (Xcode):**
```bash
# Navigate to your UE installation
cd "/Users/Shared/Epic Games/UE_5.7/Engine/Build/BatchFiles"

# Build your project
./RunUAT.sh BuildCookRun -project="/Path/To/YourProject.uproject" -platform=Mac -clientconfig=Development -build
```

**Linux:**
```bash
cd ~/UnrealEngine/Engine/Build/BatchFiles
./RunUAT.sh BuildCookRun -project="/path/to/YourProject.uproject" -platform=Linux -clientconfig=Development -build
```

### Method 3: IDE Build

1. Generate project files:
   - **Windows**: Right-click your `.uproject` file → "Generate Visual Studio project files"
   - **macOS**: Right-click your `.uproject` file → "Generate Xcode project files"

2. Open the generated solution/project in your IDE

3. Build the project in Development Editor configuration

4. Launch Unreal Editor from the IDE

## Verification

After successful installation:

1. Open Unreal Editor
2. Go to **Edit → Plugins**
3. Search for "MCP Bridge" - it should be enabled
4. Go to **Tools** menu
5. Look for **MCP Bridge Status** - it should show "MCP Server is running on port 55557"

## Connecting from UE5 AI Studio

1. Open UE5 AI Studio web application
2. Navigate to the **UE5 Connection** page
3. Download and install the **Local Agent**
4. Generate an **Agent Token**
5. Configure the agent with your token
6. The agent will automatically connect to the MCP server on port 55557

## Troubleshooting

### "Engine modules are out of date" Error

This means the plugin needs to be compiled for your UE version:

1. Close Unreal Editor completely
2. Delete `Binaries` and `Intermediate` folders from the plugin directory
3. Build from your IDE or command line
4. Reopen Unreal Editor

### Server not starting

1. Check the Output Log for errors (Window → Developer Tools → Output Log)
2. Search for "MCP" in the log
3. Ensure port 55557 is not in use by another application

### Connection refused

1. Verify the plugin is enabled (Edit → Plugins)
2. Check Windows Firewall / macOS Firewall settings
3. Try restarting the MCP server via Tools → Restart MCP Server

### Tools not working

1. Ensure you have a level open in the editor
2. Check the Output Log for error messages
3. Verify the agent is connected (check agent UI)

## Protocol

The plugin implements the [Model Context Protocol](https://modelcontextprotocol.io/) specification:

- Transport: TCP socket on port 55557
- Message format: Newline-delimited JSON-RPC 2.0
- Protocol version: 2024-11-05

### Example Messages

**Initialize:**
```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}
```

**List Tools:**
```json
{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}
```

**Call Tool:**
```json
{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_actor_list","arguments":{}}}
```

## Version History

- **v2.3.0** - Added UE 5.6 and 5.7 support, improved build compatibility
- **v2.2.0** - Multi-version support (5.4-5.7+), 7 core MCP tools
- **v2.1.0** - Added version compatibility macros
- **v2.0.0** - Complete rewrite with stable API

## License

MIT License - See LICENSE file for details.

## Support

- Issues: [GitHub Issues](https://github.com/ue5-ai-studio/ue5-mcp-bridge/issues)
- Documentation: [Wiki](https://github.com/ue5-ai-studio/ue5-mcp-bridge/wiki)
