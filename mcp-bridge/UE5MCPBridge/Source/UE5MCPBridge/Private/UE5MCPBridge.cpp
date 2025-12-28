// UE5MCPBridge.cpp - UE5 MCP Bridge Module v2.3.0
// Copyright UE5 AI Studio. All Rights Reserved.
// Compatible with Unreal Engine 5.1 - 5.7

#include "UE5MCPBridge.h"
#include "MCPServer.h"
#include "MCPVersionCompat.h"

// Editor includes
#if WITH_EDITOR
#include "ToolMenus.h"
#include "Framework/Notifications/NotificationManager.h"
#include "Widgets/Notifications/SNotificationList.h"
#include "LevelEditor.h"
#endif

#define LOCTEXT_NAMESPACE "FUE5MCPBridgeModule"

void FUE5MCPBridgeModule::StartupModule()
{
    UE_LOG(LogTemp, Log, TEXT("UE5 MCP Bridge v%s: Starting module on UE %d.%d.%d..."), 
        *GetPluginVersion(), ENGINE_MAJOR_VERSION, ENGINE_MINOR_VERSION, ENGINE_PATCH_VERSION);
    
    // Create the MCP server
    MCPServer = MakeShared<FMCPServer>();
    
#if WITH_EDITOR
    // Register menu extensions after ToolMenus is ready
    if (UToolMenus::IsToolMenuUIEnabled())
    {
        UToolMenus::RegisterStartupCallback(
            FSimpleMulticastDelegate::FDelegate::CreateRaw(this, &FUE5MCPBridgeModule::RegisterMenuExtensions)
        );
    }
#endif
    
    // Auto-start the server
    if (MCPServer->Start(55557))
    {
        UE_LOG(LogTemp, Log, TEXT("UE5 MCP Bridge: Server started on port 55557"));
        
#if WITH_EDITOR
        // Show startup notification
        AsyncTask(ENamedThreads::GameThread, [this]()
        {
            FNotificationInfo Info(FText::FromString(TEXT("MCP Bridge server started on port 55557")));
            Info.ExpireDuration = 3.0f;
            Info.bUseLargeFont = false;
            Info.bFireAndForget = true;
            FSlateNotificationManager::Get().AddNotification(Info);
        });
#endif
    }
    else
    {
        UE_LOG(LogTemp, Error, TEXT("UE5 MCP Bridge: Failed to start server"));
    }
}

void FUE5MCPBridgeModule::ShutdownModule()
{
    UE_LOG(LogTemp, Log, TEXT("UE5 MCP Bridge: Shutting down module..."));
    
#if WITH_EDITOR
    // Unregister menu extensions
    if (UToolMenus* ToolMenus = UToolMenus::TryGet())
    {
        ToolMenus->UnRegisterStartupCallback(this);
        ToolMenus->UnregisterOwner(this);
    }
#endif
    
    // Stop the server
    if (MCPServer.IsValid())
    {
        MCPServer->Stop();
        MCPServer.Reset();
    }
}

FUE5MCPBridgeModule& FUE5MCPBridgeModule::Get()
{
    return FModuleManager::LoadModuleChecked<FUE5MCPBridgeModule>("UE5MCPBridge");
}

bool FUE5MCPBridgeModule::IsAvailable()
{
    return FModuleManager::Get().IsModuleLoaded("UE5MCPBridge");
}

bool FUE5MCPBridgeModule::IsServerRunning() const
{
    return MCPServer.IsValid() && MCPServer->IsRunning();
}

int32 FUE5MCPBridgeModule::GetServerPort() const
{
    return MCPServer.IsValid() ? MCPServer->GetPort() : 0;
}

bool FUE5MCPBridgeModule::StartServer(int32 Port)
{
    if (!MCPServer.IsValid())
    {
        MCPServer = MakeShared<FMCPServer>();
    }
    
    if (MCPServer->IsRunning())
    {
        MCPServer->Stop();
    }
    
    return MCPServer->Start(Port);
}

void FUE5MCPBridgeModule::StopServer()
{
    if (MCPServer.IsValid())
    {
        MCPServer->Stop();
    }
}

