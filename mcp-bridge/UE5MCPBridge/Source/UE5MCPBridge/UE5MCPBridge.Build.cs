// UE5MCPBridge.Build.cs - Compatible with UE5.1 - UE5.7
using UnrealBuildTool;
using System.IO;

public class UE5MCPBridge : ModuleRules
{
    public UE5MCPBridge(ReadOnlyTargetRules Target) : base(Target)
    {
        PCHUsage = PCHUsageMode.UseExplicitOrSharedPCHs;
        
        // Disable precompiled headers for better compatibility
        bUsePrecompiled = false;
        
        // IWYU setting - use IWYUSupport for UE 5.2+ compatibility
        IWYUSupport = IWYUSupport.None;
        
        PublicDependencyModuleNames.AddRange(new string[] {
            "Core",
            "CoreUObject",
            "Engine",
            "InputCore"
        });
        
        PrivateDependencyModuleNames.AddRange(new string[] {
            "Sockets",
            "Networking",
            "Json",
            "JsonUtilities",
            // Slate UI dependencies (required for notifications and menus)
            "Slate",
            "SlateCore"
        });
        
        // Editor-only dependencies
        if (Target.bBuildEditor)
        {
            PrivateDependencyModuleNames.AddRange(new string[] {
                "UnrealEd",
                "LevelEditor",
                "EditorFramework",
                // Additional modules for Phase 1 tools
                "AssetRegistry",
                "Kismet",
                "BlueprintGraph",
                "MaterialEditor",
                "EditorStyle",
                "EditorSubsystem",
                // ToolMenus is required for editor menu extensions
                "ToolMenus",
                // Phase 2 modules
                "EditorScriptingUtilities",
                "AssetTools",
                "ContentBrowser",
                // Phase 4 modules - Animation & Sequencer
                "LevelSequence",
                "MovieScene",
                "MovieSceneTracks",
                "Sequencer",
                // Phase 4 modules - Landscape & Foliage
                "Landscape",
                "Foliage"
            });
        }
        
        // Platform-specific settings
        if (Target.Platform == UnrealTargetPlatform.Win64)
        {
            PublicDefinitions.Add("MCP_PLATFORM_WINDOWS=1");
        }
        else if (Target.Platform == UnrealTargetPlatform.Mac)
        {
            PublicDefinitions.Add("MCP_PLATFORM_MAC=1");
        }
        else if (Target.Platform == UnrealTargetPlatform.Linux)
        {
            PublicDefinitions.Add("MCP_PLATFORM_LINUX=1");
        }
        
        // Add version defines for conditional compilation
        PublicDefinitions.Add("MCP_PLUGIN_VERSION=\"3.3.0\"");
    }
}
