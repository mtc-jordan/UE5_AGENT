// UE5MCPBridge.h - UE5 MCP Bridge Module v2.3.0
// Copyright UE5 AI Studio. All Rights Reserved.
// Compatible with Unreal Engine 5.1 - 5.7

#pragma once

#include "CoreMinimal.h"
#include "Modules/ModuleManager.h"
#include "MCPVersionCompat.h"

// Forward declaration
class FMCPServer;

/**
 * UE5 MCP Bridge Module
 * 
 * Provides AI-assisted development capabilities through the Model Context Protocol.
 * This module starts a TCP server that allows external AI tools to interact with
 * the Unreal Editor.
 * 
 * Features:
 * - Actor management (list, spawn, delete, modify)
 * - Property access and modification
 * - Console command execution
 * - Project information queries
 * 
 * Supported Unreal Engine Versions: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */
class UE5MCPBRIDGE_API FUE5MCPBridgeModule : public IModuleInterface
{
public:
    /** IModuleInterface implementation */
    virtual void StartupModule() override;
    virtual void ShutdownModule() override;
    
    /** Returns true if this module has been loaded and is ready */
    virtual bool IsGameModule() const override { return false; }
    
    /** Get the module instance */
    static FUE5MCPBridgeModule& Get();
    
    /** Check if the module is available */
    static bool IsAvailable();
    
    /** Check if the MCP server is running */
    bool IsServerRunning() const;
    
    /** Get the server port */
    int32 GetServerPort() const;
    
    /** Start the MCP server on the specified port */
    bool StartServer(int32 Port = 55557);
    
    /** Stop the MCP server */
    void StopServer();
    
    /** Restart the MCP server */
    bool RestartServer();
    
    /** Get the plugin version string */
    static FString GetPluginVersion() { return TEXT("2.3.0"); }

private:
    /** Register menu extensions in the editor */
    void RegisterMenuExtensions();
    
    /** Unregister menu extensions */
    void UnregisterMenuExtensions();
    
    /** Called when the editor is fully initialized */
    void OnEditorInitialized();

private:
    /** The MCP server instance */
    TSharedPtr<FMCPServer> MCPServer;
    
    /** Handle for editor initialization delegate */
    FDelegateHandle EditorInitializedHandle;
    
    /** Handle for menu extension */
    FDelegateHandle MenuExtensionHandle;
};