bool FUE5MCPBridgeModule::RestartServer()
{
    int32 Port = GetServerPort();
    if (Port == 0) Port = 55557;
    
    StopServer();
    return StartServer(Port);
}

void FUE5MCPBridgeModule::RegisterMenuExtensions()
{
#if WITH_EDITOR
    UToolMenu* Menu = UToolMenus::Get()->ExtendMenu("LevelEditor.MainMenu.Tools");
    if (!Menu)
    {
        return;
    }
    
    FToolMenuSection& Section = Menu->FindOrAddSection("MCPBridge");
    Section.Label = LOCTEXT("MCPBridgeSection", "MCP Bridge");
    
    // Status menu entry
    Section.AddMenuEntry(
        "MCPBridgeStatus",
        LOCTEXT("MCPBridgeStatus", "MCP Bridge Status"),
        LOCTEXT("MCPBridgeStatusTooltip", "View MCP Bridge server status"),
        FSlateIcon(),
        FUIAction(
            FExecuteAction::CreateLambda([this]()
            {
                FString StatusMessage;
                if (IsServerRunning())
                {
                    StatusMessage = FString::Printf(
                        TEXT("MCP Server v%s is running on port %d (UE %d.%d)"), 
                        *GetPluginVersion(),
                        GetServerPort(),
                        ENGINE_MAJOR_VERSION,
                        ENGINE_MINOR_VERSION
                    );
                }
                else
                {
                    StatusMessage = TEXT("MCP Server is not running");
                }
                
                // Show notification
                FNotificationInfo Info(FText::FromString(StatusMessage));
                Info.ExpireDuration = 4.0f;
                Info.bUseLargeFont = false;
                Info.bFireAndForget = true;
                FSlateNotificationManager::Get().AddNotification(Info);
            })
        )
    );
    
    // Restart menu entry
    Section.AddMenuEntry(
        "MCPBridgeRestart",
        LOCTEXT("MCPBridgeRestart", "Restart MCP Server"),
        LOCTEXT("MCPBridgeRestartTooltip", "Restart the MCP Bridge server"),
        FSlateIcon(),
        FUIAction(
            FExecuteAction::CreateLambda([this]()
            {
                FString Message;
                if (RestartServer())
                {
                    Message = FString::Printf(TEXT("MCP Server restarted successfully on port %d"), GetServerPort());
                }
                else
                {
                    Message = TEXT("Failed to restart MCP Server");
                }
                
                // Show notification
                FNotificationInfo Info(FText::FromString(Message));
                Info.ExpireDuration = 3.0f;
                Info.bUseLargeFont = false;
                Info.bFireAndForget = true;
                FSlateNotificationManager::Get().AddNotification(Info);
            })
        )
    );
    
    // Stop menu entry
    Section.AddMenuEntry(
        "MCPBridgeStop",
        LOCTEXT("MCPBridgeStop", "Stop MCP Server"),
        LOCTEXT("MCPBridgeStopTooltip", "Stop the MCP Bridge server"),
        FSlateIcon(),
        FUIAction(
            FExecuteAction::CreateLambda([this]()
            {
                StopServer();
                
                FNotificationInfo Info(FText::FromString(TEXT("MCP Server stopped")));
                Info.ExpireDuration = 3.0f;
                Info.bUseLargeFont = false;
                Info.bFireAndForget = true;
                FSlateNotificationManager::Get().AddNotification(Info);
            })
        )
    );
#endif
}

void FUE5MCPBridgeModule::UnregisterMenuExtensions()
{
#if WITH_EDITOR
    if (UToolMenus* ToolMenus = UToolMenus::TryGet())
    {
        ToolMenus->UnregisterOwner(this);
    }
#endif
}

void FUE5MCPBridgeModule::OnEditorInitialized()
{
    // Called when the editor is fully initialized
    // Can be used for delayed initialization if needed
}

#undef LOCTEXT_NAMESPACE

IMPLEMENT_MODULE(FUE5MCPBridgeModule, UE5MCPBridge)
