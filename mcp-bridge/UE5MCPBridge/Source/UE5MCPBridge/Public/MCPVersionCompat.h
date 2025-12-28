// MCPVersionCompat.h - Version compatibility macros for UE5.1 - UE5.7+
#pragma once

#include "Misc/EngineVersionComparison.h"

// Engine version macros using built-in comparison
#define UE5_1_OR_LATER (ENGINE_MAJOR_VERSION == 5 && ENGINE_MINOR_VERSION >= 1)
#define UE5_2_OR_LATER (ENGINE_MAJOR_VERSION == 5 && ENGINE_MINOR_VERSION >= 2)
#define UE5_3_OR_LATER (ENGINE_MAJOR_VERSION == 5 && ENGINE_MINOR_VERSION >= 3)
#define UE5_4_OR_LATER (ENGINE_MAJOR_VERSION == 5 && ENGINE_MINOR_VERSION >= 4)
#define UE5_5_OR_LATER (ENGINE_MAJOR_VERSION == 5 && ENGINE_MINOR_VERSION >= 5)
#define UE5_6_OR_LATER (ENGINE_MAJOR_VERSION == 5 && ENGINE_MINOR_VERSION >= 6)
#define UE5_7_OR_LATER (ENGINE_MAJOR_VERSION == 5 && ENGINE_MINOR_VERSION >= 7)

// Specific version checks
#define UE_VERSION_5_1 (ENGINE_MAJOR_VERSION == 5 && ENGINE_MINOR_VERSION == 1)
#define UE_VERSION_5_2 (ENGINE_MAJOR_VERSION == 5 && ENGINE_MINOR_VERSION == 2)
#define UE_VERSION_5_3 (ENGINE_MAJOR_VERSION == 5 && ENGINE_MINOR_VERSION == 3)
#define UE_VERSION_5_4 (ENGINE_MAJOR_VERSION == 5 && ENGINE_MINOR_VERSION == 4)
#define UE_VERSION_5_5 (ENGINE_MAJOR_VERSION == 5 && ENGINE_MINOR_VERSION == 5)
#define UE_VERSION_5_6 (ENGINE_MAJOR_VERSION == 5 && ENGINE_MINOR_VERSION == 6)
#define UE_VERSION_5_7 (ENGINE_MAJOR_VERSION == 5 && ENGINE_MINOR_VERSION == 7)

// ============================================================================
// API Compatibility Helpers
// Use these macros when APIs change between versions
// ============================================================================

// String conversion - changed in UE 5.6
#if UE5_6_OR_LATER
    #define MCP_STRING_TO_UTF8(Str) StringCast<ANSICHAR>(*Str).Get()
#else
    #define MCP_STRING_TO_UTF8(Str) TCHAR_TO_UTF8(*Str)
#endif

// Socket API compatibility - changed in UE 5.5
#if UE5_5_OR_LATER
    #define MCP_SOCKET_SUBSYSTEM ISocketSubsystem::Get(PLATFORM_SOCKETSUBSYSTEM)
#else
    #define MCP_SOCKET_SUBSYSTEM ISocketSubsystem::Get()
#endif

// Asset Registry compatibility - changed in UE 5.5
#if UE5_5_OR_LATER
    #define MCP_GET_ASSET_REGISTRY() IAssetRegistry::Get()
#else
    #define MCP_GET_ASSET_REGISTRY() FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry").Get()
#endif

// FProperty vs UProperty - changed in UE 5.0+
// All UE5 versions use FProperty, but keep this for reference
#define MCP_USE_FPROPERTY 1

// World context handling - improved in UE 5.3+
#if UE5_3_OR_LATER
    #define MCP_GET_EDITOR_WORLD() GEditor->GetEditorWorldContext().World()
#else
    #define MCP_GET_EDITOR_WORLD() GEditor->GetEditorWorldContext().World()
#endif

// Async task handling - UE 5.7 has new async patterns
#if UE5_7_OR_LATER
    #define MCP_ASYNC_GAME_THREAD(Lambda) AsyncTask(ENamedThreads::GameThread, Lambda)
#else
    #define MCP_ASYNC_GAME_THREAD(Lambda) AsyncTask(ENamedThreads::GameThread, Lambda)
#endif

// JSON handling - consistent across UE5 versions
#define MCP_JSON_MAKE_SHARED MakeShared

// Logging helper with version info
#define MCP_LOG_VERSION() \
    UE_LOG(LogMCPServer, Log, TEXT("UE5 MCP Bridge v3.0.0 running on Unreal Engine %d.%d.%d"), \
        ENGINE_MAJOR_VERSION, ENGINE_MINOR_VERSION, ENGINE_PATCH_VERSION)

// Feature flags for conditional compilation
#define MCP_SUPPORTS_ENHANCED_REFLECTION UE5_4_OR_LATER
#define MCP_SUPPORTS_NEW_ASSET_SYSTEM UE5_5_OR_LATER
#define MCP_SUPPORTS_IMPROVED_SOCKETS UE5_5_OR_LATER

// Deprecation warnings helper
#if UE5_7_OR_LATER
    #define MCP_DEPRECATED_57(Message) [[deprecated(Message)]]
#else
    #define MCP_DEPRECATED_57(Message)
#endif

// ============================================================================
// UE 5.7 Specific Compatibility
// ILevelViewport.h was removed/renamed in UE 5.7
// ============================================================================

// Viewport include compatibility - ILevelViewport.h renamed to SLevelViewport.h in UE 5.7
// The include is handled in MCPServer.cpp with conditional compilation if needed
