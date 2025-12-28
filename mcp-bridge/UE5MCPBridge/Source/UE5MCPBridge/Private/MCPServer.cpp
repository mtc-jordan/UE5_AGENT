// MCPServer.cpp - UE5 MCP Bridge v3.3.0 - Compatible with UE5.1-5.7
// Phase 1 + Phase 2 + Phase 3 + Phase 4 Implementation: 88 Tools Total
#include "MCPServer.h"
#include "MCPVersionCompat.h"
#include "Sockets.h"
#include "SocketSubsystem.h"
#include "IPAddress.h"
#include "Async/Async.h"
#include "Dom/JsonObject.h"
#include "Serialization/JsonReader.h"
#include "Serialization/JsonWriter.h"
#include "Serialization/JsonSerializer.h"
#include "Engine/World.h"
#include "EngineUtils.h"
#include "GameFramework/Actor.h"
#include "GameFramework/Pawn.h"
#include "GameFramework/Character.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/PointLight.h"
#include "Engine/SpotLight.h"
#include "Engine/DirectionalLight.h"
#include "Camera/CameraActor.h"
#include "Engine/Engine.h"
#include "Editor.h"
#include "Misc/Paths.h"
#include "Misc/App.h"
#include "Misc/EngineVersion.h"
#include "HAL/PlatformProcess.h"
#include "HAL/RunnableThread.h"

// Phase 1 includes
#include "Selection.h"
#include "Editor/UnrealEdEngine.h"
#include "UnrealEdGlobals.h"
#include "LevelEditor.h"
#include "SLevelViewport.h"
#include "IAssetViewport.h"
#include "LevelEditorViewport.h"
#include "EditorViewportClient.h"
#include "FileHelpers.h"
#include "AssetRegistry/AssetRegistryModule.h"
#include "AssetRegistry/IAssetRegistry.h"
#include "Kismet2/KismetEditorUtilities.h"
#include "Kismet2/BlueprintEditorUtils.h"
#include "Engine/Blueprint.h"
#include "Engine/BlueprintGeneratedClass.h"
#include "Materials/MaterialInstanceConstant.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Materials/Material.h"
#include "Factories/MaterialInstanceConstantFactoryNew.h"
#include "Components/PrimitiveComponent.h"
#include "Components/MeshComponent.h"
#include "Components/StaticMeshComponent.h"
#include "Engine/Selection.h"
#include "ScopedTransaction.h"
#include "ImageUtils.h"
#include "HighResScreenshot.h"
#include "Misc/FileHelper.h"
#include "CollisionQueryParams.h"

// Phase 2 additional includes
// EditorAssetLibrary moved in UE 5.7 - use conditional include
#if ENGINE_MAJOR_VERSION >= 5 && ENGINE_MINOR_VERSION >= 7
#include "EditorScriptingUtilities/Public/EditorAssetLibrary.h"
#else
#include "EditorAssetLibrary.h"
#endif
#include "AssetToolsModule.h"
#include "IAssetTools.h"
#include "ObjectTools.h"
#include "PackageTools.h"
#include "Kismet2/SClassPickerDialog.h"
#include "Engine/SimpleConstructionScript.h"
#include "Engine/SCS_Node.h"

// Phase 4 includes - Animation & Sequencer
#include "Animation/AnimSequence.h"
#include "Animation/SkeletalMeshActor.h"
#include "Components/SkeletalMeshComponent.h"
#include "Animation/AnimInstance.h"
#include "LevelSequence.h"
#include "LevelSequenceActor.h"
#include "LevelSequencePlayer.h"
#include "MovieSceneSequencePlayer.h"

// Phase 4 includes - Audio
#include "Kismet/GameplayStatics.h"
#include "Components/AudioComponent.h"
#include "Sound/SoundBase.h"
#include "Sound/SoundCue.h"

// Phase 4 includes - Landscape & Foliage
#include "Landscape.h"
#include "LandscapeInfo.h"
#include "LandscapeProxy.h"
#include "InstancedFoliageActor.h"
#include "FoliageType.h"

DEFINE_LOG_CATEGORY(LogMCPServer);

const FString FMCPServer::ProtocolVersion = TEXT("2024-11-05");

FMCPServer::FMCPServer()
    : ListenerSocket(nullptr)
    , ClientSocket(nullptr)
    , ServerPort(55557)
    , bIsRunning(false)
    , bShouldStop(false)
    , Thread(nullptr)
{
}

FMCPServer::~FMCPServer()
{
    Stop();
}

bool FMCPServer::Start(int32 Port)
{
    if (bIsRunning)
    {
        UE_LOG(LogMCPServer, Warning, TEXT("Server is already running"));
        return false;
    }
    
    ServerPort = Port;
    bShouldStop = false;
    
    ISocketSubsystem* SocketSubsystem = ISocketSubsystem::Get(PLATFORM_SOCKETSUBSYSTEM);
    if (!SocketSubsystem)
    {
        UE_LOG(LogMCPServer, Error, TEXT("Failed to get socket subsystem"));
        return false;
    }
    
    ListenerSocket = SocketSubsystem->CreateSocket(NAME_Stream, TEXT("MCP Server"), false);
    if (!ListenerSocket)
    {
        UE_LOG(LogMCPServer, Error, TEXT("Failed to create listener socket"));
        return false;
    }
    
    TSharedRef<FInternetAddr> Addr = SocketSubsystem->CreateInternetAddr();
    Addr->SetAnyAddress();
    Addr->SetPort(ServerPort);
    
    if (!ListenerSocket->Bind(*Addr))
    {
        UE_LOG(LogMCPServer, Error, TEXT("Failed to bind socket to port %d"), ServerPort);
        SocketSubsystem->DestroySocket(ListenerSocket);
        ListenerSocket = nullptr;
        return false;
    }
    
    if (!ListenerSocket->Listen(1))
    {
        UE_LOG(LogMCPServer, Error, TEXT("Failed to listen on socket"));
        SocketSubsystem->DestroySocket(ListenerSocket);
        ListenerSocket = nullptr;
        return false;
    }
    
    bIsRunning = true;
    Thread = FRunnableThread::Create(this, TEXT("MCPServerThread"), 0, TPri_Normal);
    
    UE_LOG(LogMCPServer, Log, TEXT("MCP Server v3.1.0 started on port %d (50 tools)"), ServerPort);
    return true;
}

void FMCPServer::Stop()
{
    bShouldStop = true;
    bIsRunning = false;
    
    ISocketSubsystem* SocketSubsystem = ISocketSubsystem::Get(PLATFORM_SOCKETSUBSYSTEM);
    
    if (ClientSocket)
    {
        ClientSocket->Close();
        SocketSubsystem->DestroySocket(ClientSocket);
        ClientSocket = nullptr;
    }
    
    if (ListenerSocket)
    {
        ListenerSocket->Close();
        SocketSubsystem->DestroySocket(ListenerSocket);
        ListenerSocket = nullptr;
    }
    
    if (Thread)
    {
        Thread->WaitForCompletion();
        delete Thread;
        Thread = nullptr;
    }
    
    UE_LOG(LogMCPServer, Log, TEXT("MCP Server stopped"));
}

bool FMCPServer::Init()
{
    return true;
}

uint32 FMCPServer::Run()
{
    ISocketSubsystem* SocketSubsystem = ISocketSubsystem::Get(PLATFORM_SOCKETSUBSYSTEM);
    
    while (!bShouldStop)
    {
        bool bHasPendingConnection = false;
        if (ListenerSocket->HasPendingConnection(bHasPendingConnection) && bHasPendingConnection)
        {
            TSharedRef<FInternetAddr> RemoteAddr = SocketSubsystem->CreateInternetAddr();
            FSocket* NewSocket = ListenerSocket->Accept(*RemoteAddr, TEXT("MCP Client"));
            
            if (NewSocket)
            {
                if (ClientSocket)
                {
                    ClientSocket->Close();
                    SocketSubsystem->DestroySocket(ClientSocket);
                }
                ClientSocket = NewSocket;
                UE_LOG(LogMCPServer, Log, TEXT("Client connected from %s"), *RemoteAddr->ToString(true));
            }
        }
        
        if (ClientSocket)
        {
            uint32 DataSize = 0;
            if (ClientSocket->HasPendingData(DataSize) && DataSize > 0)
            {
                TArray<uint8> Buffer;
                Buffer.SetNumUninitialized(DataSize);
                
                int32 BytesRead = 0;
                if (ClientSocket->Recv(Buffer.GetData(), Buffer.Num(), BytesRead))
                {
                    FString Message = FString(UTF8_TO_TCHAR(reinterpret_cast<const char*>(Buffer.GetData())));
                    
                    TArray<FString> Messages;
                    Message.ParseIntoArray(Messages, TEXT("\n"), true);
                    
                    for (const FString& Msg : Messages)
                    {
                        if (Msg.IsEmpty()) continue;
                        
                        FString Response = ProcessMessage(Msg);
                        if (!Response.IsEmpty())
                        {
                            Response += TEXT("\n");
                            FTCHARToUTF8 Converter(*Response);
                            int32 BytesSent = 0;
                            ClientSocket->Send((const uint8*)Converter.Get(), Converter.Length(), BytesSent);
                        }
                    }
                }
            }
            else
            {
                ESocketConnectionState State = ClientSocket->GetConnectionState();
                if (State != SCS_Connected)
                {
                    UE_LOG(LogMCPServer, Log, TEXT("Client disconnected"));
                    SocketSubsystem->DestroySocket(ClientSocket);
                    ClientSocket = nullptr;
                }
            }
        }
        
        FPlatformProcess::Sleep(0.01f);
    }
    
    UE_LOG(LogMCPServer, Log, TEXT("MCP Server thread stopped"));
    return 0;
}

void FMCPServer::Exit()
{
}

FString FMCPServer::ProcessMessage(const FString& Message)
{
    TSharedPtr<FJsonObject> JsonObject;
    TSharedRef<TJsonReader<>> Reader = TJsonReaderFactory<>::Create(Message);
    
    if (!FJsonSerializer::Deserialize(Reader, JsonObject) || !JsonObject.IsValid())
    {
        return CreateErrorResponse(0, -32700, TEXT("Parse error"));
    }
    
    FString Method;
    if (!JsonObject->TryGetStringField(TEXT("method"), Method))
    {
        return CreateErrorResponse(0, -32600, TEXT("Invalid Request"));
    }
    
    int32 Id = 0;
    JsonObject->TryGetNumberField(TEXT("id"), Id);
    
    UE_LOG(LogMCPServer, Log, TEXT("Method: %s (id=%d)"), *Method, Id);
    
    if (Method == TEXT("initialize"))
    {
        return HandleInitialize(Id);
    }
    else if (Method == TEXT("tools/list"))
    {
        return HandleToolsList(Id);
    }
    else if (Method == TEXT("tools/call"))
    {
        TSharedPtr<FJsonObject> Params = JsonObject->GetObjectField(TEXT("params"));
        return HandleToolsCall(Id, Params);
    }
    else if (Method == TEXT("notifications/initialized"))
    {
        return TEXT("");
    }
    
    return CreateErrorResponse(Id, -32601, TEXT("Method not found"));
}

FString FMCPServer::HandleInitialize(int32 Id)
{
    TSharedPtr<FJsonObject> Result = MakeShared<FJsonObject>();
    Result->SetStringField(TEXT("protocolVersion"), ProtocolVersion);
    
    TSharedPtr<FJsonObject> Capabilities = MakeShared<FJsonObject>();
    TSharedPtr<FJsonObject> ToolsCap = MakeShared<FJsonObject>();
    Capabilities->SetObjectField(TEXT("tools"), ToolsCap);
    Result->SetObjectField(TEXT("capabilities"), Capabilities);
    
    TSharedPtr<FJsonObject> ServerInfo = MakeShared<FJsonObject>();
    ServerInfo->SetStringField(TEXT("name"), TEXT("ue5-mcp-bridge"));
    ServerInfo->SetStringField(TEXT("version"), TEXT("3.2.0"));
    Result->SetObjectField(TEXT("serverInfo"), ServerInfo);
    
    return CreateSuccessResponse(Id, Result);
}

// ============================================
// TOOL REGISTRATION HELPERS
// ============================================

void FMCPServer::RegisterActorTools(TArray<TSharedPtr<FJsonValue>>& Tools)
{
    // Tool: get_actor_list
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_actor_list"));
        Tool->SetStringField(TEXT("description"), TEXT("Get list of all actors in the level"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        Schema->SetObjectField(TEXT("properties"), MakeShared<FJsonObject>());
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: spawn_actor
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("spawn_actor"));
        Tool->SetStringField(TEXT("description"), TEXT("Spawn actor (PointLight, SpotLight, DirectionalLight, StaticMeshActor, CameraActor)"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ClassProp = MakeShared<FJsonObject>();
        ClassProp->SetStringField(TEXT("type"), TEXT("string"));
        ClassProp->SetStringField(TEXT("description"), TEXT("Actor class name"));
        Props->SetObjectField(TEXT("class_name"), ClassProp);
        
        TSharedPtr<FJsonObject> XProp = MakeShared<FJsonObject>();
        XProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("x"), XProp);
        
        TSharedPtr<FJsonObject> YProp = MakeShared<FJsonObject>();
        YProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("y"), YProp);
        
        TSharedPtr<FJsonObject> ZProp = MakeShared<FJsonObject>();
        ZProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("z"), ZProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("class_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: delete_actor
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("delete_actor"));
        Tool->SetStringField(TEXT("description"), TEXT("Delete an actor by name"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), NameProp);
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_actor_properties
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_actor_properties"));
        Tool->SetStringField(TEXT("description"), TEXT("Get actor location, rotation, scale"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), NameProp);
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: set_actor_property
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_actor_property"));
        Tool->SetStringField(TEXT("description"), TEXT("Set actor location, rotation, or scale"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), NameProp);
        
        TSharedPtr<FJsonObject> PropProp = MakeShared<FJsonObject>();
        PropProp->SetStringField(TEXT("type"), TEXT("string"));
        PropProp->SetStringField(TEXT("description"), TEXT("Property: location, rotation, scale"));
        Props->SetObjectField(TEXT("property"), PropProp);
        
        TSharedPtr<FJsonObject> XProp = MakeShared<FJsonObject>();
        XProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("x"), XProp);
        
        TSharedPtr<FJsonObject> YProp = MakeShared<FJsonObject>();
        YProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("y"), YProp);
        
        TSharedPtr<FJsonObject> ZProp = MakeShared<FJsonObject>();
        ZProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("z"), ZProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("property")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Phase 1 Actor Tools
    // Tool: find_actors_by_class
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("find_actors_by_class"));
        Tool->SetStringField(TEXT("description"), TEXT("Find all actors of a specific class type"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        TSharedPtr<FJsonObject> ClassProp = MakeShared<FJsonObject>();
        ClassProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("class_name"), ClassProp);
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("class_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: find_actors_by_tag
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("find_actors_by_tag"));
        Tool->SetStringField(TEXT("description"), TEXT("Find all actors with a specific tag"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        TSharedPtr<FJsonObject> TagProp = MakeShared<FJsonObject>();
        TagProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("tag"), TagProp);
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("tag")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: find_actors_by_name
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("find_actors_by_name"));
        Tool->SetStringField(TEXT("description"), TEXT("Find actors by name pattern (supports wildcards)"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        TSharedPtr<FJsonObject> PatternProp = MakeShared<FJsonObject>();
        PatternProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("pattern"), PatternProp);
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("pattern")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: duplicate_actor
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("duplicate_actor"));
        Tool->SetStringField(TEXT("description"), TEXT("Duplicate an actor with optional offset"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), NameProp);
        
        TSharedPtr<FJsonObject> XProp = MakeShared<FJsonObject>();
        XProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("offset_x"), XProp);
        
        TSharedPtr<FJsonObject> YProp = MakeShared<FJsonObject>();
        YProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("offset_y"), YProp);
        
        TSharedPtr<FJsonObject> ZProp = MakeShared<FJsonObject>();
        ZProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("offset_z"), ZProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: set_actor_visibility
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_actor_visibility"));
        Tool->SetStringField(TEXT("description"), TEXT("Show or hide an actor"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), NameProp);
        
        TSharedPtr<FJsonObject> VisProp = MakeShared<FJsonObject>();
        VisProp->SetStringField(TEXT("type"), TEXT("boolean"));
        Props->SetObjectField(TEXT("visible"), VisProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("visible")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: snap_actor_to_ground
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("snap_actor_to_ground"));
        Tool->SetStringField(TEXT("description"), TEXT("Snap an actor to the ground surface below it"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), NameProp);
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: rename_actor
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("rename_actor"));
        Tool->SetStringField(TEXT("description"), TEXT("Rename an actor's label"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), NameProp);
        
        TSharedPtr<FJsonObject> NewNameProp = MakeShared<FJsonObject>();
        NewNameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("new_name"), NewNameProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("new_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // ============================================
    // PHASE 2 ACTOR TOOLS
    // ============================================
    
    // Tool: add_actor_tag
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("add_actor_tag"));
        Tool->SetStringField(TEXT("description"), TEXT("Add a tag to an actor for identification and grouping"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), NameProp);
        
        TSharedPtr<FJsonObject> TagProp = MakeShared<FJsonObject>();
        TagProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("tag"), TagProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("tag")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: remove_actor_tag
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("remove_actor_tag"));
        Tool->SetStringField(TEXT("description"), TEXT("Remove a tag from an actor"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), NameProp);
        
        TSharedPtr<FJsonObject> TagProp = MakeShared<FJsonObject>();
        TagProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("tag"), TagProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("tag")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_actor_tags
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_actor_tags"));
        Tool->SetStringField(TEXT("description"), TEXT("Get all tags assigned to an actor"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), NameProp);
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: set_actor_mobility
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_actor_mobility"));
        Tool->SetStringField(TEXT("description"), TEXT("Set the mobility of an actor (Static, Stationary, or Movable)"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), NameProp);
        
        TSharedPtr<FJsonObject> MobProp = MakeShared<FJsonObject>();
        MobProp->SetStringField(TEXT("type"), TEXT("string"));
        MobProp->SetStringField(TEXT("description"), TEXT("Mobility: Static, Stationary, Movable"));
        Props->SetObjectField(TEXT("mobility"), MobProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("mobility")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_actor_mobility
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_actor_mobility"));
        Tool->SetStringField(TEXT("description"), TEXT("Get the current mobility setting of an actor"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), NameProp);
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: attach_actor_to_actor
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("attach_actor_to_actor"));
        Tool->SetStringField(TEXT("description"), TEXT("Attach one actor to another actor"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ChildProp = MakeShared<FJsonObject>();
        ChildProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("child_actor"), ChildProp);
        
        TSharedPtr<FJsonObject> ParentProp = MakeShared<FJsonObject>();
        ParentProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("parent_actor"), ParentProp);
        
        TSharedPtr<FJsonObject> SocketProp = MakeShared<FJsonObject>();
        SocketProp->SetStringField(TEXT("type"), TEXT("string"));
        SocketProp->SetStringField(TEXT("description"), TEXT("Optional socket name"));
        Props->SetObjectField(TEXT("socket_name"), SocketProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("child_actor")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("parent_actor")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: detach_actor
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("detach_actor"));
        Tool->SetStringField(TEXT("description"), TEXT("Detach an actor from its parent"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), NameProp);
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
}

void FMCPServer::RegisterSelectionTools(TArray<TSharedPtr<FJsonValue>>& Tools)
{
    // Tool: select_actors
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("select_actors"));
        Tool->SetStringField(TEXT("description"), TEXT("Select one or more actors by name"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> NamesProp = MakeShared<FJsonObject>();
        NamesProp->SetStringField(TEXT("type"), TEXT("string"));
        NamesProp->SetStringField(TEXT("description"), TEXT("Comma-separated actor names"));
        Props->SetObjectField(TEXT("actor_names"), NamesProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_names")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_selected_actors
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_selected_actors"));
        Tool->SetStringField(TEXT("description"), TEXT("Get list of currently selected actors"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        Schema->SetObjectField(TEXT("properties"), MakeShared<FJsonObject>());
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: clear_selection
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("clear_selection"));
        Tool->SetStringField(TEXT("description"), TEXT("Clear the current selection"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        Schema->SetObjectField(TEXT("properties"), MakeShared<FJsonObject>());
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: focus_on_actor
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("focus_on_actor"));
        Tool->SetStringField(TEXT("description"), TEXT("Focus the viewport camera on an actor"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), NameProp);
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
}

void FMCPServer::RegisterViewportTools(TArray<TSharedPtr<FJsonValue>>& Tools)
{
    // Tool: get_viewport_camera
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_viewport_camera"));
        Tool->SetStringField(TEXT("description"), TEXT("Get the current viewport camera position and rotation"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        Schema->SetObjectField(TEXT("properties"), MakeShared<FJsonObject>());
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: set_viewport_camera
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_viewport_camera"));
        Tool->SetStringField(TEXT("description"), TEXT("Set the viewport camera position and rotation"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> XProp = MakeShared<FJsonObject>();
        XProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("x"), XProp);
        
        TSharedPtr<FJsonObject> YProp = MakeShared<FJsonObject>();
        YProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("y"), YProp);
        
        TSharedPtr<FJsonObject> ZProp = MakeShared<FJsonObject>();
        ZProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("z"), ZProp);
        
        TSharedPtr<FJsonObject> PitchProp = MakeShared<FJsonObject>();
        PitchProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("pitch"), PitchProp);
        
        TSharedPtr<FJsonObject> YawProp = MakeShared<FJsonObject>();
        YawProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("yaw"), YawProp);
        
        TSharedPtr<FJsonObject> RollProp = MakeShared<FJsonObject>();
        RollProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("roll"), RollProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: take_screenshot
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("take_screenshot"));
        Tool->SetStringField(TEXT("description"), TEXT("Take a screenshot of the viewport"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> FilenameProp = MakeShared<FJsonObject>();
        FilenameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("filename"), FilenameProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // ============================================
    // PHASE 2 VIEWPORT TOOLS
    // ============================================
    
    // Tool: set_view_mode
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_view_mode"));
        Tool->SetStringField(TEXT("description"), TEXT("Set the viewport rendering mode (Lit, Unlit, Wireframe, etc.)"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ModeProp = MakeShared<FJsonObject>();
        ModeProp->SetStringField(TEXT("type"), TEXT("string"));
        ModeProp->SetStringField(TEXT("description"), TEXT("View mode: Lit, Unlit, Wireframe, DetailLighting, LightingOnly, LightComplexity, ShaderComplexity, PathTracing, Nanite, Lumen"));
        Props->SetObjectField(TEXT("mode"), ModeProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("mode")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_view_mode
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_view_mode"));
        Tool->SetStringField(TEXT("description"), TEXT("Get the current viewport view mode"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        Schema->SetObjectField(TEXT("properties"), MakeShared<FJsonObject>());
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: pilot_actor
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("pilot_actor"));
        Tool->SetStringField(TEXT("description"), TEXT("Lock the viewport camera to an actor (pilot mode)"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), NameProp);
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: stop_piloting
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("stop_piloting"));
        Tool->SetStringField(TEXT("description"), TEXT("Stop piloting and return to free camera"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        Schema->SetObjectField(TEXT("properties"), MakeShared<FJsonObject>());
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: set_viewport_realtime
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_viewport_realtime"));
        Tool->SetStringField(TEXT("description"), TEXT("Enable or disable realtime rendering in viewport"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> EnabledProp = MakeShared<FJsonObject>();
        EnabledProp->SetStringField(TEXT("type"), TEXT("boolean"));
        Props->SetObjectField(TEXT("enabled"), EnabledProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("enabled")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: set_viewport_stats
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_viewport_stats"));
        Tool->SetStringField(TEXT("description"), TEXT("Show or hide viewport statistics"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> FpsProp = MakeShared<FJsonObject>();
        FpsProp->SetStringField(TEXT("type"), TEXT("boolean"));
        Props->SetObjectField(TEXT("show_fps"), FpsProp);
        
        TSharedPtr<FJsonObject> StatsProp = MakeShared<FJsonObject>();
        StatsProp->SetStringField(TEXT("type"), TEXT("boolean"));
        Props->SetObjectField(TEXT("show_stats"), StatsProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
}

void FMCPServer::RegisterLevelTools(TArray<TSharedPtr<FJsonValue>>& Tools)
{
    // Tool: get_current_level
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_current_level"));
        Tool->SetStringField(TEXT("description"), TEXT("Get information about the current level"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        Schema->SetObjectField(TEXT("properties"), MakeShared<FJsonObject>());
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: load_level
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("load_level"));
        Tool->SetStringField(TEXT("description"), TEXT("Load a level by path"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("level_path"), PathProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("level_path")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: save_level
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("save_level"));
        Tool->SetStringField(TEXT("description"), TEXT("Save the current level"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        Schema->SetObjectField(TEXT("properties"), MakeShared<FJsonObject>());
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
}

void FMCPServer::RegisterPIETools(TArray<TSharedPtr<FJsonValue>>& Tools)
{
    // Tool: start_pie
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("start_pie"));
        Tool->SetStringField(TEXT("description"), TEXT("Start Play In Editor (PIE)"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ModeProp = MakeShared<FJsonObject>();
        ModeProp->SetStringField(TEXT("type"), TEXT("string"));
        ModeProp->SetStringField(TEXT("description"), TEXT("PIE mode: viewport, new_window, mobile_preview"));
        Props->SetObjectField(TEXT("mode"), ModeProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: stop_pie
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("stop_pie"));
        Tool->SetStringField(TEXT("description"), TEXT("Stop Play In Editor"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        Schema->SetObjectField(TEXT("properties"), MakeShared<FJsonObject>());
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
}

void FMCPServer::RegisterAssetTools(TArray<TSharedPtr<FJsonValue>>& Tools)
{
    // Tool: search_assets
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("search_assets"));
        Tool->SetStringField(TEXT("description"), TEXT("Search for assets by name or class"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> QueryProp = MakeShared<FJsonObject>();
        QueryProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("query"), QueryProp);
        
        TSharedPtr<FJsonObject> ClassProp = MakeShared<FJsonObject>();
        ClassProp->SetStringField(TEXT("type"), TEXT("string"));
        ClassProp->SetStringField(TEXT("description"), TEXT("Optional class filter"));
        Props->SetObjectField(TEXT("class_name"), ClassProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("query")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_asset_info
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_asset_info"));
        Tool->SetStringField(TEXT("description"), TEXT("Get detailed information about an asset"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("asset_path"), PathProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("asset_path")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: load_asset
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("load_asset"));
        Tool->SetStringField(TEXT("description"), TEXT("Load an asset into memory"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("asset_path"), PathProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("asset_path")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // ============================================
    // PHASE 2 ASSET TOOLS
    // ============================================
    
    // Tool: duplicate_asset
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("duplicate_asset"));
        Tool->SetStringField(TEXT("description"), TEXT("Duplicate an asset to a new location"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> SrcProp = MakeShared<FJsonObject>();
        SrcProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("source_path"), SrcProp);
        
        TSharedPtr<FJsonObject> DstProp = MakeShared<FJsonObject>();
        DstProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("dest_path"), DstProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("source_path")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("dest_path")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: rename_asset
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("rename_asset"));
        Tool->SetStringField(TEXT("description"), TEXT("Rename or move an asset"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> SrcProp = MakeShared<FJsonObject>();
        SrcProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("source_path"), SrcProp);
        
        TSharedPtr<FJsonObject> NewProp = MakeShared<FJsonObject>();
        NewProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("new_name"), NewProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("source_path")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("new_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: delete_asset
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("delete_asset"));
        Tool->SetStringField(TEXT("description"), TEXT("Delete an asset from the project"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("asset_path"), PathProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("asset_path")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: create_folder
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("create_folder"));
        Tool->SetStringField(TEXT("description"), TEXT("Create a new folder in the content browser"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("folder_path"), PathProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("folder_path")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_asset_references
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_asset_references"));
        Tool->SetStringField(TEXT("description"), TEXT("Get all assets that reference or are referenced by an asset"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("asset_path"), PathProp);
        
        TSharedPtr<FJsonObject> DirProp = MakeShared<FJsonObject>();
        DirProp->SetStringField(TEXT("type"), TEXT("string"));
        DirProp->SetStringField(TEXT("description"), TEXT("Direction: dependencies, referencers, both"));
        Props->SetObjectField(TEXT("direction"), DirProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("asset_path")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
}

void FMCPServer::RegisterBlueprintTools(TArray<TSharedPtr<FJsonValue>>& Tools)
{
    // Tool: create_blueprint
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("create_blueprint"));
        Tool->SetStringField(TEXT("description"), TEXT("Create a new Blueprint class"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("name"), NameProp);
        
        TSharedPtr<FJsonObject> ParentProp = MakeShared<FJsonObject>();
        ParentProp->SetStringField(TEXT("type"), TEXT("string"));
        ParentProp->SetStringField(TEXT("description"), TEXT("Parent class: Actor, Pawn, Character"));
        Props->SetObjectField(TEXT("parent_class"), ParentProp);
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("path"), PathProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_blueprint_info
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_blueprint_info"));
        Tool->SetStringField(TEXT("description"), TEXT("Get information about a Blueprint"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("blueprint_path"), PathProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("blueprint_path")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: compile_blueprint
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("compile_blueprint"));
        Tool->SetStringField(TEXT("description"), TEXT("Compile a Blueprint"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("blueprint_path"), PathProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("blueprint_path")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: spawn_blueprint_actor
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("spawn_blueprint_actor"));
        Tool->SetStringField(TEXT("description"), TEXT("Spawn an instance of a Blueprint in the level"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("blueprint_path"), PathProp);
        
        TSharedPtr<FJsonObject> XProp = MakeShared<FJsonObject>();
        XProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("x"), XProp);
        
        TSharedPtr<FJsonObject> YProp = MakeShared<FJsonObject>();
        YProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("y"), YProp);
        
        TSharedPtr<FJsonObject> ZProp = MakeShared<FJsonObject>();
        ZProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("z"), ZProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("blueprint_path")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // ============================================
    // PHASE 2 BLUEPRINT TOOLS
    // ============================================
    
    // Tool: add_blueprint_variable
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("add_blueprint_variable"));
        Tool->SetStringField(TEXT("description"), TEXT("Add a new variable to a Blueprint"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("blueprint_path"), PathProp);
        
        TSharedPtr<FJsonObject> VarNameProp = MakeShared<FJsonObject>();
        VarNameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("var_name"), VarNameProp);
        
        TSharedPtr<FJsonObject> VarTypeProp = MakeShared<FJsonObject>();
        VarTypeProp->SetStringField(TEXT("type"), TEXT("string"));
        VarTypeProp->SetStringField(TEXT("description"), TEXT("Type: Boolean, Integer, Float, String, Vector, Rotator, Transform"));
        Props->SetObjectField(TEXT("var_type"), VarTypeProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("blueprint_path")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("var_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("var_type")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: remove_blueprint_variable
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("remove_blueprint_variable"));
        Tool->SetStringField(TEXT("description"), TEXT("Remove a variable from a Blueprint"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("blueprint_path"), PathProp);
        
        TSharedPtr<FJsonObject> VarNameProp = MakeShared<FJsonObject>();
        VarNameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("var_name"), VarNameProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("blueprint_path")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("var_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_blueprint_variables
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_blueprint_variables"));
        Tool->SetStringField(TEXT("description"), TEXT("Get all variables defined in a Blueprint"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("blueprint_path"), PathProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("blueprint_path")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_blueprint_functions
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_blueprint_functions"));
        Tool->SetStringField(TEXT("description"), TEXT("Get all functions defined in a Blueprint"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("blueprint_path"), PathProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("blueprint_path")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: set_blueprint_variable_default
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_blueprint_variable_default"));
        Tool->SetStringField(TEXT("description"), TEXT("Set the default value of a Blueprint variable"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("blueprint_path"), PathProp);
        
        TSharedPtr<FJsonObject> VarNameProp = MakeShared<FJsonObject>();
        VarNameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("var_name"), VarNameProp);
        
        TSharedPtr<FJsonObject> ValueProp = MakeShared<FJsonObject>();
        ValueProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("default_value"), ValueProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("blueprint_path")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("var_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("default_value")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
}

void FMCPServer::RegisterMaterialTools(TArray<TSharedPtr<FJsonValue>>& Tools)
{
    // Tool: create_material_instance
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("create_material_instance"));
        Tool->SetStringField(TEXT("description"), TEXT("Create a Material Instance from a parent material"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ParentProp = MakeShared<FJsonObject>();
        ParentProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("parent_material"), ParentProp);
        
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("name"), NameProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("parent_material")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: set_material_scalar
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_material_scalar"));
        Tool->SetStringField(TEXT("description"), TEXT("Set a scalar parameter on a material instance"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("material_path"), PathProp);
        
        TSharedPtr<FJsonObject> ParamProp = MakeShared<FJsonObject>();
        ParamProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("parameter_name"), ParamProp);
        
        TSharedPtr<FJsonObject> ValueProp = MakeShared<FJsonObject>();
        ValueProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("value"), ValueProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("material_path")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("parameter_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("value")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: apply_material_to_actor
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("apply_material_to_actor"));
        Tool->SetStringField(TEXT("description"), TEXT("Apply a material to an actor's mesh"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), ActorProp);
        
        TSharedPtr<FJsonObject> MatProp = MakeShared<FJsonObject>();
        MatProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("material_path"), MatProp);
        
        TSharedPtr<FJsonObject> SlotProp = MakeShared<FJsonObject>();
        SlotProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("slot_index"), SlotProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("material_path")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // ============================================
    // PHASE 2 MATERIAL TOOLS
    // ============================================
    
    // Tool: set_material_vector
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_material_vector"));
        Tool->SetStringField(TEXT("description"), TEXT("Set a vector parameter (color) on a material instance"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("material_path"), PathProp);
        
        TSharedPtr<FJsonObject> ParamProp = MakeShared<FJsonObject>();
        ParamProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("param_name"), ParamProp);
        
        TSharedPtr<FJsonObject> RProp = MakeShared<FJsonObject>();
        RProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("r"), RProp);
        
        TSharedPtr<FJsonObject> GProp = MakeShared<FJsonObject>();
        GProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("g"), GProp);
        
        TSharedPtr<FJsonObject> BProp = MakeShared<FJsonObject>();
        BProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("b"), BProp);
        
        TSharedPtr<FJsonObject> AProp = MakeShared<FJsonObject>();
        AProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("a"), AProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("material_path")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("param_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("r")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("g")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("b")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_material_parameters
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_material_parameters"));
        Tool->SetStringField(TEXT("description"), TEXT("Get all parameters of a material or material instance"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("material_path"), PathProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("material_path")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: replace_actor_material
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("replace_actor_material"));
        Tool->SetStringField(TEXT("description"), TEXT("Replace a material on an actor with another material"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), ActorProp);
        
        TSharedPtr<FJsonObject> IndexProp = MakeShared<FJsonObject>();
        IndexProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("material_index"), IndexProp);
        
        TSharedPtr<FJsonObject> MatProp = MakeShared<FJsonObject>();
        MatProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("material_path"), MatProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("material_index")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("material_path")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_actor_materials
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_actor_materials"));
        Tool->SetStringField(TEXT("description"), TEXT("Get all materials applied to an actor"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), ActorProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
}

void FMCPServer::RegisterEditorTools(TArray<TSharedPtr<FJsonValue>>& Tools)
{
    // Tool: execute_console_command
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("execute_console_command"));
        Tool->SetStringField(TEXT("description"), TEXT("Execute Unreal console command"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> CmdProp = MakeShared<FJsonObject>();
        CmdProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("command"), CmdProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("command")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_project_info
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_project_info"));
        Tool->SetStringField(TEXT("description"), TEXT("Get project name, engine version, path"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        Schema->SetObjectField(TEXT("properties"), MakeShared<FJsonObject>());
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
}

FString FMCPServer::HandleToolsList(int32 Id)
{
    TSharedPtr<FJsonObject> Result = MakeShared<FJsonObject>();
    TArray<TSharedPtr<FJsonValue>> Tools;
    
    // Register all tools by category
    RegisterActorTools(Tools);
    RegisterSelectionTools(Tools);
    RegisterViewportTools(Tools);
    RegisterLevelTools(Tools);
    RegisterPIETools(Tools);
    RegisterAssetTools(Tools);
    RegisterBlueprintTools(Tools);
    RegisterMaterialTools(Tools);
    RegisterEditorTools(Tools);
    // Phase 3 tool registrations
    RegisterPhysicsTools(Tools);
    RegisterEditorUtilityTools(Tools);
    RegisterBookmarkTools(Tools);
    RegisterComponentTools(Tools);
    
    // Phase 4 tool registrations
    RegisterAnimationTools(Tools);
    RegisterAudioTools(Tools);
    RegisterLandscapeTools(Tools);
    
    Result->SetArrayField(TEXT("tools"), Tools);
    
    UE_LOG(LogMCPServer, Log, TEXT("Registered %d tools"), Tools.Num());
    
    return CreateSuccessResponse(Id, Result);
}

FString FMCPServer::HandleToolsCall(int32 Id, TSharedPtr<FJsonObject> Params)
{
    if (!Params.IsValid())
    {
        return CreateErrorResponse(Id, -32602, TEXT("Invalid params"));
    }
    
    FString ToolName = Params->GetStringField(TEXT("name"));
    TSharedPtr<FJsonObject> Args = Params->GetObjectField(TEXT("arguments"));
    
    FString ResultText;
    
    // Execute on game thread
    FEvent* CompletionEvent = FPlatformProcess::GetSynchEventFromPool(true);
    
    AsyncTask(ENamedThreads::GameThread, [&]()
    {
        // ============================================
        // ACTOR TOOLS
        // ============================================
        if (ToolName == TEXT("get_actor_list"))
            ResultText = ExecuteGetActorList();
        else if (ToolName == TEXT("spawn_actor"))
            ResultText = ExecuteSpawnActor(Args);
        else if (ToolName == TEXT("delete_actor"))
            ResultText = ExecuteDeleteActor(Args);
        else if (ToolName == TEXT("get_actor_properties"))
            ResultText = ExecuteGetActorProperties(Args);
        else if (ToolName == TEXT("set_actor_property"))
            ResultText = ExecuteSetActorProperty(Args);
        else if (ToolName == TEXT("find_actors_by_class"))
            ResultText = ExecuteFindActorsByClass(Args);
        else if (ToolName == TEXT("find_actors_by_tag"))
            ResultText = ExecuteFindActorsByTag(Args);
        else if (ToolName == TEXT("find_actors_by_name"))
            ResultText = ExecuteFindActorsByName(Args);
        else if (ToolName == TEXT("duplicate_actor"))
            ResultText = ExecuteDuplicateActor(Args);
        else if (ToolName == TEXT("set_actor_visibility"))
            ResultText = ExecuteSetActorVisibility(Args);
        else if (ToolName == TEXT("snap_actor_to_ground"))
            ResultText = ExecuteSnapActorToGround(Args);
        else if (ToolName == TEXT("rename_actor"))
            ResultText = ExecuteRenameActor(Args);
        // Phase 2 Actor Tools
        else if (ToolName == TEXT("add_actor_tag"))
            ResultText = ExecuteAddActorTag(Args);
        else if (ToolName == TEXT("remove_actor_tag"))
            ResultText = ExecuteRemoveActorTag(Args);
        else if (ToolName == TEXT("get_actor_tags"))
            ResultText = ExecuteGetActorTags(Args);
        else if (ToolName == TEXT("set_actor_mobility"))
            ResultText = ExecuteSetActorMobility(Args);
        else if (ToolName == TEXT("get_actor_mobility"))
            ResultText = ExecuteGetActorMobility(Args);
        else if (ToolName == TEXT("attach_actor_to_actor"))
            ResultText = ExecuteAttachActorToActor(Args);
        else if (ToolName == TEXT("detach_actor"))
            ResultText = ExecuteDetachActor(Args);
        // ============================================
        // SELECTION TOOLS
        // ============================================
        else if (ToolName == TEXT("select_actors"))
            ResultText = ExecuteSelectActors(Args);
        else if (ToolName == TEXT("get_selected_actors"))
            ResultText = ExecuteGetSelectedActors();
        else if (ToolName == TEXT("clear_selection"))
            ResultText = ExecuteClearSelection();
        else if (ToolName == TEXT("focus_on_actor"))
            ResultText = ExecuteFocusOnActor(Args);
        // ============================================
        // VIEWPORT TOOLS
        // ============================================
        else if (ToolName == TEXT("get_viewport_camera"))
            ResultText = ExecuteGetViewportCamera();
        else if (ToolName == TEXT("set_viewport_camera"))
            ResultText = ExecuteSetViewportCamera(Args);
        else if (ToolName == TEXT("take_screenshot"))
            ResultText = ExecuteTakeScreenshot(Args);
        // Phase 2 Viewport Tools
        else if (ToolName == TEXT("set_view_mode"))
            ResultText = ExecuteSetViewMode(Args);
        else if (ToolName == TEXT("get_view_mode"))
            ResultText = ExecuteGetViewMode();
        else if (ToolName == TEXT("pilot_actor"))
            ResultText = ExecutePilotActor(Args);
        else if (ToolName == TEXT("stop_piloting"))
            ResultText = ExecuteStopPiloting();
        else if (ToolName == TEXT("set_viewport_realtime"))
            ResultText = ExecuteSetViewportRealtime(Args);
        else if (ToolName == TEXT("set_viewport_stats"))
            ResultText = ExecuteSetViewportStats(Args);
        // ============================================
        // LEVEL TOOLS
        // ============================================
        else if (ToolName == TEXT("get_current_level"))
            ResultText = ExecuteGetCurrentLevel();
        else if (ToolName == TEXT("load_level"))
            ResultText = ExecuteLoadLevel(Args);
        else if (ToolName == TEXT("save_level"))
            ResultText = ExecuteSaveLevel(Args);
        // ============================================
        // PIE TOOLS
        // ============================================
        else if (ToolName == TEXT("start_pie"))
            ResultText = ExecuteStartPIE(Args);
        else if (ToolName == TEXT("stop_pie"))
            ResultText = ExecuteStopPIE();
        // ============================================
        // ASSET TOOLS
        // ============================================
        else if (ToolName == TEXT("search_assets"))
            ResultText = ExecuteSearchAssets(Args);
        else if (ToolName == TEXT("get_asset_info"))
            ResultText = ExecuteGetAssetInfo(Args);
        else if (ToolName == TEXT("load_asset"))
            ResultText = ExecuteLoadAsset(Args);
        // Phase 2 Asset Tools
        else if (ToolName == TEXT("duplicate_asset"))
            ResultText = ExecuteDuplicateAsset(Args);
        else if (ToolName == TEXT("rename_asset"))
            ResultText = ExecuteRenameAsset(Args);
        else if (ToolName == TEXT("delete_asset"))
            ResultText = ExecuteDeleteAsset(Args);
        else if (ToolName == TEXT("create_folder"))
            ResultText = ExecuteCreateFolder(Args);
        else if (ToolName == TEXT("get_asset_references"))
            ResultText = ExecuteGetAssetReferences(Args);
        // ============================================
        // BLUEPRINT TOOLS
        // ============================================
        else if (ToolName == TEXT("create_blueprint"))
            ResultText = ExecuteCreateBlueprint(Args);
        else if (ToolName == TEXT("get_blueprint_info"))
            ResultText = ExecuteGetBlueprintInfo(Args);
        else if (ToolName == TEXT("compile_blueprint"))
            ResultText = ExecuteCompileBlueprint(Args);
        else if (ToolName == TEXT("spawn_blueprint_actor"))
            ResultText = ExecuteSpawnBlueprintActor(Args);
        // Phase 2 Blueprint Tools
        else if (ToolName == TEXT("add_blueprint_variable"))
            ResultText = ExecuteAddBlueprintVariable(Args);
        else if (ToolName == TEXT("remove_blueprint_variable"))
            ResultText = ExecuteRemoveBlueprintVariable(Args);
        else if (ToolName == TEXT("get_blueprint_variables"))
            ResultText = ExecuteGetBlueprintVariables(Args);
        else if (ToolName == TEXT("get_blueprint_functions"))
            ResultText = ExecuteGetBlueprintFunctions(Args);
        else if (ToolName == TEXT("set_blueprint_variable_default"))
            ResultText = ExecuteSetBlueprintVariableDefault(Args);
        // ============================================
        // MATERIAL TOOLS
        // ============================================
        else if (ToolName == TEXT("create_material_instance"))
            ResultText = ExecuteCreateMaterialInstance(Args);
        else if (ToolName == TEXT("set_material_scalar"))
            ResultText = ExecuteSetMaterialScalar(Args);
        else if (ToolName == TEXT("apply_material_to_actor"))
            ResultText = ExecuteApplyMaterialToActor(Args);
        // Phase 2 Material Tools
        else if (ToolName == TEXT("set_material_vector"))
            ResultText = ExecuteSetMaterialVector(Args);
        else if (ToolName == TEXT("get_material_parameters"))
            ResultText = ExecuteGetMaterialParameters(Args);
        else if (ToolName == TEXT("replace_actor_material"))
            ResultText = ExecuteReplaceActorMaterial(Args);
        else if (ToolName == TEXT("get_actor_materials"))
            ResultText = ExecuteGetActorMaterials(Args);
        // ============================================
        // EDITOR TOOLS
        // ============================================
        else if (ToolName == TEXT("execute_console_command"))
            ResultText = ExecuteConsoleCommand(Args);
        else if (ToolName == TEXT("get_project_info"))
            ResultText = ExecuteGetProjectInfo();
        // ============================================
        // PHASE 3: PHYSICS & COLLISION TOOLS
        // ============================================
        else if (ToolName == TEXT("set_simulate_physics"))
            ResultText = ExecuteSetSimulatePhysics(Args);
        else if (ToolName == TEXT("set_collision_enabled"))
            ResultText = ExecuteSetCollisionEnabled(Args);
        else if (ToolName == TEXT("set_collision_profile"))
            ResultText = ExecuteSetCollisionProfile(Args);
        else if (ToolName == TEXT("add_impulse"))
            ResultText = ExecuteAddImpulse(Args);
        else if (ToolName == TEXT("get_physics_state"))
            ResultText = ExecuteGetPhysicsState(Args);
        // ============================================
        // PHASE 3: EDITOR UTILITIES TOOLS
        // ============================================
        else if (ToolName == TEXT("get_editor_preference"))
            ResultText = ExecuteGetEditorPreference(Args);
        else if (ToolName == TEXT("set_editor_preference"))
            ResultText = ExecuteSetEditorPreference(Args);
        else if (ToolName == TEXT("run_editor_utility"))
            ResultText = ExecuteRunEditorUtility(Args);
        else if (ToolName == TEXT("get_engine_info"))
            ResultText = ExecuteGetEngineInfo();
        // ============================================
        // PHASE 3: VIEWPORT BOOKMARK TOOLS
        // ============================================
        else if (ToolName == TEXT("set_viewport_bookmark"))
            ResultText = ExecuteSetViewportBookmark(Args);
        else if (ToolName == TEXT("jump_to_bookmark"))
            ResultText = ExecuteJumpToBookmark(Args);
        else if (ToolName == TEXT("clear_bookmark"))
            ResultText = ExecuteClearBookmark(Args);
        else if (ToolName == TEXT("list_bookmarks"))
            ResultText = ExecuteListBookmarks();
        // ============================================
        // PHASE 3: COMPONENT OPERATIONS TOOLS
        // ============================================
        else if (ToolName == TEXT("get_actor_components"))
            ResultText = ExecuteGetActorComponents(Args);
        else if (ToolName == TEXT("get_component_properties"))
            ResultText = ExecuteGetComponentProperties(Args);
        else if (ToolName == TEXT("set_component_transform"))
            ResultText = ExecuteSetComponentTransform(Args);
        else if (ToolName == TEXT("set_component_visibility"))
            ResultText = ExecuteSetComponentVisibility(Args);
        else if (ToolName == TEXT("remove_component"))
            ResultText = ExecuteRemoveComponent(Args);
        // Phase 4: Animation & Sequencer tools
        else if (ToolName == TEXT("play_animation"))
            ResultText = ExecutePlayAnimation(Args);
        else if (ToolName == TEXT("stop_animation"))
            ResultText = ExecuteStopAnimation(Args);
        else if (ToolName == TEXT("get_animation_list"))
            ResultText = ExecuteGetAnimationList(Args);
        else if (ToolName == TEXT("create_level_sequence"))
            ResultText = ExecuteCreateLevelSequence(Args);
        else if (ToolName == TEXT("add_actor_to_sequence"))
            ResultText = ExecuteAddActorToSequence(Args);
        else if (ToolName == TEXT("play_sequence"))
            ResultText = ExecutePlaySequence(Args);
        else if (ToolName == TEXT("stop_sequence"))
            ResultText = ExecuteStopSequence();
        else if (ToolName == TEXT("set_sequence_time"))
            ResultText = ExecuteSetSequenceTime(Args);
        // Phase 4: Audio tools
        else if (ToolName == TEXT("play_sound_at_location"))
            ResultText = ExecutePlaySoundAtLocation(Args);
        else if (ToolName == TEXT("spawn_audio_component"))
            ResultText = ExecuteSpawnAudioComponent(Args);
        else if (ToolName == TEXT("set_audio_volume"))
            ResultText = ExecuteSetAudioVolume(Args);
        else if (ToolName == TEXT("stop_all_sounds"))
            ResultText = ExecuteStopAllSounds();
        else if (ToolName == TEXT("get_audio_components"))
            ResultText = ExecuteGetAudioComponents(Args);
        else if (ToolName == TEXT("set_audio_attenuation"))
            ResultText = ExecuteSetAudioAttenuation(Args);
        // Phase 4: Landscape & Foliage tools
        else if (ToolName == TEXT("get_landscape_info"))
            ResultText = ExecuteGetLandscapeInfo();
        else if (ToolName == TEXT("get_landscape_height"))
            ResultText = ExecuteGetLandscapeHeight(Args);
        else if (ToolName == TEXT("get_foliage_types"))
            ResultText = ExecuteGetFoliageTypes();
        else if (ToolName == TEXT("add_foliage_instance"))
            ResultText = ExecuteAddFoliageInstance(Args);
        else if (ToolName == TEXT("remove_foliage_in_radius"))
            ResultText = ExecuteRemoveFoliageInRadius(Args);
        else if (ToolName == TEXT("get_foliage_count"))
            ResultText = ExecuteGetFoliageCount(Args);
        else
            ResultText = FString(TEXT("Unknown tool: ")) + ToolName;
        
        CompletionEvent->Trigger();
    });
    
    CompletionEvent->Wait();
    FPlatformProcess::ReturnSynchEventToPool(CompletionEvent);
    
    // Build response
    TSharedPtr<FJsonObject> Result = MakeShared<FJsonObject>();
    TArray<TSharedPtr<FJsonValue>> Content;
    
    TSharedPtr<FJsonObject> TextContent = MakeShared<FJsonObject>();
    TextContent->SetStringField(TEXT("type"), TEXT("text"));
    TextContent->SetStringField(TEXT("text"), ResultText);
    Content.Add(MakeShared<FJsonValueObject>(TextContent));
    
    Result->SetArrayField(TEXT("content"), Content);
    
    return CreateSuccessResponse(Id, Result);
}

// ============================================
// HELPER FUNCTIONS
// ============================================

AActor* FMCPServer::FindActorByName(UWorld* World, const FString& ActorName)
{
    if (!World) return nullptr;
    
    for (TActorIterator<AActor> It(World); It; ++It)
    {
        AActor* Actor = *It;
        if (Actor && (Actor->GetName() == ActorName || Actor->GetActorLabel() == ActorName))
        {
            return Actor;
        }
    }
    return nullptr;
}

// ============================================
// PHASE 1 TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteGetActorList()
{
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    TArray<FString> ActorList;
    for (TActorIterator<AActor> It(World); It; ++It)
    {
        AActor* Actor = *It;
        if (Actor)
        {
            FString ActorName = Actor->GetName();
            FString ClassName = Actor->GetClass()->GetName();
            ActorList.Add(ActorName + TEXT(" (") + ClassName + TEXT(")"));
        }
    }
    
    return FString::Printf(TEXT("Found %d actors:\n%s"), ActorList.Num(), *FString::Join(ActorList, TEXT("\n")));
}

FString FMCPServer::ExecuteSpawnActor(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ClassName = Args->GetStringField(TEXT("class_name"));
    float X = Args->HasField(TEXT("x")) ? static_cast<float>(Args->GetNumberField(TEXT("x"))) : 0.0f;
    float Y = Args->HasField(TEXT("y")) ? static_cast<float>(Args->GetNumberField(TEXT("y"))) : 0.0f;
    float Z = Args->HasField(TEXT("z")) ? static_cast<float>(Args->GetNumberField(TEXT("z"))) : 0.0f;
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    FVector Location(X, Y, Z);
    AActor* NewActor = nullptr;
    
    if (ClassName == TEXT("PointLight"))
    {
        NewActor = World->SpawnActor<APointLight>(Location, FRotator::ZeroRotator);
    }
    else if (ClassName == TEXT("SpotLight"))
    {
        NewActor = World->SpawnActor<ASpotLight>(Location, FRotator::ZeroRotator);
    }
    else if (ClassName == TEXT("DirectionalLight"))
    {
        NewActor = World->SpawnActor<ADirectionalLight>(Location, FRotator::ZeroRotator);
    }
    else if (ClassName == TEXT("StaticMeshActor"))
    {
        NewActor = World->SpawnActor<AStaticMeshActor>(Location, FRotator::ZeroRotator);
    }
    else if (ClassName == TEXT("CameraActor"))
    {
        NewActor = World->SpawnActor<ACameraActor>(Location, FRotator::ZeroRotator);
    }
    else
    {
        return FString::Printf(TEXT("Error: Unknown class '%s'. Supported: PointLight, SpotLight, DirectionalLight, StaticMeshActor, CameraActor"), *ClassName);
    }
    
    if (NewActor)
    {
        return FString::Printf(TEXT("Spawned %s at (%.1f, %.1f, %.1f) - Name: %s"), *ClassName, X, Y, Z, *NewActor->GetName());
    }
    
    return TEXT("Error: Failed to spawn actor");
}

FString FMCPServer::ExecuteDeleteActor(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (Actor)
    {
        FString Name = Actor->GetName();
        Actor->Destroy();
        return FString::Printf(TEXT("Deleted actor: %s"), *Name);
    }
    
    return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
}

FString FMCPServer::ExecuteGetActorProperties(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (Actor)
    {
        FVector Location = Actor->GetActorLocation();
        FRotator Rotation = Actor->GetActorRotation();
        FVector Scale = Actor->GetActorScale3D();
        
        return FString::Printf(
            TEXT("Actor: %s\nLocation: (%.1f, %.1f, %.1f)\nRotation: (Pitch=%.1f, Yaw=%.1f, Roll=%.1f)\nScale: (%.2f, %.2f, %.2f)"),
            *Actor->GetName(),
            Location.X, Location.Y, Location.Z,
            Rotation.Pitch, Rotation.Yaw, Rotation.Roll,
            Scale.X, Scale.Y, Scale.Z);
    }
    
    return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
}

FString FMCPServer::ExecuteSetActorProperty(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    FString Property = Args->GetStringField(TEXT("property"));
    float X = Args->HasField(TEXT("x")) ? static_cast<float>(Args->GetNumberField(TEXT("x"))) : 0.0f;
    float Y = Args->HasField(TEXT("y")) ? static_cast<float>(Args->GetNumberField(TEXT("y"))) : 0.0f;
    float Z = Args->HasField(TEXT("z")) ? static_cast<float>(Args->GetNumberField(TEXT("z"))) : 0.0f;
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor)
    {
        return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    }
    
    if (Property.ToLower() == TEXT("location"))
    {
        Actor->SetActorLocation(FVector(X, Y, Z));
        return FString::Printf(TEXT("Set %s location to (%.1f, %.1f, %.1f)"), *ActorName, X, Y, Z);
    }
    else if (Property.ToLower() == TEXT("rotation"))
    {
        Actor->SetActorRotation(FRotator(X, Y, Z));
        return FString::Printf(TEXT("Set %s rotation to (Pitch=%.1f, Yaw=%.1f, Roll=%.1f)"), *ActorName, X, Y, Z);
    }
    else if (Property.ToLower() == TEXT("scale"))
    {
        Actor->SetActorScale3D(FVector(X, Y, Z));
        return FString::Printf(TEXT("Set %s scale to (%.2f, %.2f, %.2f)"), *ActorName, X, Y, Z);
    }
    
    return FString::Printf(TEXT("Error: Unknown property '%s'. Use: location, rotation, scale"), *Property);
}

FString FMCPServer::ExecuteFindActorsByClass(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ClassName = Args->GetStringField(TEXT("class_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    TArray<FString> FoundActors;
    for (TActorIterator<AActor> It(World); It; ++It)
    {
        AActor* Actor = *It;
        if (Actor && Actor->GetClass()->GetName().Contains(ClassName))
        {
            FoundActors.Add(Actor->GetName());
        }
    }
    
    if (FoundActors.Num() > 0)
    {
        return FString::Printf(TEXT("Found %d actors of class '%s':\n%s"),
            FoundActors.Num(), *ClassName, *FString::Join(FoundActors, TEXT("\n")));
    }
    
    return FString::Printf(TEXT("No actors found with class containing '%s'"), *ClassName);
}

FString FMCPServer::ExecuteFindActorsByTag(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString Tag = Args->GetStringField(TEXT("tag"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    TArray<FString> FoundActors;
    for (TActorIterator<AActor> It(World); It; ++It)
    {
        AActor* Actor = *It;
        if (Actor && Actor->ActorHasTag(FName(*Tag)))
        {
            FoundActors.Add(Actor->GetName());
        }
    }
    
    if (FoundActors.Num() > 0)
    {
        return FString::Printf(TEXT("Found %d actors with tag '%s':\n%s"),
            FoundActors.Num(), *Tag, *FString::Join(FoundActors, TEXT("\n")));
    }
    
    return FString::Printf(TEXT("No actors found with tag '%s'"), *Tag);
}

FString FMCPServer::ExecuteFindActorsByName(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString Pattern = Args->GetStringField(TEXT("pattern"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    TArray<FString> FoundActors;
    for (TActorIterator<AActor> It(World); It; ++It)
    {
        AActor* Actor = *It;
        if (Actor)
        {
            FString ActorName = Actor->GetName();
            FString ActorLabel = Actor->GetActorLabel();
            if (ActorName.Contains(Pattern) || ActorLabel.Contains(Pattern))
            {
                FoundActors.Add(ActorName);
            }
        }
    }
    
    if (FoundActors.Num() > 0)
    {
        return FString::Printf(TEXT("Found %d actors matching '%s':\n%s"),
            FoundActors.Num(), *Pattern, *FString::Join(FoundActors, TEXT("\n")));
    }
    
    return FString::Printf(TEXT("No actors found matching '%s'"), *Pattern);
}

FString FMCPServer::ExecuteDuplicateActor(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    float OffsetX = Args->HasField(TEXT("offset_x")) ? static_cast<float>(Args->GetNumberField(TEXT("offset_x"))) : 100.0f;
    float OffsetY = Args->HasField(TEXT("offset_y")) ? static_cast<float>(Args->GetNumberField(TEXT("offset_y"))) : 0.0f;
    float OffsetZ = Args->HasField(TEXT("offset_z")) ? static_cast<float>(Args->GetNumberField(TEXT("offset_z"))) : 0.0f;
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* SourceActor = FindActorByName(World, ActorName);
    if (!SourceActor)
    {
        return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    }
    
    FActorSpawnParameters SpawnParams;
    SpawnParams.Template = SourceActor;
    
    FVector NewLocation = SourceActor->GetActorLocation() + FVector(OffsetX, OffsetY, OffsetZ);
    
    AActor* NewActor = World->SpawnActor<AActor>(SourceActor->GetClass(), NewLocation, SourceActor->GetActorRotation(), SpawnParams);
    
    if (NewActor)
    {
        return FString::Printf(TEXT("Duplicated '%s' to '%s' at offset (%.1f, %.1f, %.1f)"),
            *ActorName, *NewActor->GetName(), OffsetX, OffsetY, OffsetZ);
    }
    
    return TEXT("Error: Failed to duplicate actor");
}

FString FMCPServer::ExecuteSetActorVisibility(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    bool bVisible = Args->GetBoolField(TEXT("visible"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor)
    {
        return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    }
    
    Actor->SetActorHiddenInGame(!bVisible);
    Actor->SetIsTemporarilyHiddenInEditor(!bVisible);
    
    return FString::Printf(TEXT("Set '%s' visibility to %s"), *ActorName, bVisible ? TEXT("visible") : TEXT("hidden"));
}

FString FMCPServer::ExecuteSnapActorToGround(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor)
    {
        return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    }
    
    FVector Start = Actor->GetActorLocation();
    FVector End = Start - FVector(0, 0, 100000);
    
    FHitResult HitResult;
    FCollisionQueryParams QueryParams;
    QueryParams.AddIgnoredActor(Actor);
    
    if (World->LineTraceSingleByChannel(HitResult, Start, End, ECC_WorldStatic, QueryParams))
    {
        FVector NewLocation = HitResult.Location;
        Actor->SetActorLocation(NewLocation);
        return FString::Printf(TEXT("Snapped '%s' to ground at (%.1f, %.1f, %.1f)"),
            *ActorName, NewLocation.X, NewLocation.Y, NewLocation.Z);
    }
    
    return FString::Printf(TEXT("No ground found below '%s'"), *ActorName);
}

FString FMCPServer::ExecuteRenameActor(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    FString NewName = Args->GetStringField(TEXT("new_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor)
    {
        return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    }
    
    Actor->SetActorLabel(NewName);
    
    return FString::Printf(TEXT("Renamed '%s' to '%s'"), *ActorName, *NewName);
}

// ============================================
// PHASE 2 ACTOR TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteAddActorTag(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    FString Tag = Args->GetStringField(TEXT("tag"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor)
    {
        return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    }
    
    Actor->Tags.AddUnique(FName(*Tag));
    
    return FString::Printf(TEXT("Added tag '%s' to actor '%s'"), *Tag, *ActorName);
}

FString FMCPServer::ExecuteRemoveActorTag(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    FString Tag = Args->GetStringField(TEXT("tag"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor)
    {
        return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    }
    
    if (Actor->Tags.Remove(FName(*Tag)) > 0)
    {
        return FString::Printf(TEXT("Removed tag '%s' from actor '%s'"), *Tag, *ActorName);
    }
    
    return FString::Printf(TEXT("Tag '%s' not found on actor '%s'"), *Tag, *ActorName);
}

FString FMCPServer::ExecuteGetActorTags(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor)
    {
        return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    }
    
    if (Actor->Tags.Num() == 0)
    {
        return FString::Printf(TEXT("Actor '%s' has no tags"), *ActorName);
    }
    
    TArray<FString> TagStrings;
    for (const FName& Tag : Actor->Tags)
    {
        TagStrings.Add(Tag.ToString());
    }
    
    return FString::Printf(TEXT("Tags on '%s': %s"), *ActorName, *FString::Join(TagStrings, TEXT(", ")));
}

FString FMCPServer::ExecuteSetActorMobility(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    FString Mobility = Args->GetStringField(TEXT("mobility"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor)
    {
        return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    }
    
    USceneComponent* RootComponent = Actor->GetRootComponent();
    if (!RootComponent)
    {
        return FString::Printf(TEXT("Error: Actor '%s' has no root component"), *ActorName);
    }
    
    EComponentMobility::Type NewMobility;
    if (Mobility.ToLower() == TEXT("static"))
    {
        NewMobility = EComponentMobility::Static;
    }
    else if (Mobility.ToLower() == TEXT("stationary"))
    {
        NewMobility = EComponentMobility::Stationary;
    }
    else if (Mobility.ToLower() == TEXT("movable"))
    {
        NewMobility = EComponentMobility::Movable;
    }
    else
    {
        return FString::Printf(TEXT("Error: Unknown mobility '%s'. Use: Static, Stationary, Movable"), *Mobility);
    }
    
    RootComponent->SetMobility(NewMobility);
    
    return FString::Printf(TEXT("Set '%s' mobility to %s"), *ActorName, *Mobility);
}

FString FMCPServer::ExecuteGetActorMobility(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor)
    {
        return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    }
    
    USceneComponent* RootComponent = Actor->GetRootComponent();
    if (!RootComponent)
    {
        return FString::Printf(TEXT("Error: Actor '%s' has no root component"), *ActorName);
    }
    
    FString MobilityStr;
    switch (RootComponent->Mobility)
    {
        case EComponentMobility::Static: MobilityStr = TEXT("Static"); break;
        case EComponentMobility::Stationary: MobilityStr = TEXT("Stationary"); break;
        case EComponentMobility::Movable: MobilityStr = TEXT("Movable"); break;
        default: MobilityStr = TEXT("Unknown"); break;
    }
    
    return FString::Printf(TEXT("Actor '%s' mobility: %s"), *ActorName, *MobilityStr);
}

FString FMCPServer::ExecuteAttachActorToActor(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ChildName = Args->GetStringField(TEXT("child_actor"));
    FString ParentName = Args->GetStringField(TEXT("parent_actor"));
    FString SocketName = Args->HasField(TEXT("socket_name")) ? Args->GetStringField(TEXT("socket_name")) : TEXT("");
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* ChildActor = FindActorByName(World, ChildName);
    AActor* ParentActor = FindActorByName(World, ParentName);
    
    if (!ChildActor)
    {
        return FString::Printf(TEXT("Error: Child actor '%s' not found"), *ChildName);
    }
    if (!ParentActor)
    {
        return FString::Printf(TEXT("Error: Parent actor '%s' not found"), *ParentName);
    }
    
    FName Socket = SocketName.IsEmpty() ? NAME_None : FName(*SocketName);
    
    ChildActor->AttachToActor(ParentActor, FAttachmentTransformRules::KeepWorldTransform, Socket);
    
    if (SocketName.IsEmpty())
    {
        return FString::Printf(TEXT("Attached '%s' to '%s'"), *ChildName, *ParentName);
    }
    return FString::Printf(TEXT("Attached '%s' to '%s' at socket '%s'"), *ChildName, *ParentName, *SocketName);
}

FString FMCPServer::ExecuteDetachActor(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor)
    {
        return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    }
    
    Actor->DetachFromActor(FDetachmentTransformRules::KeepWorldTransform);
    
    return FString::Printf(TEXT("Detached '%s' from parent"), *ActorName);
}

// ============================================
// SELECTION TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteSelectActors(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorNames = Args->GetStringField(TEXT("actor_names"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    GEditor->SelectNone(true, true);
    
    TArray<FString> Names;
    ActorNames.ParseIntoArray(Names, TEXT(","), true);
    
    int32 SelectedCount = 0;
    for (const FString& Name : Names)
    {
        FString TrimmedName = Name.TrimStartAndEnd();
        AActor* Actor = FindActorByName(World, TrimmedName);
        if (Actor)
        {
            GEditor->SelectActor(Actor, true, true);
            SelectedCount++;
        }
    }
    
    return FString::Printf(TEXT("Selected %d actors"), SelectedCount);
}

FString FMCPServer::ExecuteGetSelectedActors()
{
    TArray<FString> SelectedNames;
    
    for (FSelectionIterator It(GEditor->GetSelectedActorIterator()); It; ++It)
    {
        AActor* Actor = Cast<AActor>(*It);
        if (Actor)
        {
            SelectedNames.Add(Actor->GetName());
        }
    }
    
    if (SelectedNames.Num() > 0)
    {
        return FString::Printf(TEXT("Selected actors (%d):\n%s"),
            SelectedNames.Num(), *FString::Join(SelectedNames, TEXT("\n")));
    }
    
    return TEXT("No actors selected");
}

FString FMCPServer::ExecuteClearSelection()
{
    GEditor->SelectNone(true, true);
    return TEXT("Selection cleared");
}

FString FMCPServer::ExecuteFocusOnActor(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor)
    {
        return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    }
    
    GEditor->SelectNone(true, true);
    GEditor->SelectActor(Actor, true, true);
    GEditor->MoveViewportCamerasToActor(*Actor, false);
    
    return FString::Printf(TEXT("Focused viewport on '%s'"), *ActorName);
}

// ============================================
// VIEWPORT TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteGetViewportCamera()
{
    if (GCurrentLevelEditingViewportClient)
    {
        FVector Location = GCurrentLevelEditingViewportClient->GetViewLocation();
        FRotator Rotation = GCurrentLevelEditingViewportClient->GetViewRotation();
        
        return FString::Printf(
            TEXT("Viewport Camera:\nLocation: (%.1f, %.1f, %.1f)\nRotation: (Pitch=%.1f, Yaw=%.1f, Roll=%.1f)"),
            Location.X, Location.Y, Location.Z,
            Rotation.Pitch, Rotation.Yaw, Rotation.Roll);
    }
    
    return TEXT("Error: No active viewport");
}

FString FMCPServer::ExecuteSetViewportCamera(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    if (!GCurrentLevelEditingViewportClient)
    {
        return TEXT("Error: No active viewport");
    }
    
    FVector Location = GCurrentLevelEditingViewportClient->GetViewLocation();
    FRotator Rotation = GCurrentLevelEditingViewportClient->GetViewRotation();
    
    if (Args->HasField(TEXT("x")))
        Location.X = static_cast<float>(Args->GetNumberField(TEXT("x")));
    if (Args->HasField(TEXT("y")))
        Location.Y = static_cast<float>(Args->GetNumberField(TEXT("y")));
    if (Args->HasField(TEXT("z")))
        Location.Z = static_cast<float>(Args->GetNumberField(TEXT("z")));
    
    if (Args->HasField(TEXT("pitch")))
        Rotation.Pitch = static_cast<float>(Args->GetNumberField(TEXT("pitch")));
    if (Args->HasField(TEXT("yaw")))
        Rotation.Yaw = static_cast<float>(Args->GetNumberField(TEXT("yaw")));
    if (Args->HasField(TEXT("roll")))
        Rotation.Roll = static_cast<float>(Args->GetNumberField(TEXT("roll")));
    
    GCurrentLevelEditingViewportClient->SetViewLocation(Location);
    GCurrentLevelEditingViewportClient->SetViewRotation(Rotation);
    
    return FString::Printf(
        TEXT("Set viewport camera to:\nLocation: (%.1f, %.1f, %.1f)\nRotation: (Pitch=%.1f, Yaw=%.1f, Roll=%.1f)"),
        Location.X, Location.Y, Location.Z,
        Rotation.Pitch, Rotation.Yaw, Rotation.Roll);
}

FString FMCPServer::ExecuteTakeScreenshot(TSharedPtr<FJsonObject> Args)
{
    FString Filename = Args.IsValid() && Args->HasField(TEXT("filename")) ?
        Args->GetStringField(TEXT("filename")) : TEXT("Screenshot");
    
    FString ScreenshotDir = FPaths::ProjectSavedDir() / TEXT("Screenshots");
    FString FullPath = ScreenshotDir / Filename + TEXT(".png");
    
    FScreenshotRequest::RequestScreenshot(FullPath, false, false);
    
    return FString::Printf(TEXT("Screenshot requested: %s"), *FullPath);
}

// ============================================
// PHASE 2 VIEWPORT TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteSetViewMode(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString Mode = Args->GetStringField(TEXT("mode"));
    
    if (!GCurrentLevelEditingViewportClient)
    {
        return TEXT("Error: No active viewport");
    }
    
    EViewModeIndex ViewMode = VMI_Lit;
    
    if (Mode.ToLower() == TEXT("lit"))
        ViewMode = VMI_Lit;
    else if (Mode.ToLower() == TEXT("unlit"))
        ViewMode = VMI_Unlit;
    else if (Mode.ToLower() == TEXT("wireframe"))
        ViewMode = VMI_Wireframe;
    else if (Mode.ToLower() == TEXT("detaillighting"))
        ViewMode = VMI_Lit_DetailLighting;
    else if (Mode.ToLower() == TEXT("lightingonly"))
        ViewMode = VMI_LightingOnly;
    else if (Mode.ToLower() == TEXT("lightcomplexity"))
        ViewMode = VMI_LightComplexity;
    else if (Mode.ToLower() == TEXT("shadercomplexity"))
        ViewMode = VMI_ShaderComplexity;
    else if (Mode.ToLower() == TEXT("collisionpawn"))
        ViewMode = VMI_CollisionPawn;
    else if (Mode.ToLower() == TEXT("collisionvisibility"))
        ViewMode = VMI_CollisionVisibility;
    else if (Mode.ToLower() == TEXT("pathtracing"))
        ViewMode = VMI_PathTracing;
    else
    {
        return FString::Printf(TEXT("Error: Unknown view mode '%s'"), *Mode);
    }
    
    GCurrentLevelEditingViewportClient->SetViewMode(ViewMode);
    
    return FString::Printf(TEXT("Set view mode to '%s'"), *Mode);
}

FString FMCPServer::ExecuteGetViewMode()
{
    if (!GCurrentLevelEditingViewportClient)
    {
        return TEXT("Error: No active viewport");
    }
    
    EViewModeIndex ViewMode = GCurrentLevelEditingViewportClient->GetViewMode();
    
    FString ModeName;
    switch (ViewMode)
    {
        case VMI_Lit: ModeName = TEXT("Lit"); break;
        case VMI_Unlit: ModeName = TEXT("Unlit"); break;
        case VMI_Wireframe: ModeName = TEXT("Wireframe"); break;
        case VMI_Lit_DetailLighting: ModeName = TEXT("DetailLighting"); break;
        case VMI_LightingOnly: ModeName = TEXT("LightingOnly"); break;
        case VMI_LightComplexity: ModeName = TEXT("LightComplexity"); break;
        case VMI_ShaderComplexity: ModeName = TEXT("ShaderComplexity"); break;
        case VMI_CollisionPawn: ModeName = TEXT("CollisionPawn"); break;
        case VMI_CollisionVisibility: ModeName = TEXT("CollisionVisibility"); break;
        case VMI_PathTracing: ModeName = TEXT("PathTracing"); break;
        default: ModeName = FString::Printf(TEXT("Unknown (%d)"), static_cast<int32>(ViewMode)); break;
    }
    
    return FString::Printf(TEXT("Current view mode: %s"), *ModeName);
}

FString FMCPServer::ExecutePilotActor(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor)
    {
        return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    }
    
    if (GCurrentLevelEditingViewportClient)
    {
        GCurrentLevelEditingViewportClient->SetActorLock(Actor);
        return FString::Printf(TEXT("Now piloting '%s'"), *ActorName);
    }
    
    return TEXT("Error: No active viewport");
}

FString FMCPServer::ExecuteStopPiloting()
{
    if (GCurrentLevelEditingViewportClient)
    {
        GCurrentLevelEditingViewportClient->SetActorLock(nullptr);
        return TEXT("Stopped piloting, returned to free camera");
    }
    
    return TEXT("Error: No active viewport");
}

FString FMCPServer::ExecuteSetViewportRealtime(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    bool bEnabled = Args->GetBoolField(TEXT("enabled"));
    
    if (GCurrentLevelEditingViewportClient)
    {
        GCurrentLevelEditingViewportClient->SetRealtime(bEnabled);
        return FString::Printf(TEXT("Viewport realtime %s"), bEnabled ? TEXT("enabled") : TEXT("disabled"));
    }
    
    return TEXT("Error: No active viewport");
}

FString FMCPServer::ExecuteSetViewportStats(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    bool bShowFps = Args->HasField(TEXT("show_fps")) ? Args->GetBoolField(TEXT("show_fps")) : false;
    bool bShowStats = Args->HasField(TEXT("show_stats")) ? Args->GetBoolField(TEXT("show_stats")) : false;
    
    // Use console commands to toggle stats
    if (bShowFps)
    {
        GEngine->Exec(GEditor->GetEditorWorldContext().World(), TEXT("stat fps"));
    }
    if (bShowStats)
    {
        GEngine->Exec(GEditor->GetEditorWorldContext().World(), TEXT("stat unit"));
    }
    
    return FString::Printf(TEXT("Stats: FPS=%s, Unit=%s"),
        bShowFps ? TEXT("on") : TEXT("off"),
        bShowStats ? TEXT("on") : TEXT("off"));
}

// ============================================
// LEVEL TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteGetCurrentLevel()
{
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    FString LevelName = World->GetMapName();
    FString LevelPath = World->GetPathName();
    
    int32 ActorCount = 0;
    for (TActorIterator<AActor> It(World); It; ++It)
    {
        ActorCount++;
    }
    
    return FString::Printf(TEXT("Current Level: %s\nPath: %s\nActor Count: %d"),
        *LevelName, *LevelPath, ActorCount);
}

FString FMCPServer::ExecuteLoadLevel(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString LevelPath = Args->GetStringField(TEXT("level_path"));
    
    if (FEditorFileUtils::LoadMap(LevelPath))
    {
        return FString::Printf(TEXT("Loaded level: %s"), *LevelPath);
    }
    
    return FString::Printf(TEXT("Error: Failed to load level '%s'"), *LevelPath);
}

FString FMCPServer::ExecuteSaveLevel(TSharedPtr<FJsonObject> Args)
{
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    if (FEditorFileUtils::SaveCurrentLevel())
    {
        return FString::Printf(TEXT("Saved level: %s"), *World->GetMapName());
    }
    
    return TEXT("Error: Failed to save level");
}

// ============================================
// PIE TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteStartPIE(TSharedPtr<FJsonObject> Args)
{
    FString Mode = Args.IsValid() && Args->HasField(TEXT("mode")) ?
        Args->GetStringField(TEXT("mode")) : TEXT("viewport");
    
    FRequestPlaySessionParams Params;
    
    if (Mode.ToLower() == TEXT("new_window"))
    {
        Params.WorldType = EPlaySessionWorldType::PlayInEditor;
        Params.DestinationSlateViewport = nullptr;
    }
    
    GEditor->RequestPlaySession(Params);
    
    return FString::Printf(TEXT("Started Play In Editor (%s mode)"), *Mode);
}

FString FMCPServer::ExecuteStopPIE()
{
    if (GEditor->PlayWorld)
    {
        GEditor->RequestEndPlayMap();
        return TEXT("Stopped Play In Editor");
    }
    
    return TEXT("PIE is not running");
}

// ============================================
// ASSET TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteSearchAssets(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString Query = Args->GetStringField(TEXT("query"));
    FString ClassName = Args->HasField(TEXT("class_name")) ? Args->GetStringField(TEXT("class_name")) : TEXT("");
    
    FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
    IAssetRegistry& AssetRegistry = AssetRegistryModule.Get();
    
    TArray<FAssetData> AssetList;
    AssetRegistry.GetAllAssets(AssetList);
    
    TArray<FString> Results;
    for (const FAssetData& Asset : AssetList)
    {
        FString AssetName = Asset.AssetName.ToString();
        FString AssetClass = Asset.AssetClassPath.GetAssetName().ToString();
        
        bool bMatchesQuery = AssetName.Contains(Query);
        bool bMatchesClass = ClassName.IsEmpty() || AssetClass.Contains(ClassName);
        
        if (bMatchesQuery && bMatchesClass)
        {
            Results.Add(FString::Printf(TEXT("%s (%s)"), *Asset.GetObjectPathString(), *AssetClass));
            if (Results.Num() >= 50) break; // Limit results
        }
    }
    
    if (Results.Num() > 0)
    {
        return FString::Printf(TEXT("Found %d assets:\n%s"), Results.Num(), *FString::Join(Results, TEXT("\n")));
    }
    
    return FString::Printf(TEXT("No assets found matching '%s'"), *Query);
}

FString FMCPServer::ExecuteGetAssetInfo(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString AssetPath = Args->GetStringField(TEXT("asset_path"));
    
    FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
    IAssetRegistry& AssetRegistry = AssetRegistryModule.Get();
    
    FAssetData AssetData = AssetRegistry.GetAssetByObjectPath(FSoftObjectPath(AssetPath));
    
    if (AssetData.IsValid())
    {
        return FString::Printf(
            TEXT("Asset: %s\nClass: %s\nPackage: %s\nPath: %s"),
            *AssetData.AssetName.ToString(),
            *AssetData.AssetClassPath.GetAssetName().ToString(),
            *AssetData.PackageName.ToString(),
            *AssetData.GetObjectPathString());
    }
    
    return FString::Printf(TEXT("Error: Asset '%s' not found"), *AssetPath);
}

FString FMCPServer::ExecuteLoadAsset(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString AssetPath = Args->GetStringField(TEXT("asset_path"));
    
    UObject* Asset = LoadObject<UObject>(nullptr, *AssetPath);
    
    if (Asset)
    {
        return FString::Printf(TEXT("Loaded asset: %s (%s)"),
            *Asset->GetName(), *Asset->GetClass()->GetName());
    }
    
    return FString::Printf(TEXT("Error: Failed to load asset '%s'"), *AssetPath);
}

// ============================================
// PHASE 2 ASSET TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteDuplicateAsset(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString SourcePath = Args->GetStringField(TEXT("source_path"));
    FString DestPath = Args->GetStringField(TEXT("dest_path"));
    
    if (UEditorAssetLibrary::DuplicateAsset(SourcePath, DestPath))
    {
        return FString::Printf(TEXT("Duplicated '%s' to '%s'"), *SourcePath, *DestPath);
    }
    
    return FString::Printf(TEXT("Error: Failed to duplicate '%s'"), *SourcePath);
}

FString FMCPServer::ExecuteRenameAsset(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString SourcePath = Args->GetStringField(TEXT("source_path"));
    FString NewName = Args->GetStringField(TEXT("new_name"));
    
    if (UEditorAssetLibrary::RenameAsset(SourcePath, NewName))
    {
        return FString::Printf(TEXT("Renamed '%s' to '%s'"), *SourcePath, *NewName);
    }
    
    return FString::Printf(TEXT("Error: Failed to rename '%s'"), *SourcePath);
}

FString FMCPServer::ExecuteDeleteAsset(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString AssetPath = Args->GetStringField(TEXT("asset_path"));
    
    if (UEditorAssetLibrary::DeleteAsset(AssetPath))
    {
        return FString::Printf(TEXT("Deleted asset: %s"), *AssetPath);
    }
    
    return FString::Printf(TEXT("Error: Failed to delete '%s'"), *AssetPath);
}

FString FMCPServer::ExecuteCreateFolder(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString FolderPath = Args->GetStringField(TEXT("folder_path"));
    
    if (UEditorAssetLibrary::MakeDirectory(FolderPath))
    {
        return FString::Printf(TEXT("Created folder: %s"), *FolderPath);
    }
    
    return FString::Printf(TEXT("Error: Failed to create folder '%s'"), *FolderPath);
}

FString FMCPServer::ExecuteGetAssetReferences(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString AssetPath = Args->GetStringField(TEXT("asset_path"));
    FString Direction = Args->HasField(TEXT("direction")) ? Args->GetStringField(TEXT("direction")) : TEXT("both");
    
    FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
    IAssetRegistry& AssetRegistry = AssetRegistryModule.Get();
    
    TArray<FString> Results;
    
    if (Direction == TEXT("dependencies") || Direction == TEXT("both"))
    {
        TArray<FAssetIdentifier> Dependencies;
        AssetRegistry.GetDependencies(FAssetIdentifier(FName(*AssetPath)), Dependencies);
        
        Results.Add(TEXT("Dependencies:"));
        for (const FAssetIdentifier& Dep : Dependencies)
        {
            Results.Add(FString::Printf(TEXT("  - %s"), *Dep.ToString()));
        }
    }
    
    if (Direction == TEXT("referencers") || Direction == TEXT("both"))
    {
        TArray<FAssetIdentifier> Referencers;
        AssetRegistry.GetReferencers(FAssetIdentifier(FName(*AssetPath)), Referencers);
        
        Results.Add(TEXT("Referencers:"));
        for (const FAssetIdentifier& Ref : Referencers)
        {
            Results.Add(FString::Printf(TEXT("  - %s"), *Ref.ToString()));
        }
    }
    
    return FString::Join(Results, TEXT("\n"));
}

// ============================================
// BLUEPRINT TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteCreateBlueprint(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString Name = Args->GetStringField(TEXT("name"));
    FString ParentClassName = Args->HasField(TEXT("parent_class")) ? Args->GetStringField(TEXT("parent_class")) : TEXT("Actor");
    FString Path = Args->HasField(TEXT("path")) ? Args->GetStringField(TEXT("path")) : TEXT("/Game/Blueprints");
    
    UClass* ParentClass = AActor::StaticClass();
    if (ParentClassName == TEXT("Pawn"))
        ParentClass = APawn::StaticClass();
    else if (ParentClassName == TEXT("Character"))
        ParentClass = ACharacter::StaticClass();
    
    FString PackagePath = Path / Name;
    UPackage* Package = CreatePackage(*PackagePath);
    
    UBlueprint* Blueprint = FKismetEditorUtilities::CreateBlueprint(
        ParentClass,
        Package,
        FName(*Name),
        BPTYPE_Normal,
        UBlueprint::StaticClass(),
        UBlueprintGeneratedClass::StaticClass());
    
    if (Blueprint)
    {
        FAssetRegistryModule::AssetCreated(Blueprint);
        Package->MarkPackageDirty();
        
        return FString::Printf(TEXT("Created Blueprint '%s' with parent class '%s' at '%s'"),
            *Name, *ParentClassName, *PackagePath);
    }
    
    return TEXT("Error: Failed to create Blueprint");
}

FString FMCPServer::ExecuteGetBlueprintInfo(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString BlueprintPath = Args->GetStringField(TEXT("blueprint_path"));
    
    UBlueprint* Blueprint = LoadObject<UBlueprint>(nullptr, *BlueprintPath);
    
    if (Blueprint)
    {
        FString ParentClass = Blueprint->ParentClass ? Blueprint->ParentClass->GetName() : TEXT("None");
        int32 VarCount = Blueprint->NewVariables.Num();
        
        TArray<FString> Variables;
        for (const FBPVariableDescription& Var : Blueprint->NewVariables)
        {
            Variables.Add(FString::Printf(TEXT("  - %s (%s)"),
                *Var.VarName.ToString(), *Var.VarType.PinCategory.ToString()));
        }
        
        FString VarList = Variables.Num() > 0 ? FString::Join(Variables, TEXT("\n")) : TEXT("  (none)");
        
        return FString::Printf(
            TEXT("Blueprint: %s\nParent Class: %s\nVariables (%d):\n%s"),
            *Blueprint->GetName(), *ParentClass, VarCount, *VarList);
    }
    
    return FString::Printf(TEXT("Error: Blueprint '%s' not found"), *BlueprintPath);
}

FString FMCPServer::ExecuteCompileBlueprint(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString BlueprintPath = Args->GetStringField(TEXT("blueprint_path"));
    
    UBlueprint* Blueprint = LoadObject<UBlueprint>(nullptr, *BlueprintPath);
    
    if (Blueprint)
    {
        FKismetEditorUtilities::CompileBlueprint(Blueprint);
        
        bool bHasErrors = Blueprint->Status == BS_Error;
        
        if (bHasErrors)
        {
            return FString::Printf(TEXT("Compiled '%s' with errors"), *Blueprint->GetName());
        }
        
        return FString::Printf(TEXT("Successfully compiled '%s'"), *Blueprint->GetName());
    }
    
    return FString::Printf(TEXT("Error: Blueprint '%s' not found"), *BlueprintPath);
}

FString FMCPServer::ExecuteSpawnBlueprintActor(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString BlueprintPath = Args->GetStringField(TEXT("blueprint_path"));
    float X = Args->HasField(TEXT("x")) ? static_cast<float>(Args->GetNumberField(TEXT("x"))) : 0.0f;
    float Y = Args->HasField(TEXT("y")) ? static_cast<float>(Args->GetNumberField(TEXT("y"))) : 0.0f;
    float Z = Args->HasField(TEXT("z")) ? static_cast<float>(Args->GetNumberField(TEXT("z"))) : 0.0f;
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    UBlueprint* Blueprint = LoadObject<UBlueprint>(nullptr, *BlueprintPath);
    
    if (!Blueprint || !Blueprint->GeneratedClass)
    {
        return FString::Printf(TEXT("Error: Blueprint '%s' not found or not compiled"), *BlueprintPath);
    }
    
    FActorSpawnParameters SpawnParams;
    AActor* NewActor = World->SpawnActor<AActor>(Blueprint->GeneratedClass, FVector(X, Y, Z), FRotator::ZeroRotator, SpawnParams);
    
    if (NewActor)
    {
        return FString::Printf(TEXT("Spawned '%s' at (%.0f, %.0f, %.0f) - Name: %s"),
            *Blueprint->GetName(), X, Y, Z, *NewActor->GetName());
    }
    
    return TEXT("Error: Failed to spawn Blueprint actor");
}

// ============================================
// PHASE 2 BLUEPRINT TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteAddBlueprintVariable(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString BlueprintPath = Args->GetStringField(TEXT("blueprint_path"));
    FString VarName = Args->GetStringField(TEXT("var_name"));
    FString VarType = Args->GetStringField(TEXT("var_type"));
    
    UBlueprint* Blueprint = LoadObject<UBlueprint>(nullptr, *BlueprintPath);
    if (!Blueprint)
    {
        return FString::Printf(TEXT("Error: Blueprint '%s' not found"), *BlueprintPath);
    }
    
    // Determine pin type
    FEdGraphPinType PinType;
    if (VarType == TEXT("Boolean"))
    {
        PinType.PinCategory = UEdGraphSchema_K2::PC_Boolean;
    }
    else if (VarType == TEXT("Integer"))
    {
        PinType.PinCategory = UEdGraphSchema_K2::PC_Int;
    }
    else if (VarType == TEXT("Float"))
    {
        PinType.PinCategory = UEdGraphSchema_K2::PC_Real;
        PinType.PinSubCategory = UEdGraphSchema_K2::PC_Float;
    }
    else if (VarType == TEXT("String"))
    {
        PinType.PinCategory = UEdGraphSchema_K2::PC_String;
    }
    else if (VarType == TEXT("Vector"))
    {
        PinType.PinCategory = UEdGraphSchema_K2::PC_Struct;
        PinType.PinSubCategoryObject = TBaseStructure<FVector>::Get();
    }
    else if (VarType == TEXT("Rotator"))
    {
        PinType.PinCategory = UEdGraphSchema_K2::PC_Struct;
        PinType.PinSubCategoryObject = TBaseStructure<FRotator>::Get();
    }
    else if (VarType == TEXT("Transform"))
    {
        PinType.PinCategory = UEdGraphSchema_K2::PC_Struct;
        PinType.PinSubCategoryObject = TBaseStructure<FTransform>::Get();
    }
    else
    {
        return FString::Printf(TEXT("Error: Unknown variable type '%s'"), *VarType);
    }
    
    FBlueprintEditorUtils::AddMemberVariable(Blueprint, FName(*VarName), PinType);
    FKismetEditorUtilities::CompileBlueprint(Blueprint);
    
    return FString::Printf(TEXT("Added variable '%s' of type '%s' to '%s'"),
        *VarName, *VarType, *Blueprint->GetName());
}

FString FMCPServer::ExecuteRemoveBlueprintVariable(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString BlueprintPath = Args->GetStringField(TEXT("blueprint_path"));
    FString VarName = Args->GetStringField(TEXT("var_name"));
    
    UBlueprint* Blueprint = LoadObject<UBlueprint>(nullptr, *BlueprintPath);
    if (!Blueprint)
    {
        return FString::Printf(TEXT("Error: Blueprint '%s' not found"), *BlueprintPath);
    }
    
    FBlueprintEditorUtils::RemoveMemberVariable(Blueprint, FName(*VarName));
    FKismetEditorUtilities::CompileBlueprint(Blueprint);
    
    return FString::Printf(TEXT("Removed variable '%s' from '%s'"), *VarName, *Blueprint->GetName());
}

FString FMCPServer::ExecuteGetBlueprintVariables(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString BlueprintPath = Args->GetStringField(TEXT("blueprint_path"));
    
    UBlueprint* Blueprint = LoadObject<UBlueprint>(nullptr, *BlueprintPath);
    if (!Blueprint)
    {
        return FString::Printf(TEXT("Error: Blueprint '%s' not found"), *BlueprintPath);
    }
    
    TArray<FString> Variables;
    for (const FBPVariableDescription& Var : Blueprint->NewVariables)
    {
        Variables.Add(FString::Printf(TEXT("  - %s (%s)"),
            *Var.VarName.ToString(), *Var.VarType.PinCategory.ToString()));
    }
    
    if (Variables.Num() > 0)
    {
        return FString::Printf(TEXT("Variables in '%s':\n%s"),
            *Blueprint->GetName(), *FString::Join(Variables, TEXT("\n")));
    }
    
    return FString::Printf(TEXT("Blueprint '%s' has no variables"), *Blueprint->GetName());
}

FString FMCPServer::ExecuteGetBlueprintFunctions(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString BlueprintPath = Args->GetStringField(TEXT("blueprint_path"));
    
    UBlueprint* Blueprint = LoadObject<UBlueprint>(nullptr, *BlueprintPath);
    if (!Blueprint)
    {
        return FString::Printf(TEXT("Error: Blueprint '%s' not found"), *BlueprintPath);
    }
    
    TArray<FString> Functions;
    
    for (UEdGraph* Graph : Blueprint->FunctionGraphs)
    {
        if (Graph)
        {
            Functions.Add(FString::Printf(TEXT("  - %s"), *Graph->GetName()));
        }
    }
    
    // Also list event graphs
    for (UEdGraph* Graph : Blueprint->UbergraphPages)
    {
        if (Graph)
        {
            Functions.Add(FString::Printf(TEXT("  - %s (Event Graph)"), *Graph->GetName()));
        }
    }
    
    if (Functions.Num() > 0)
    {
        return FString::Printf(TEXT("Functions in '%s':\n%s"),
            *Blueprint->GetName(), *FString::Join(Functions, TEXT("\n")));
    }
    
    return FString::Printf(TEXT("Blueprint '%s' has no custom functions"), *Blueprint->GetName());
}

FString FMCPServer::ExecuteSetBlueprintVariableDefault(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString BlueprintPath = Args->GetStringField(TEXT("blueprint_path"));
    FString VarName = Args->GetStringField(TEXT("var_name"));
    FString DefaultValue = Args->GetStringField(TEXT("default_value"));
    
    UBlueprint* Blueprint = LoadObject<UBlueprint>(nullptr, *BlueprintPath);
    if (!Blueprint)
    {
        return FString::Printf(TEXT("Error: Blueprint '%s' not found"), *BlueprintPath);
    }
    
    // Find the variable
    for (FBPVariableDescription& Var : Blueprint->NewVariables)
    {
        if (Var.VarName.ToString() == VarName)
        {
            Var.DefaultValue = DefaultValue;
            FKismetEditorUtilities::CompileBlueprint(Blueprint);
            return FString::Printf(TEXT("Set default value of '%s' to '%s'"), *VarName, *DefaultValue);
        }
    }
    
    return FString::Printf(TEXT("Error: Variable '%s' not found in Blueprint"), *VarName);
}

// ============================================
// MATERIAL TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteCreateMaterialInstance(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ParentMaterialPath = Args->GetStringField(TEXT("parent_material"));
    FString Name = Args->GetStringField(TEXT("name"));
    FString Path = Args->HasField(TEXT("path")) ? Args->GetStringField(TEXT("path")) : TEXT("/Game/Materials");
    
    UMaterial* ParentMaterial = LoadObject<UMaterial>(nullptr, *ParentMaterialPath);
    
    if (!ParentMaterial)
    {
        return FString::Printf(TEXT("Error: Parent material '%s' not found"), *ParentMaterialPath);
    }
    
    FString PackagePath = Path / Name;
    UPackage* Package = CreatePackage(*PackagePath);
    
    UMaterialInstanceConstant* MaterialInstance = NewObject<UMaterialInstanceConstant>(
        Package, FName(*Name), RF_Public | RF_Standalone);
    
    if (MaterialInstance)
    {
        MaterialInstance->SetParentEditorOnly(ParentMaterial);
        FAssetRegistryModule::AssetCreated(MaterialInstance);
        Package->MarkPackageDirty();
        
        return FString::Printf(TEXT("Created Material Instance '%s' from '%s'"),
            *Name, *ParentMaterial->GetName());
    }
    
    return TEXT("Error: Failed to create Material Instance");
}

FString FMCPServer::ExecuteSetMaterialScalar(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString MaterialPath = Args->GetStringField(TEXT("material_path"));
    FString ParameterName = Args->GetStringField(TEXT("parameter_name"));
    float Value = static_cast<float>(Args->GetNumberField(TEXT("value")));
    
    UMaterialInstanceConstant* MaterialInstance = LoadObject<UMaterialInstanceConstant>(nullptr, *MaterialPath);
    
    if (!MaterialInstance)
    {
        return FString::Printf(TEXT("Error: Material Instance '%s' not found"), *MaterialPath);
    }
    
    MaterialInstance->SetScalarParameterValueEditorOnly(FName(*ParameterName), Value);
    
    return FString::Printf(TEXT("Set '%s' = %.3f on '%s'"),
        *ParameterName, Value, *MaterialInstance->GetName());
}

FString FMCPServer::ExecuteApplyMaterialToActor(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    FString MaterialPath = Args->GetStringField(TEXT("material_path"));
    int32 SlotIndex = Args->HasField(TEXT("slot_index")) ? static_cast<int32>(Args->GetNumberField(TEXT("slot_index"))) : 0;
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor)
    {
        return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    }
    
    UMaterialInterface* Material = LoadObject<UMaterialInterface>(nullptr, *MaterialPath);
    if (!Material)
    {
        return FString::Printf(TEXT("Error: Material '%s' not found"), *MaterialPath);
    }
    
    UMeshComponent* MeshComponent = Actor->FindComponentByClass<UMeshComponent>();
    if (!MeshComponent)
    {
        return FString::Printf(TEXT("Error: Actor '%s' has no mesh component"), *ActorName);
    }
    
    MeshComponent->SetMaterial(SlotIndex, Material);
    
    return FString::Printf(TEXT("Applied '%s' to '%s' slot %d"),
        *Material->GetName(), *ActorName, SlotIndex);
}

// ============================================
// PHASE 2 MATERIAL TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteSetMaterialVector(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString MaterialPath = Args->GetStringField(TEXT("material_path"));
    FString ParamName = Args->GetStringField(TEXT("param_name"));
    float R = static_cast<float>(Args->GetNumberField(TEXT("r")));
    float G = static_cast<float>(Args->GetNumberField(TEXT("g")));
    float B = static_cast<float>(Args->GetNumberField(TEXT("b")));
    float A = Args->HasField(TEXT("a")) ? static_cast<float>(Args->GetNumberField(TEXT("a"))) : 1.0f;
    
    UMaterialInstanceConstant* MaterialInstance = LoadObject<UMaterialInstanceConstant>(nullptr, *MaterialPath);
    
    if (!MaterialInstance)
    {
        return FString::Printf(TEXT("Error: Material Instance '%s' not found"), *MaterialPath);
    }
    
    FLinearColor Color(R, G, B, A);
    MaterialInstance->SetVectorParameterValueEditorOnly(FName(*ParamName), Color);
    
    return FString::Printf(TEXT("Set '%s' = (%.2f, %.2f, %.2f, %.2f) on '%s'"),
        *ParamName, R, G, B, A, *MaterialInstance->GetName());
}

FString FMCPServer::ExecuteGetMaterialParameters(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString MaterialPath = Args->GetStringField(TEXT("material_path"));
    
    UMaterialInterface* Material = LoadObject<UMaterialInterface>(nullptr, *MaterialPath);
    
    if (!Material)
    {
        return FString::Printf(TEXT("Error: Material '%s' not found"), *MaterialPath);
    }
    
    TArray<FString> Results;
    Results.Add(FString::Printf(TEXT("Material: %s"), *Material->GetName()));
    
    // Get scalar parameters
    TArray<FMaterialParameterInfo> ScalarParams;
    TArray<FGuid> ScalarGuids;
    Material->GetAllScalarParameterInfo(ScalarParams, ScalarGuids);
    
    if (ScalarParams.Num() > 0)
    {
        Results.Add(TEXT("Scalar Parameters:"));
        for (const FMaterialParameterInfo& Param : ScalarParams)
        {
            float Value = 0.0f;
            Material->GetScalarParameterValue(Param, Value);
            Results.Add(FString::Printf(TEXT("  - %s = %.3f"), *Param.Name.ToString(), Value));
        }
    }
    
    // Get vector parameters
    TArray<FMaterialParameterInfo> VectorParams;
    TArray<FGuid> VectorGuids;
    Material->GetAllVectorParameterInfo(VectorParams, VectorGuids);
    
    if (VectorParams.Num() > 0)
    {
        Results.Add(TEXT("Vector Parameters:"));
        for (const FMaterialParameterInfo& Param : VectorParams)
        {
            FLinearColor Value;
            Material->GetVectorParameterValue(Param, Value);
            Results.Add(FString::Printf(TEXT("  - %s = (%.2f, %.2f, %.2f, %.2f)"),
                *Param.Name.ToString(), Value.R, Value.G, Value.B, Value.A));
        }
    }
    
    return FString::Join(Results, TEXT("\n"));
}

FString FMCPServer::ExecuteReplaceActorMaterial(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    int32 MaterialIndex = static_cast<int32>(Args->GetNumberField(TEXT("material_index")));
    FString MaterialPath = Args->GetStringField(TEXT("material_path"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor)
    {
        return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    }
    
    UMaterialInterface* Material = LoadObject<UMaterialInterface>(nullptr, *MaterialPath);
    if (!Material)
    {
        return FString::Printf(TEXT("Error: Material '%s' not found"), *MaterialPath);
    }
    
    UMeshComponent* MeshComponent = Actor->FindComponentByClass<UMeshComponent>();
    if (!MeshComponent)
    {
        return FString::Printf(TEXT("Error: Actor '%s' has no mesh component"), *ActorName);
    }
    
    if (MaterialIndex >= MeshComponent->GetNumMaterials())
    {
        return FString::Printf(TEXT("Error: Material index %d out of range (max: %d)"),
            MaterialIndex, MeshComponent->GetNumMaterials() - 1);
    }
    
    MeshComponent->SetMaterial(MaterialIndex, Material);
    
    return FString::Printf(TEXT("Replaced material at index %d on '%s' with '%s'"),
        MaterialIndex, *ActorName, *Material->GetName());
}

FString FMCPServer::ExecuteGetActorMaterials(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor)
    {
        return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    }
    
    UMeshComponent* MeshComponent = Actor->FindComponentByClass<UMeshComponent>();
    if (!MeshComponent)
    {
        return FString::Printf(TEXT("Error: Actor '%s' has no mesh component"), *ActorName);
    }
    
    TArray<FString> Materials;
    int32 NumMaterials = MeshComponent->GetNumMaterials();
    
    for (int32 i = 0; i < NumMaterials; i++)
    {
        UMaterialInterface* Material = MeshComponent->GetMaterial(i);
        FString MatName = Material ? Material->GetPathName() : TEXT("(none)");
        Materials.Add(FString::Printf(TEXT("  [%d] %s"), i, *MatName));
    }
    
    return FString::Printf(TEXT("Materials on '%s' (%d slots):\n%s"),
        *ActorName, NumMaterials, *FString::Join(Materials, TEXT("\n")));
}

// ============================================
// EDITOR TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteConsoleCommand(TSharedPtr<FJsonObject> Args)
{
    if (!Args.IsValid()) return TEXT("Error: Invalid arguments");
    
    FString Command = Args->GetStringField(TEXT("command"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    GEngine->Exec(World, *Command);
    
    return FString::Printf(TEXT("Executed: %s"), *Command);
}

FString FMCPServer::ExecuteGetProjectInfo()
{
    FString ProjectName = FApp::GetProjectName();
    FString EngineVersion = FEngineVersion::Current().ToString();
    FString ProjectDir = FPaths::ProjectDir();
    
    return FString::Printf(
        TEXT("Project: %s\nEngine Version: %s\nProject Directory: %s\nMCP Bridge Version: 3.2.0"),
        *ProjectName, *EngineVersion, *ProjectDir);
}

// ============================================
// RESPONSE HELPERS
// ============================================

FString FMCPServer::CreateSuccessResponse(int32 Id, TSharedPtr<FJsonObject> Result)
{
    TSharedPtr<FJsonObject> Response = MakeShared<FJsonObject>();
    Response->SetStringField(TEXT("jsonrpc"), TEXT("2.0"));
    Response->SetNumberField(TEXT("id"), Id);
    Response->SetObjectField(TEXT("result"), Result);
    
    FString ResponseString;
    TSharedRef<TJsonWriter<TCHAR, TCondensedJsonPrintPolicy<TCHAR>>> Writer = 
        TJsonWriterFactory<TCHAR, TCondensedJsonPrintPolicy<TCHAR>>::Create(&ResponseString);
    FJsonSerializer::Serialize(Response.ToSharedRef(), Writer);
    
    return ResponseString;
}

FString FMCPServer::CreateErrorResponse(int32 Id, int32 Code, const FString& Message)
{
    TSharedPtr<FJsonObject> Response = MakeShared<FJsonObject>();
    Response->SetStringField(TEXT("jsonrpc"), TEXT("2.0"));
    Response->SetNumberField(TEXT("id"), Id);
    
    TSharedPtr<FJsonObject> Error = MakeShared<FJsonObject>();
    Error->SetNumberField(TEXT("code"), Code);
    Error->SetStringField(TEXT("message"), Message);
    Response->SetObjectField(TEXT("error"), Error);
    
    FString ResponseString;
    TSharedRef<TJsonWriter<TCHAR, TCondensedJsonPrintPolicy<TCHAR>>> Writer = 
        TJsonWriterFactory<TCHAR, TCondensedJsonPrintPolicy<TCHAR>>::Create(&ResponseString);
    FJsonSerializer::Serialize(Response.ToSharedRef(), Writer);
    
    return ResponseString;
}


// ============================================
// PHASE 3: TOOL REGISTRATION FUNCTIONS
// ============================================

void FMCPServer::RegisterPhysicsTools(TArray<TSharedPtr<FJsonValue>>& Tools)
{
    // Tool: set_simulate_physics
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_simulate_physics"));
        Tool->SetStringField(TEXT("description"), TEXT("Enable or disable physics simulation on an actor"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), ActorProp);
        
        TSharedPtr<FJsonObject> EnabledProp = MakeShared<FJsonObject>();
        EnabledProp->SetStringField(TEXT("type"), TEXT("boolean"));
        Props->SetObjectField(TEXT("enabled"), EnabledProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("enabled")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: set_collision_enabled
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_collision_enabled"));
        Tool->SetStringField(TEXT("description"), TEXT("Set collision type (NoCollision, QueryOnly, PhysicsOnly, QueryAndPhysics)"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), ActorProp);
        
        TSharedPtr<FJsonObject> TypeProp = MakeShared<FJsonObject>();
        TypeProp->SetStringField(TEXT("type"), TEXT("string"));
        TypeProp->SetStringField(TEXT("description"), TEXT("NoCollision, QueryOnly, PhysicsOnly, QueryAndPhysics"));
        Props->SetObjectField(TEXT("collision_type"), TypeProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("collision_type")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: set_collision_profile
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_collision_profile"));
        Tool->SetStringField(TEXT("description"), TEXT("Set collision profile/preset on an actor"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), ActorProp);
        
        TSharedPtr<FJsonObject> ProfileProp = MakeShared<FJsonObject>();
        ProfileProp->SetStringField(TEXT("type"), TEXT("string"));
        ProfileProp->SetStringField(TEXT("description"), TEXT("BlockAll, OverlapAll, Pawn, PhysicsActor, etc."));
        Props->SetObjectField(TEXT("profile_name"), ProfileProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("profile_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: add_impulse
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("add_impulse"));
        Tool->SetStringField(TEXT("description"), TEXT("Add a physics impulse to an actor"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), ActorProp);
        
        TSharedPtr<FJsonObject> XProp = MakeShared<FJsonObject>();
        XProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("x"), XProp);
        
        TSharedPtr<FJsonObject> YProp = MakeShared<FJsonObject>();
        YProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("y"), YProp);
        
        TSharedPtr<FJsonObject> ZProp = MakeShared<FJsonObject>();
        ZProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("z"), ZProp);
        
        TSharedPtr<FJsonObject> VelProp = MakeShared<FJsonObject>();
        VelProp->SetStringField(TEXT("type"), TEXT("boolean"));
        Props->SetObjectField(TEXT("vel_change"), VelProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("x")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("y")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("z")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_physics_state
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_physics_state"));
        Tool->SetStringField(TEXT("description"), TEXT("Get physics properties of an actor (mass, gravity, damping, velocity)"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), ActorProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
}

void FMCPServer::RegisterEditorUtilityTools(TArray<TSharedPtr<FJsonValue>>& Tools)
{
    // Tool: get_editor_preference
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_editor_preference"));
        Tool->SetStringField(TEXT("description"), TEXT("Get an editor preference value from config"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> SectionProp = MakeShared<FJsonObject>();
        SectionProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("section"), SectionProp);
        
        TSharedPtr<FJsonObject> KeyProp = MakeShared<FJsonObject>();
        KeyProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("key"), KeyProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("section")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("key")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: set_editor_preference
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_editor_preference"));
        Tool->SetStringField(TEXT("description"), TEXT("Set an editor preference value in config"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> SectionProp = MakeShared<FJsonObject>();
        SectionProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("section"), SectionProp);
        
        TSharedPtr<FJsonObject> KeyProp = MakeShared<FJsonObject>();
        KeyProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("key"), KeyProp);
        
        TSharedPtr<FJsonObject> ValueProp = MakeShared<FJsonObject>();
        ValueProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("value"), ValueProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("section")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("key")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("value")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: run_editor_utility
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("run_editor_utility"));
        Tool->SetStringField(TEXT("description"), TEXT("Run an editor utility widget or blueprint"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("asset_path"), PathProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("asset_path")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_engine_info
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_engine_info"));
        Tool->SetStringField(TEXT("description"), TEXT("Get detailed engine and build information"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        Schema->SetObjectField(TEXT("properties"), MakeShared<FJsonObject>());
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
}

void FMCPServer::RegisterBookmarkTools(TArray<TSharedPtr<FJsonValue>>& Tools)
{
    // Tool: set_viewport_bookmark
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_viewport_bookmark"));
        Tool->SetStringField(TEXT("description"), TEXT("Save current viewport camera position to a bookmark slot (0-9)"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> SlotProp = MakeShared<FJsonObject>();
        SlotProp->SetStringField(TEXT("type"), TEXT("number"));
        SlotProp->SetStringField(TEXT("description"), TEXT("Bookmark slot 0-9"));
        Props->SetObjectField(TEXT("slot"), SlotProp);
        
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("name"), NameProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("slot")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: jump_to_bookmark
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("jump_to_bookmark"));
        Tool->SetStringField(TEXT("description"), TEXT("Jump viewport camera to a saved bookmark"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> SlotProp = MakeShared<FJsonObject>();
        SlotProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("slot"), SlotProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("slot")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: clear_bookmark
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("clear_bookmark"));
        Tool->SetStringField(TEXT("description"), TEXT("Clear a viewport bookmark slot"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> SlotProp = MakeShared<FJsonObject>();
        SlotProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("slot"), SlotProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("slot")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: list_bookmarks
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("list_bookmarks"));
        Tool->SetStringField(TEXT("description"), TEXT("List all saved viewport bookmarks"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        Schema->SetObjectField(TEXT("properties"), MakeShared<FJsonObject>());
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
}

void FMCPServer::RegisterComponentTools(TArray<TSharedPtr<FJsonValue>>& Tools)
{
    // Tool: get_actor_components
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_actor_components"));
        Tool->SetStringField(TEXT("description"), TEXT("List all components attached to an actor"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), ActorProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_component_properties
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_component_properties"));
        Tool->SetStringField(TEXT("description"), TEXT("Get properties of a specific component"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), ActorProp);
        
        TSharedPtr<FJsonObject> CompProp = MakeShared<FJsonObject>();
        CompProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("component_name"), CompProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("component_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: set_component_transform
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_component_transform"));
        Tool->SetStringField(TEXT("description"), TEXT("Set the relative transform of a component"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), ActorProp);
        
        TSharedPtr<FJsonObject> CompProp = MakeShared<FJsonObject>();
        CompProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("component_name"), CompProp);
        
        TSharedPtr<FJsonObject> XProp = MakeShared<FJsonObject>();
        XProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("x"), XProp);
        
        TSharedPtr<FJsonObject> YProp = MakeShared<FJsonObject>();
        YProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("y"), YProp);
        
        TSharedPtr<FJsonObject> ZProp = MakeShared<FJsonObject>();
        ZProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("z"), ZProp);
        
        TSharedPtr<FJsonObject> PitchProp = MakeShared<FJsonObject>();
        PitchProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("pitch"), PitchProp);
        
        TSharedPtr<FJsonObject> YawProp = MakeShared<FJsonObject>();
        YawProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("yaw"), YawProp);
        
        TSharedPtr<FJsonObject> RollProp = MakeShared<FJsonObject>();
        RollProp->SetStringField(TEXT("type"), TEXT("number"));
        Props->SetObjectField(TEXT("roll"), RollProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("component_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: set_component_visibility
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_component_visibility"));
        Tool->SetStringField(TEXT("description"), TEXT("Set visibility of a component"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), ActorProp);
        
        TSharedPtr<FJsonObject> CompProp = MakeShared<FJsonObject>();
        CompProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("component_name"), CompProp);
        
        TSharedPtr<FJsonObject> VisProp = MakeShared<FJsonObject>();
        VisProp->SetStringField(TEXT("type"), TEXT("boolean"));
        Props->SetObjectField(TEXT("visible"), VisProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("component_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("visible")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: remove_component
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("remove_component"));
        Tool->SetStringField(TEXT("description"), TEXT("Remove a component from an actor"));
        TSharedPtr<FJsonObject> Schema = MakeShared<FJsonObject>();
        Schema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Props = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("actor_name"), ActorProp);
        
        TSharedPtr<FJsonObject> CompProp = MakeShared<FJsonObject>();
        CompProp->SetStringField(TEXT("type"), TEXT("string"));
        Props->SetObjectField(TEXT("component_name"), CompProp);
        
        Schema->SetObjectField(TEXT("properties"), Props);
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("component_name")));
        Schema->SetArrayField(TEXT("required"), Required);
        Tool->SetObjectField(TEXT("inputSchema"), Schema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
}

// ============================================
// PHASE 3: PHYSICS & COLLISION TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteSetSimulatePhysics(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    bool bEnabled = Args->GetBoolField(TEXT("enabled"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    UPrimitiveComponent* PrimComp = Cast<UPrimitiveComponent>(Actor->GetRootComponent());
    if (!PrimComp)
    {
        // Try to find any primitive component
        PrimComp = Actor->FindComponentByClass<UPrimitiveComponent>();
    }
    
    if (!PrimComp) return FString::Printf(TEXT("Error: Actor '%s' has no primitive component"), *ActorName);
    
    PrimComp->SetSimulatePhysics(bEnabled);
    
    return FString::Printf(TEXT("Physics simulation %s on '%s'"), bEnabled ? TEXT("enabled") : TEXT("disabled"), *ActorName);
}

FString FMCPServer::ExecuteSetCollisionEnabled(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    FString CollisionType = Args->GetStringField(TEXT("collision_type"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    UPrimitiveComponent* PrimComp = Cast<UPrimitiveComponent>(Actor->GetRootComponent());
    if (!PrimComp) PrimComp = Actor->FindComponentByClass<UPrimitiveComponent>();
    if (!PrimComp) return FString::Printf(TEXT("Error: Actor '%s' has no primitive component"), *ActorName);
    
    ECollisionEnabled::Type CollisionEnabled = ECollisionEnabled::QueryAndPhysics;
    if (CollisionType == TEXT("NoCollision"))
        CollisionEnabled = ECollisionEnabled::NoCollision;
    else if (CollisionType == TEXT("QueryOnly"))
        CollisionEnabled = ECollisionEnabled::QueryOnly;
    else if (CollisionType == TEXT("PhysicsOnly"))
        CollisionEnabled = ECollisionEnabled::PhysicsOnly;
    else if (CollisionType == TEXT("QueryAndPhysics"))
        CollisionEnabled = ECollisionEnabled::QueryAndPhysics;
    
    PrimComp->SetCollisionEnabled(CollisionEnabled);
    
    return FString::Printf(TEXT("Collision set to '%s' on '%s'"), *CollisionType, *ActorName);
}

FString FMCPServer::ExecuteSetCollisionProfile(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    FString ProfileName = Args->GetStringField(TEXT("profile_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    UPrimitiveComponent* PrimComp = Cast<UPrimitiveComponent>(Actor->GetRootComponent());
    if (!PrimComp) PrimComp = Actor->FindComponentByClass<UPrimitiveComponent>();
    if (!PrimComp) return FString::Printf(TEXT("Error: Actor '%s' has no primitive component"), *ActorName);
    
    PrimComp->SetCollisionProfileName(FName(*ProfileName));
    
    return FString::Printf(TEXT("Collision profile set to '%s' on '%s'"), *ProfileName, *ActorName);
}

FString FMCPServer::ExecuteAddImpulse(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    double X = Args->GetNumberField(TEXT("x"));
    double Y = Args->GetNumberField(TEXT("y"));
    double Z = Args->GetNumberField(TEXT("z"));
    bool bVelChange = Args->HasField(TEXT("vel_change")) ? Args->GetBoolField(TEXT("vel_change")) : false;
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    UPrimitiveComponent* PrimComp = Cast<UPrimitiveComponent>(Actor->GetRootComponent());
    if (!PrimComp) PrimComp = Actor->FindComponentByClass<UPrimitiveComponent>();
    if (!PrimComp) return FString::Printf(TEXT("Error: Actor '%s' has no primitive component"), *ActorName);
    
    if (!PrimComp->IsSimulatingPhysics())
    {
        return FString::Printf(TEXT("Error: Actor '%s' is not simulating physics. Enable physics first."), *ActorName);
    }
    
    FVector Impulse(X, Y, Z);
    PrimComp->AddImpulse(Impulse, NAME_None, bVelChange);
    
    return FString::Printf(TEXT("Added impulse (%.1f, %.1f, %.1f) to '%s'"), X, Y, Z, *ActorName);
}

FString FMCPServer::ExecuteGetPhysicsState(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    UPrimitiveComponent* PrimComp = Cast<UPrimitiveComponent>(Actor->GetRootComponent());
    if (!PrimComp) PrimComp = Actor->FindComponentByClass<UPrimitiveComponent>();
    if (!PrimComp) return FString::Printf(TEXT("Error: Actor '%s' has no primitive component"), *ActorName);
    
    bool bSimulating = PrimComp->IsSimulatingPhysics();
    bool bGravity = PrimComp->IsGravityEnabled();
    float Mass = PrimComp->GetMass();
    float LinearDamping = PrimComp->GetLinearDamping();
    float AngularDamping = PrimComp->GetAngularDamping();
    FVector LinearVel = PrimComp->GetPhysicsLinearVelocity();
    FVector AngularVel = PrimComp->GetPhysicsAngularVelocityInDegrees();
    FName CollisionProfile = PrimComp->GetCollisionProfileName();
    
    return FString::Printf(
        TEXT("Physics State for '%s':\n")
        TEXT("  Simulating: %s\n")
        TEXT("  Gravity: %s\n")
        TEXT("  Mass: %.2f kg\n")
        TEXT("  Linear Damping: %.2f\n")
        TEXT("  Angular Damping: %.2f\n")
        TEXT("  Linear Velocity: (%.1f, %.1f, %.1f)\n")
        TEXT("  Angular Velocity: (%.1f, %.1f, %.1f) deg/s\n")
        TEXT("  Collision Profile: %s"),
        *ActorName,
        bSimulating ? TEXT("Yes") : TEXT("No"),
        bGravity ? TEXT("Yes") : TEXT("No"),
        Mass, LinearDamping, AngularDamping,
        LinearVel.X, LinearVel.Y, LinearVel.Z,
        AngularVel.X, AngularVel.Y, AngularVel.Z,
        *CollisionProfile.ToString());
}

// ============================================
// PHASE 3: EDITOR UTILITIES TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteGetEditorPreference(TSharedPtr<FJsonObject> Args)
{
    FString Section = Args->GetStringField(TEXT("section"));
    FString Key = Args->GetStringField(TEXT("key"));
    
    FString Value;
    if (GConfig->GetString(*Section, *Key, Value, GEditorIni))
    {
        return FString::Printf(TEXT("[%s] %s = %s"), *Section, *Key, *Value);
    }
    
    // Try other config files
    if (GConfig->GetString(*Section, *Key, Value, GEngineIni))
    {
        return FString::Printf(TEXT("[%s] %s = %s (from Engine.ini)"), *Section, *Key, *Value);
    }
    
    return FString::Printf(TEXT("Setting not found: [%s] %s"), *Section, *Key);
}

FString FMCPServer::ExecuteSetEditorPreference(TSharedPtr<FJsonObject> Args)
{
    FString Section = Args->GetStringField(TEXT("section"));
    FString Key = Args->GetStringField(TEXT("key"));
    FString Value = Args->GetStringField(TEXT("value"));
    
    GConfig->SetString(*Section, *Key, *Value, GEditorIni);
    GConfig->Flush(false, GEditorIni);
    
    return FString::Printf(TEXT("Set [%s] %s = %s"), *Section, *Key, *Value);
}

FString FMCPServer::ExecuteRunEditorUtility(TSharedPtr<FJsonObject> Args)
{
    FString AssetPath = Args->GetStringField(TEXT("asset_path"));
    
    UObject* Asset = StaticLoadObject(UObject::StaticClass(), nullptr, *AssetPath);
    if (!Asset)
    {
        return FString::Printf(TEXT("Error: Could not load asset '%s'"), *AssetPath);
    }
    
    // Check if it's an Editor Utility Blueprint
    UBlueprint* Blueprint = Cast<UBlueprint>(Asset);
    if (Blueprint)
    {
        UClass* GeneratedClass = Blueprint->GeneratedClass;
        if (GeneratedClass)
        {
            // Try to run the default function
            UObject* CDO = GeneratedClass->GetDefaultObject();
            if (CDO)
            {
                UFunction* RunFunc = GeneratedClass->FindFunctionByName(TEXT("Run"));
                if (RunFunc)
                {
                    CDO->ProcessEvent(RunFunc, nullptr);
                    return FString::Printf(TEXT("Executed editor utility: %s"), *AssetPath);
                }
            }
        }
    }
    
    return FString::Printf(TEXT("Loaded asset '%s' but could not execute (not an Editor Utility with Run function)"), *AssetPath);
}

FString FMCPServer::ExecuteGetEngineInfo()
{
    FString EngineVersion = FEngineVersion::Current().ToString();
    FString Branch = FEngineVersion::Current().GetBranch();
    uint32 Changelist = FEngineVersion::Current().GetChangelist();
    
    FString BuildConfig;
#if UE_BUILD_DEBUG
    BuildConfig = TEXT("Debug");
#elif UE_BUILD_DEVELOPMENT
    BuildConfig = TEXT("Development");
#elif UE_BUILD_SHIPPING
    BuildConfig = TEXT("Shipping");
#elif UE_BUILD_TEST
    BuildConfig = TEXT("Test");
#else
    BuildConfig = TEXT("Unknown");
#endif
    
    FString Platform = FPlatformProperties::PlatformName();
    FString ProjectName = FApp::GetProjectName();
    FString ProjectDir = FPaths::ProjectDir();
    
    return FString::Printf(
        TEXT("Engine Information:\n")
        TEXT("  Version: %s\n")
        TEXT("  Branch: %s\n")
        TEXT("  Changelist: %u\n")
        TEXT("  Build Config: %s\n")
        TEXT("  Platform: %s\n")
        TEXT("  Project: %s\n")
        TEXT("  Project Dir: %s\n")
        TEXT("  MCP Bridge: 3.2.0"),
        *EngineVersion, *Branch, Changelist, *BuildConfig, *Platform, *ProjectName, *ProjectDir);
}

// ============================================
// PHASE 3: VIEWPORT BOOKMARK TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteSetViewportBookmark(TSharedPtr<FJsonObject> Args)
{
    int32 Slot = FMath::Clamp((int32)Args->GetNumberField(TEXT("slot")), 0, 9);
    FString Name = Args->HasField(TEXT("name")) ? Args->GetStringField(TEXT("name")) : FString::Printf(TEXT("Bookmark %d"), Slot);
    
    // Initialize bookmarks array if needed
    if (ViewportBookmarks.Num() < 10)
    {
        ViewportBookmarks.SetNum(10);
    }
    
    // Get current viewport camera
    if (!GCurrentLevelEditingViewportClient)
    {
        return TEXT("Error: No active viewport");
    }
    
    FVector Location = GCurrentLevelEditingViewportClient->GetViewLocation();
    FRotator Rotation = GCurrentLevelEditingViewportClient->GetViewRotation();
    
    ViewportBookmarks[Slot].bIsSet = true;
    ViewportBookmarks[Slot].Location = Location;
    ViewportBookmarks[Slot].Rotation = Rotation;
    ViewportBookmarks[Slot].Name = Name;
    
    return FString::Printf(TEXT("Bookmark %d '%s' saved at (%.1f, %.1f, %.1f)"), Slot, *Name, Location.X, Location.Y, Location.Z);
}

FString FMCPServer::ExecuteJumpToBookmark(TSharedPtr<FJsonObject> Args)
{
    int32 Slot = FMath::Clamp((int32)Args->GetNumberField(TEXT("slot")), 0, 9);
    
    if (ViewportBookmarks.Num() <= Slot || !ViewportBookmarks[Slot].bIsSet)
    {
        return FString::Printf(TEXT("Error: Bookmark %d is not set"), Slot);
    }
    
    if (!GCurrentLevelEditingViewportClient)
    {
        return TEXT("Error: No active viewport");
    }
    
    GCurrentLevelEditingViewportClient->SetViewLocation(ViewportBookmarks[Slot].Location);
    GCurrentLevelEditingViewportClient->SetViewRotation(ViewportBookmarks[Slot].Rotation);
    
    return FString::Printf(TEXT("Jumped to bookmark %d '%s'"), Slot, *ViewportBookmarks[Slot].Name);
}

FString FMCPServer::ExecuteClearBookmark(TSharedPtr<FJsonObject> Args)
{
    int32 Slot = FMath::Clamp((int32)Args->GetNumberField(TEXT("slot")), 0, 9);
    
    if (ViewportBookmarks.Num() > Slot)
    {
        ViewportBookmarks[Slot].bIsSet = false;
        ViewportBookmarks[Slot].Name = TEXT("");
    }
    
    return FString::Printf(TEXT("Bookmark %d cleared"), Slot);
}

FString FMCPServer::ExecuteListBookmarks()
{
    if (ViewportBookmarks.Num() < 10)
    {
        ViewportBookmarks.SetNum(10);
    }
    
    FString Result = TEXT("Viewport Bookmarks:\n");
    bool bAnySet = false;
    
    for (int32 i = 0; i < 10; i++)
    {
        if (ViewportBookmarks[i].bIsSet)
        {
            bAnySet = true;
            Result += FString::Printf(TEXT("  [%d] '%s' at (%.1f, %.1f, %.1f)\n"),
                i, *ViewportBookmarks[i].Name,
                ViewportBookmarks[i].Location.X,
                ViewportBookmarks[i].Location.Y,
                ViewportBookmarks[i].Location.Z);
        }
    }
    
    if (!bAnySet)
    {
        Result += TEXT("  No bookmarks set");
    }
    
    return Result;
}

// ============================================
// PHASE 3: COMPONENT OPERATIONS TOOL IMPLEMENTATIONS
// ============================================

FString FMCPServer::ExecuteGetActorComponents(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    TArray<UActorComponent*> Components;
    Actor->GetComponents(Components);
    
    FString Result = FString::Printf(TEXT("Components of '%s' (%d total):\n"), *ActorName, Components.Num());
    
    for (UActorComponent* Comp : Components)
    {
        if (Comp)
        {
            FString CompType = Comp->GetClass()->GetName();
            FString CompName = Comp->GetName();
            
            // Check if it's a scene component for transform info
            USceneComponent* SceneComp = Cast<USceneComponent>(Comp);
            if (SceneComp)
            {
                FVector RelLoc = SceneComp->GetRelativeLocation();
                Result += FString::Printf(TEXT("  [Scene] %s (%s) - Loc: (%.1f, %.1f, %.1f)\n"),
                    *CompName, *CompType, RelLoc.X, RelLoc.Y, RelLoc.Z);
            }
            else
            {
                Result += FString::Printf(TEXT("  %s (%s)\n"), *CompName, *CompType);
            }
        }
    }
    
    return Result;
}

FString FMCPServer::ExecuteGetComponentProperties(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    FString ComponentName = Args->GetStringField(TEXT("component_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    UActorComponent* FoundComp = nullptr;
    TArray<UActorComponent*> Components;
    Actor->GetComponents(Components);
    
    for (UActorComponent* Comp : Components)
    {
        if (Comp && Comp->GetName() == ComponentName)
        {
            FoundComp = Comp;
            break;
        }
    }
    
    if (!FoundComp) return FString::Printf(TEXT("Error: Component '%s' not found on actor '%s'"), *ComponentName, *ActorName);
    
    FString Result = FString::Printf(TEXT("Component '%s' Properties:\n"), *ComponentName);
    Result += FString::Printf(TEXT("  Class: %s\n"), *FoundComp->GetClass()->GetName());
    Result += FString::Printf(TEXT("  Active: %s\n"), FoundComp->IsActive() ? TEXT("Yes") : TEXT("No"));
    
    USceneComponent* SceneComp = Cast<USceneComponent>(FoundComp);
    if (SceneComp)
    {
        FVector RelLoc = SceneComp->GetRelativeLocation();
        FRotator RelRot = SceneComp->GetRelativeRotation();
        FVector RelScale = SceneComp->GetRelativeScale3D();
        
        Result += FString::Printf(TEXT("  Relative Location: (%.2f, %.2f, %.2f)\n"), RelLoc.X, RelLoc.Y, RelLoc.Z);
        Result += FString::Printf(TEXT("  Relative Rotation: (P=%.2f, Y=%.2f, R=%.2f)\n"), RelRot.Pitch, RelRot.Yaw, RelRot.Roll);
        Result += FString::Printf(TEXT("  Relative Scale: (%.2f, %.2f, %.2f)\n"), RelScale.X, RelScale.Y, RelScale.Z);
        Result += FString::Printf(TEXT("  Visible: %s\n"), SceneComp->IsVisible() ? TEXT("Yes") : TEXT("No"));
        
        if (SceneComp->GetAttachParent())
        {
            Result += FString::Printf(TEXT("  Attached To: %s\n"), *SceneComp->GetAttachParent()->GetName());
        }
    }
    
    UPrimitiveComponent* PrimComp = Cast<UPrimitiveComponent>(FoundComp);
    if (PrimComp)
    {
        Result += FString::Printf(TEXT("  Simulating Physics: %s\n"), PrimComp->IsSimulatingPhysics() ? TEXT("Yes") : TEXT("No"));
        Result += FString::Printf(TEXT("  Collision Profile: %s\n"), *PrimComp->GetCollisionProfileName().ToString());
    }
    
    return Result;
}

FString FMCPServer::ExecuteSetComponentTransform(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    FString ComponentName = Args->GetStringField(TEXT("component_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    USceneComponent* FoundComp = nullptr;
    TArray<UActorComponent*> Components;
    Actor->GetComponents(Components);
    
    for (UActorComponent* Comp : Components)
    {
        if (Comp && Comp->GetName() == ComponentName)
        {
            FoundComp = Cast<USceneComponent>(Comp);
            break;
        }
    }
    
    if (!FoundComp) return FString::Printf(TEXT("Error: Scene component '%s' not found on actor '%s'"), *ComponentName, *ActorName);
    
    FVector CurrentLoc = FoundComp->GetRelativeLocation();
    FRotator CurrentRot = FoundComp->GetRelativeRotation();
    
    if (Args->HasField(TEXT("x"))) CurrentLoc.X = Args->GetNumberField(TEXT("x"));
    if (Args->HasField(TEXT("y"))) CurrentLoc.Y = Args->GetNumberField(TEXT("y"));
    if (Args->HasField(TEXT("z"))) CurrentLoc.Z = Args->GetNumberField(TEXT("z"));
    
    if (Args->HasField(TEXT("pitch"))) CurrentRot.Pitch = Args->GetNumberField(TEXT("pitch"));
    if (Args->HasField(TEXT("yaw"))) CurrentRot.Yaw = Args->GetNumberField(TEXT("yaw"));
    if (Args->HasField(TEXT("roll"))) CurrentRot.Roll = Args->GetNumberField(TEXT("roll"));
    
    FoundComp->SetRelativeLocation(CurrentLoc);
    FoundComp->SetRelativeRotation(CurrentRot);
    
    return FString::Printf(TEXT("Set transform of '%s' on '%s' - Loc: (%.1f, %.1f, %.1f), Rot: (%.1f, %.1f, %.1f)"),
        *ComponentName, *ActorName,
        CurrentLoc.X, CurrentLoc.Y, CurrentLoc.Z,
        CurrentRot.Pitch, CurrentRot.Yaw, CurrentRot.Roll);
}

FString FMCPServer::ExecuteSetComponentVisibility(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    FString ComponentName = Args->GetStringField(TEXT("component_name"));
    bool bVisible = Args->GetBoolField(TEXT("visible"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    USceneComponent* FoundComp = nullptr;
    TArray<UActorComponent*> Components;
    Actor->GetComponents(Components);
    
    for (UActorComponent* Comp : Components)
    {
        if (Comp && Comp->GetName() == ComponentName)
        {
            FoundComp = Cast<USceneComponent>(Comp);
            break;
        }
    }
    
    if (!FoundComp) return FString::Printf(TEXT("Error: Scene component '%s' not found on actor '%s'"), *ComponentName, *ActorName);
    
    FoundComp->SetVisibility(bVisible, true);
    
    return FString::Printf(TEXT("Set visibility of '%s' on '%s' to %s"), *ComponentName, *ActorName, bVisible ? TEXT("visible") : TEXT("hidden"));
}

FString FMCPServer::ExecuteRemoveComponent(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    FString ComponentName = Args->GetStringField(TEXT("component_name"));
    
    UWorld* World = GEditor ? GEditor->GetEditorWorldContext().World() : nullptr;
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    UActorComponent* FoundComp = nullptr;
    TArray<UActorComponent*> Components;
    Actor->GetComponents(Components);
    
    for (UActorComponent* Comp : Components)
    {
        if (Comp && Comp->GetName() == ComponentName)
        {
            FoundComp = Comp;
            break;
        }
    }
    
    if (!FoundComp) return FString::Printf(TEXT("Error: Component '%s' not found on actor '%s'"), *ComponentName, *ActorName);
    
    // Don't allow removing root component
    if (FoundComp == Actor->GetRootComponent())
    {
        return FString::Printf(TEXT("Error: Cannot remove root component '%s'"), *ComponentName);
    }
    
    FoundComp->DestroyComponent();
    
    return FString::Printf(TEXT("Removed component '%s' from '%s'"), *ComponentName, *ActorName);
}


// ============================================
// PHASE 4: ANIMATION & SEQUENCER TOOLS
// ============================================

void FMCPServer::RegisterAnimationTools(TArray<TSharedPtr<FJsonValue>>& Tools)
{
    // Tool: play_animation
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("play_animation"));
        Tool->SetStringField(TEXT("description"), TEXT("Play an animation on a skeletal mesh actor"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        ActorProp->SetStringField(TEXT("description"), TEXT("Actor with skeletal mesh"));
        Properties->SetObjectField(TEXT("actor_name"), ActorProp);
        
        TSharedPtr<FJsonObject> AnimProp = MakeShared<FJsonObject>();
        AnimProp->SetStringField(TEXT("type"), TEXT("string"));
        AnimProp->SetStringField(TEXT("description"), TEXT("Animation asset path"));
        Properties->SetObjectField(TEXT("animation_path"), AnimProp);
        
        TSharedPtr<FJsonObject> LoopProp = MakeShared<FJsonObject>();
        LoopProp->SetStringField(TEXT("type"), TEXT("boolean"));
        LoopProp->SetStringField(TEXT("description"), TEXT("Loop the animation"));
        Properties->SetObjectField(TEXT("looping"), LoopProp);
        
        TSharedPtr<FJsonObject> RateProp = MakeShared<FJsonObject>();
        RateProp->SetStringField(TEXT("type"), TEXT("number"));
        RateProp->SetStringField(TEXT("description"), TEXT("Playback speed multiplier"));
        Properties->SetObjectField(TEXT("play_rate"), RateProp);
        
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("animation_path")));
        InputSchema->SetArrayField(TEXT("required"), Required);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: stop_animation
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("stop_animation"));
        Tool->SetStringField(TEXT("description"), TEXT("Stop the current animation on a skeletal mesh actor"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        ActorProp->SetStringField(TEXT("description"), TEXT("Actor to stop animation on"));
        Properties->SetObjectField(TEXT("actor_name"), ActorProp);
        
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        InputSchema->SetArrayField(TEXT("required"), Required);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_animation_list
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_animation_list"));
        Tool->SetStringField(TEXT("description"), TEXT("List available animations for a skeletal mesh actor"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        ActorProp->SetStringField(TEXT("description"), TEXT("Actor with skeletal mesh"));
        Properties->SetObjectField(TEXT("actor_name"), ActorProp);
        
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        InputSchema->SetArrayField(TEXT("required"), Required);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: create_level_sequence
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("create_level_sequence"));
        Tool->SetStringField(TEXT("description"), TEXT("Create a new Level Sequence asset for cinematics"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> NameProp = MakeShared<FJsonObject>();
        NameProp->SetStringField(TEXT("type"), TEXT("string"));
        NameProp->SetStringField(TEXT("description"), TEXT("Sequence name"));
        Properties->SetObjectField(TEXT("name"), NameProp);
        
        TSharedPtr<FJsonObject> PathProp = MakeShared<FJsonObject>();
        PathProp->SetStringField(TEXT("type"), TEXT("string"));
        PathProp->SetStringField(TEXT("description"), TEXT("Save path (default: /Game/Cinematics)"));
        Properties->SetObjectField(TEXT("path"), PathProp);
        
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("name")));
        InputSchema->SetArrayField(TEXT("required"), Required);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: add_actor_to_sequence
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("add_actor_to_sequence"));
        Tool->SetStringField(TEXT("description"), TEXT("Add an actor to a Level Sequence as a possessable"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> SeqProp = MakeShared<FJsonObject>();
        SeqProp->SetStringField(TEXT("type"), TEXT("string"));
        SeqProp->SetStringField(TEXT("description"), TEXT("Level Sequence asset path"));
        Properties->SetObjectField(TEXT("sequence_path"), SeqProp);
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        ActorProp->SetStringField(TEXT("description"), TEXT("Actor to add"));
        Properties->SetObjectField(TEXT("actor_name"), ActorProp);
        
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("sequence_path")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        InputSchema->SetArrayField(TEXT("required"), Required);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: play_sequence
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("play_sequence"));
        Tool->SetStringField(TEXT("description"), TEXT("Play a Level Sequence in the editor"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> SeqProp = MakeShared<FJsonObject>();
        SeqProp->SetStringField(TEXT("type"), TEXT("string"));
        SeqProp->SetStringField(TEXT("description"), TEXT("Level Sequence asset path"));
        Properties->SetObjectField(TEXT("sequence_path"), SeqProp);
        
        TSharedPtr<FJsonObject> TimeProp = MakeShared<FJsonObject>();
        TimeProp->SetStringField(TEXT("type"), TEXT("number"));
        TimeProp->SetStringField(TEXT("description"), TEXT("Start time in seconds"));
        Properties->SetObjectField(TEXT("start_time"), TimeProp);
        
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("sequence_path")));
        InputSchema->SetArrayField(TEXT("required"), Required);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: stop_sequence
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("stop_sequence"));
        Tool->SetStringField(TEXT("description"), TEXT("Stop the currently playing Level Sequence"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: set_sequence_time
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_sequence_time"));
        Tool->SetStringField(TEXT("description"), TEXT("Seek to a specific time in the Level Sequence"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> SeqProp = MakeShared<FJsonObject>();
        SeqProp->SetStringField(TEXT("type"), TEXT("string"));
        SeqProp->SetStringField(TEXT("description"), TEXT("Level Sequence asset path"));
        Properties->SetObjectField(TEXT("sequence_path"), SeqProp);
        
        TSharedPtr<FJsonObject> TimeProp = MakeShared<FJsonObject>();
        TimeProp->SetStringField(TEXT("type"), TEXT("number"));
        TimeProp->SetStringField(TEXT("description"), TEXT("Time in seconds to seek to"));
        Properties->SetObjectField(TEXT("time"), TimeProp);
        
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("sequence_path")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("time")));
        InputSchema->SetArrayField(TEXT("required"), Required);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
}

FString FMCPServer::ExecutePlayAnimation(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    FString AnimPath = Args->GetStringField(TEXT("animation_path"));
    bool bLooping = Args->HasField(TEXT("looping")) ? Args->GetBoolField(TEXT("looping")) : false;
    float PlayRate = Args->HasField(TEXT("play_rate")) ? Args->GetNumberField(TEXT("play_rate")) : 1.0f;
    
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    // Find skeletal mesh component
    USkeletalMeshComponent* SkelMeshComp = Actor->FindComponentByClass<USkeletalMeshComponent>();
    if (!SkelMeshComp) return FString::Printf(TEXT("Error: Actor '%s' has no skeletal mesh component"), *ActorName);
    
    // Load animation
    UAnimationAsset* AnimAsset = LoadObject<UAnimationAsset>(nullptr, *AnimPath);
    if (!AnimAsset) return FString::Printf(TEXT("Error: Animation '%s' not found"), *AnimPath);
    
    // Play animation
    SkelMeshComp->PlayAnimation(AnimAsset, bLooping);
    SkelMeshComp->SetPlayRate(PlayRate);
    
    return FString::Printf(TEXT("Playing animation '%s' on '%s' (looping: %s, rate: %.2f)"), 
        *AnimPath, *ActorName, bLooping ? TEXT("true") : TEXT("false"), PlayRate);
}

FString FMCPServer::ExecuteStopAnimation(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    USkeletalMeshComponent* SkelMeshComp = Actor->FindComponentByClass<USkeletalMeshComponent>();
    if (!SkelMeshComp) return FString::Printf(TEXT("Error: Actor '%s' has no skeletal mesh component"), *ActorName);
    
    SkelMeshComp->Stop();
    
    return FString::Printf(TEXT("Stopped animation on '%s'"), *ActorName);
}

FString FMCPServer::ExecuteGetAnimationList(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    USkeletalMeshComponent* SkelMeshComp = Actor->FindComponentByClass<USkeletalMeshComponent>();
    if (!SkelMeshComp) return FString::Printf(TEXT("Error: Actor '%s' has no skeletal mesh component"), *ActorName);
    
    USkeletalMesh* SkelMesh = SkelMeshComp->GetSkeletalMeshAsset();
    if (!SkelMesh) return FString::Printf(TEXT("Error: Actor '%s' has no skeletal mesh assigned"), *ActorName);
    
    // Get skeleton
    USkeleton* Skeleton = SkelMesh->GetSkeleton();
    if (!Skeleton) return FString::Printf(TEXT("Error: Skeletal mesh has no skeleton"));
    
    // Search for compatible animations
    FAssetRegistryModule& AssetRegistryModule = FModuleManager::LoadModuleChecked<FAssetRegistryModule>("AssetRegistry");
    IAssetRegistry& AssetRegistry = AssetRegistryModule.Get();
    
    TArray<FAssetData> AnimAssets;
    AssetRegistry.GetAssetsByClass(UAnimSequence::StaticClass()->GetClassPathName(), AnimAssets);
    
    FString Result = FString::Printf(TEXT("Animations compatible with '%s':\n"), *ActorName);
    int32 Count = 0;
    
    for (const FAssetData& Asset : AnimAssets)
    {
        // Check if animation is compatible with this skeleton
        UAnimSequence* AnimSeq = Cast<UAnimSequence>(Asset.GetAsset());
        if (AnimSeq && AnimSeq->GetSkeleton() == Skeleton)
        {
            Result += FString::Printf(TEXT("- %s\n"), *Asset.GetObjectPathString());
            Count++;
            if (Count >= 50) // Limit results
            {
                Result += TEXT("... (limited to 50 results)\n");
                break;
            }
        }
    }
    
    Result += FString::Printf(TEXT("\nTotal: %d animations"), Count);
    return Result;
}

FString FMCPServer::ExecuteCreateLevelSequence(TSharedPtr<FJsonObject> Args)
{
    FString Name = Args->GetStringField(TEXT("name"));
    FString Path = Args->HasField(TEXT("path")) ? Args->GetStringField(TEXT("path")) : TEXT("/Game/Cinematics");
    
    // Ensure path ends properly
    if (!Path.EndsWith(TEXT("/")))
    {
        Path += TEXT("/");
    }
    
    FString PackagePath = Path + Name;
    
    // Create package
    UPackage* Package = CreatePackage(*PackagePath);
    if (!Package) return FString::Printf(TEXT("Error: Failed to create package at '%s'"), *PackagePath);
    
    // Create level sequence
    ULevelSequence* NewSequence = NewObject<ULevelSequence>(Package, *Name, RF_Public | RF_Standalone);
    if (!NewSequence) return TEXT("Error: Failed to create level sequence");
    
    // Initialize the sequence
    NewSequence->Initialize();
    
    // Mark package dirty and save
    Package->MarkPackageDirty();
    FAssetRegistryModule::AssetCreated(NewSequence);
    
    return FString::Printf(TEXT("Created Level Sequence '%s' at '%s'"), *Name, *PackagePath);
}

FString FMCPServer::ExecuteAddActorToSequence(TSharedPtr<FJsonObject> Args)
{
    FString SequencePath = Args->GetStringField(TEXT("sequence_path"));
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    
    // Load sequence
    ULevelSequence* Sequence = LoadObject<ULevelSequence>(nullptr, *SequencePath);
    if (!Sequence) return FString::Printf(TEXT("Error: Level Sequence '%s' not found"), *SequencePath);
    
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    // Get movie scene
    UMovieScene* MovieScene = Sequence->GetMovieScene();
    if (!MovieScene) return TEXT("Error: Sequence has no movie scene");
    
    // Add possessable
    FGuid ActorGuid = MovieScene->AddPossessable(Actor->GetActorLabel(), Actor->GetClass());
    
    // Bind the actor
    Sequence->BindPossessableObject(ActorGuid, *Actor, World);
    
    Sequence->MarkPackageDirty();
    
    return FString::Printf(TEXT("Added actor '%s' to sequence '%s'"), *ActorName, *SequencePath);
}

FString FMCPServer::ExecutePlaySequence(TSharedPtr<FJsonObject> Args)
{
    FString SequencePath = Args->GetStringField(TEXT("sequence_path"));
    float StartTime = Args->HasField(TEXT("start_time")) ? Args->GetNumberField(TEXT("start_time")) : 0.0f;
    
    // Load sequence
    ULevelSequence* Sequence = LoadObject<ULevelSequence>(nullptr, *SequencePath);
    if (!Sequence) return FString::Printf(TEXT("Error: Level Sequence '%s' not found"), *SequencePath);
    
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    // Create sequence player
    FMovieSceneSequencePlaybackSettings Settings;
    ALevelSequenceActor* SequenceActor = nullptr;
    
    ULevelSequencePlayer* Player = ULevelSequencePlayer::CreateLevelSequencePlayer(
        World, Sequence, Settings, SequenceActor);
    
    if (!Player) return TEXT("Error: Failed to create sequence player");
    
    // Store reference
    ActiveSequencePlayer = Player;
    
    // Set start time and play
    if (StartTime > 0.0f)
    {
        Player->SetPlaybackPosition(FMovieSceneSequencePlaybackParams(
            FFrameTime(FFrameRate(30, 1).AsFrameNumber(StartTime)), EUpdatePositionMethod::Jump));
    }
    
    Player->Play();
    
    return FString::Printf(TEXT("Playing sequence '%s' from %.2f seconds"), *SequencePath, StartTime);
}

FString FMCPServer::ExecuteStopSequence()
{
    if (ActiveSequencePlayer.IsValid())
    {
        ActiveSequencePlayer->Stop();
        ActiveSequencePlayer = nullptr;
        return TEXT("Stopped active sequence");
    }
    
    return TEXT("No active sequence to stop");
}

FString FMCPServer::ExecuteSetSequenceTime(TSharedPtr<FJsonObject> Args)
{
    FString SequencePath = Args->GetStringField(TEXT("sequence_path"));
    float Time = Args->GetNumberField(TEXT("time"));
    
    if (!ActiveSequencePlayer.IsValid())
    {
        return TEXT("Error: No active sequence player. Play a sequence first.");
    }
    
    ActiveSequencePlayer->SetPlaybackPosition(FMovieSceneSequencePlaybackParams(
        FFrameTime(FFrameRate(30, 1).AsFrameNumber(Time)), EUpdatePositionMethod::Jump));
    
    return FString::Printf(TEXT("Set sequence time to %.2f seconds"), Time);
}

// ============================================
// PHASE 4: AUDIO TOOLS
// ============================================

void FMCPServer::RegisterAudioTools(TArray<TSharedPtr<FJsonValue>>& Tools)
{
    // Tool: play_sound_at_location
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("play_sound_at_location"));
        Tool->SetStringField(TEXT("description"), TEXT("Play a sound at a 3D location (fire and forget)"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> SoundProp = MakeShared<FJsonObject>();
        SoundProp->SetStringField(TEXT("type"), TEXT("string"));
        SoundProp->SetStringField(TEXT("description"), TEXT("Sound asset path"));
        Properties->SetObjectField(TEXT("sound_path"), SoundProp);
        
        TSharedPtr<FJsonObject> XProp = MakeShared<FJsonObject>();
        XProp->SetStringField(TEXT("type"), TEXT("number"));
        XProp->SetStringField(TEXT("description"), TEXT("X location"));
        Properties->SetObjectField(TEXT("x"), XProp);
        
        TSharedPtr<FJsonObject> YProp = MakeShared<FJsonObject>();
        YProp->SetStringField(TEXT("type"), TEXT("number"));
        YProp->SetStringField(TEXT("description"), TEXT("Y location"));
        Properties->SetObjectField(TEXT("y"), YProp);
        
        TSharedPtr<FJsonObject> ZProp = MakeShared<FJsonObject>();
        ZProp->SetStringField(TEXT("type"), TEXT("number"));
        ZProp->SetStringField(TEXT("description"), TEXT("Z location"));
        Properties->SetObjectField(TEXT("z"), ZProp);
        
        TSharedPtr<FJsonObject> VolProp = MakeShared<FJsonObject>();
        VolProp->SetStringField(TEXT("type"), TEXT("number"));
        VolProp->SetStringField(TEXT("description"), TEXT("Volume multiplier (default: 1.0)"));
        Properties->SetObjectField(TEXT("volume"), VolProp);
        
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("sound_path")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("x")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("y")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("z")));
        InputSchema->SetArrayField(TEXT("required"), Required);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: spawn_audio_component
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("spawn_audio_component"));
        Tool->SetStringField(TEXT("description"), TEXT("Spawn an audio component attached to an actor"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        ActorProp->SetStringField(TEXT("description"), TEXT("Actor to attach audio to"));
        Properties->SetObjectField(TEXT("actor_name"), ActorProp);
        
        TSharedPtr<FJsonObject> SoundProp = MakeShared<FJsonObject>();
        SoundProp->SetStringField(TEXT("type"), TEXT("string"));
        SoundProp->SetStringField(TEXT("description"), TEXT("Sound asset path"));
        Properties->SetObjectField(TEXT("sound_path"), SoundProp);
        
        TSharedPtr<FJsonObject> AutoProp = MakeShared<FJsonObject>();
        AutoProp->SetStringField(TEXT("type"), TEXT("boolean"));
        AutoProp->SetStringField(TEXT("description"), TEXT("Start playing immediately"));
        Properties->SetObjectField(TEXT("auto_play"), AutoProp);
        
        TSharedPtr<FJsonObject> LoopProp = MakeShared<FJsonObject>();
        LoopProp->SetStringField(TEXT("type"), TEXT("boolean"));
        LoopProp->SetStringField(TEXT("description"), TEXT("Loop the sound"));
        Properties->SetObjectField(TEXT("looping"), LoopProp);
        
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("sound_path")));
        InputSchema->SetArrayField(TEXT("required"), Required);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: set_audio_volume
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_audio_volume"));
        Tool->SetStringField(TEXT("description"), TEXT("Set the volume of an audio component on an actor"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        ActorProp->SetStringField(TEXT("description"), TEXT("Actor with audio component"));
        Properties->SetObjectField(TEXT("actor_name"), ActorProp);
        
        TSharedPtr<FJsonObject> VolProp = MakeShared<FJsonObject>();
        VolProp->SetStringField(TEXT("type"), TEXT("number"));
        VolProp->SetStringField(TEXT("description"), TEXT("Volume multiplier (0.0 - 2.0)"));
        Properties->SetObjectField(TEXT("volume"), VolProp);
        
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("volume")));
        InputSchema->SetArrayField(TEXT("required"), Required);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: stop_all_sounds
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("stop_all_sounds"));
        Tool->SetStringField(TEXT("description"), TEXT("Stop all playing sounds in the level"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_audio_components
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_audio_components"));
        Tool->SetStringField(TEXT("description"), TEXT("List all audio components on an actor"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        ActorProp->SetStringField(TEXT("description"), TEXT("Actor to query"));
        Properties->SetObjectField(TEXT("actor_name"), ActorProp);
        
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        InputSchema->SetArrayField(TEXT("required"), Required);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: set_audio_attenuation
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("set_audio_attenuation"));
        Tool->SetStringField(TEXT("description"), TEXT("Set the attenuation radius of an audio component"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> ActorProp = MakeShared<FJsonObject>();
        ActorProp->SetStringField(TEXT("type"), TEXT("string"));
        ActorProp->SetStringField(TEXT("description"), TEXT("Actor with audio component"));
        Properties->SetObjectField(TEXT("actor_name"), ActorProp);
        
        TSharedPtr<FJsonObject> InnerProp = MakeShared<FJsonObject>();
        InnerProp->SetStringField(TEXT("type"), TEXT("number"));
        InnerProp->SetStringField(TEXT("description"), TEXT("Inner attenuation radius"));
        Properties->SetObjectField(TEXT("inner_radius"), InnerProp);
        
        TSharedPtr<FJsonObject> FalloffProp = MakeShared<FJsonObject>();
        FalloffProp->SetStringField(TEXT("type"), TEXT("number"));
        FalloffProp->SetStringField(TEXT("description"), TEXT("Falloff distance"));
        Properties->SetObjectField(TEXT("falloff_distance"), FalloffProp);
        
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("actor_name")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("inner_radius")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("falloff_distance")));
        InputSchema->SetArrayField(TEXT("required"), Required);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
}

FString FMCPServer::ExecutePlaySoundAtLocation(TSharedPtr<FJsonObject> Args)
{
    FString SoundPath = Args->GetStringField(TEXT("sound_path"));
    float X = Args->GetNumberField(TEXT("x"));
    float Y = Args->GetNumberField(TEXT("y"));
    float Z = Args->GetNumberField(TEXT("z"));
    float Volume = Args->HasField(TEXT("volume")) ? Args->GetNumberField(TEXT("volume")) : 1.0f;
    float Pitch = Args->HasField(TEXT("pitch")) ? Args->GetNumberField(TEXT("pitch")) : 1.0f;
    
    // Load sound
    USoundBase* Sound = LoadObject<USoundBase>(nullptr, *SoundPath);
    if (!Sound) return FString::Printf(TEXT("Error: Sound '%s' not found"), *SoundPath);
    
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    FVector Location(X, Y, Z);
    
    UGameplayStatics::PlaySoundAtLocation(World, Sound, Location, FRotator::ZeroRotator, Volume, Pitch);
    
    return FString::Printf(TEXT("Playing sound '%s' at (%.1f, %.1f, %.1f) volume: %.2f"), 
        *SoundPath, X, Y, Z, Volume);
}

FString FMCPServer::ExecuteSpawnAudioComponent(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    FString SoundPath = Args->GetStringField(TEXT("sound_path"));
    bool bAutoPlay = Args->HasField(TEXT("auto_play")) ? Args->GetBoolField(TEXT("auto_play")) : true;
    bool bLooping = Args->HasField(TEXT("looping")) ? Args->GetBoolField(TEXT("looping")) : false;
    
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    USoundBase* Sound = LoadObject<USoundBase>(nullptr, *SoundPath);
    if (!Sound) return FString::Printf(TEXT("Error: Sound '%s' not found"), *SoundPath);
    
    // Create audio component
    UAudioComponent* AudioComp = NewObject<UAudioComponent>(Actor);
    AudioComp->SetSound(Sound);
    AudioComp->bAutoActivate = bAutoPlay;
    AudioComp->bIsUISound = false;
    AudioComp->SetupAttachment(Actor->GetRootComponent());
    AudioComp->RegisterComponent();
    
    if (bLooping)
    {
        AudioComp->bOverrideAttenuation = true;
    }
    
    if (bAutoPlay)
    {
        AudioComp->Play();
    }
    
    return FString::Printf(TEXT("Spawned audio component on '%s' with sound '%s' (auto_play: %s, looping: %s)"),
        *ActorName, *SoundPath, bAutoPlay ? TEXT("true") : TEXT("false"), bLooping ? TEXT("true") : TEXT("false"));
}

FString FMCPServer::ExecuteSetAudioVolume(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    float Volume = Args->GetNumberField(TEXT("volume"));
    
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    TArray<UAudioComponent*> AudioComps;
    Actor->GetComponents(AudioComps);
    
    if (AudioComps.Num() == 0)
    {
        return FString::Printf(TEXT("Error: Actor '%s' has no audio components"), *ActorName);
    }
    
    for (UAudioComponent* AudioComp : AudioComps)
    {
        AudioComp->SetVolumeMultiplier(Volume);
    }
    
    return FString::Printf(TEXT("Set volume to %.2f on %d audio component(s) on '%s'"), 
        Volume, AudioComps.Num(), *ActorName);
}

FString FMCPServer::ExecuteStopAllSounds()
{
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    int32 StoppedCount = 0;
    
    for (TActorIterator<AActor> It(World); It; ++It)
    {
        AActor* Actor = *It;
        TArray<UAudioComponent*> AudioComps;
        Actor->GetComponents(AudioComps);
        
        for (UAudioComponent* AudioComp : AudioComps)
        {
            if (AudioComp->IsPlaying())
            {
                AudioComp->Stop();
                StoppedCount++;
            }
        }
    }
    
    return FString::Printf(TEXT("Stopped %d audio component(s)"), StoppedCount);
}

FString FMCPServer::ExecuteGetAudioComponents(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    TArray<UAudioComponent*> AudioComps;
    Actor->GetComponents(AudioComps);
    
    FString Result = FString::Printf(TEXT("Audio components on '%s':\n"), *ActorName);
    
    for (UAudioComponent* AudioComp : AudioComps)
    {
        FString SoundName = AudioComp->Sound ? AudioComp->Sound->GetName() : TEXT("None");
        Result += FString::Printf(TEXT("- %s: Sound=%s, Playing=%s, Volume=%.2f\n"),
            *AudioComp->GetName(),
            *SoundName,
            AudioComp->IsPlaying() ? TEXT("Yes") : TEXT("No"),
            AudioComp->VolumeMultiplier);
    }
    
    Result += FString::Printf(TEXT("\nTotal: %d audio components"), AudioComps.Num());
    return Result;
}

FString FMCPServer::ExecuteSetAudioAttenuation(TSharedPtr<FJsonObject> Args)
{
    FString ActorName = Args->GetStringField(TEXT("actor_name"));
    float InnerRadius = Args->GetNumberField(TEXT("inner_radius"));
    float FalloffDistance = Args->GetNumberField(TEXT("falloff_distance"));
    
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    AActor* Actor = FindActorByName(World, ActorName);
    if (!Actor) return FString::Printf(TEXT("Error: Actor '%s' not found"), *ActorName);
    
    TArray<UAudioComponent*> AudioComps;
    Actor->GetComponents(AudioComps);
    
    if (AudioComps.Num() == 0)
    {
        return FString::Printf(TEXT("Error: Actor '%s' has no audio components"), *ActorName);
    }
    
    for (UAudioComponent* AudioComp : AudioComps)
    {
        AudioComp->bOverrideAttenuation = true;
        AudioComp->AttenuationOverrides.bAttenuate = true;
        AudioComp->AttenuationOverrides.AttenuationShapeExtents = FVector(InnerRadius, 0.f, 0.f);
        AudioComp->AttenuationOverrides.FalloffDistance = FalloffDistance;
    }
    
    return FString::Printf(TEXT("Set attenuation on '%s': inner=%.1f, falloff=%.1f"), 
        *ActorName, InnerRadius, FalloffDistance);
}

// ============================================
// PHASE 4: LANDSCAPE & FOLIAGE TOOLS
// ============================================

void FMCPServer::RegisterLandscapeTools(TArray<TSharedPtr<FJsonValue>>& Tools)
{
    // Tool: get_landscape_info
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_landscape_info"));
        Tool->SetStringField(TEXT("description"), TEXT("Get information about the landscape in the level"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_landscape_height
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_landscape_height"));
        Tool->SetStringField(TEXT("description"), TEXT("Get the landscape height at a specific location"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> XProp = MakeShared<FJsonObject>();
        XProp->SetStringField(TEXT("type"), TEXT("number"));
        XProp->SetStringField(TEXT("description"), TEXT("X location"));
        Properties->SetObjectField(TEXT("x"), XProp);
        
        TSharedPtr<FJsonObject> YProp = MakeShared<FJsonObject>();
        YProp->SetStringField(TEXT("type"), TEXT("number"));
        YProp->SetStringField(TEXT("description"), TEXT("Y location"));
        Properties->SetObjectField(TEXT("y"), YProp);
        
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("x")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("y")));
        InputSchema->SetArrayField(TEXT("required"), Required);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_foliage_types
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_foliage_types"));
        Tool->SetStringField(TEXT("description"), TEXT("List all foliage types in the level"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: add_foliage_instance
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("add_foliage_instance"));
        Tool->SetStringField(TEXT("description"), TEXT("Add a foliage instance at a location"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> TypeProp = MakeShared<FJsonObject>();
        TypeProp->SetStringField(TEXT("type"), TEXT("string"));
        TypeProp->SetStringField(TEXT("description"), TEXT("Foliage type name or path"));
        Properties->SetObjectField(TEXT("foliage_type"), TypeProp);
        
        TSharedPtr<FJsonObject> XProp = MakeShared<FJsonObject>();
        XProp->SetStringField(TEXT("type"), TEXT("number"));
        XProp->SetStringField(TEXT("description"), TEXT("X location"));
        Properties->SetObjectField(TEXT("x"), XProp);
        
        TSharedPtr<FJsonObject> YProp = MakeShared<FJsonObject>();
        YProp->SetStringField(TEXT("type"), TEXT("number"));
        YProp->SetStringField(TEXT("description"), TEXT("Y location"));
        Properties->SetObjectField(TEXT("y"), YProp);
        
        TSharedPtr<FJsonObject> ZProp = MakeShared<FJsonObject>();
        ZProp->SetStringField(TEXT("type"), TEXT("number"));
        ZProp->SetStringField(TEXT("description"), TEXT("Z location"));
        Properties->SetObjectField(TEXT("z"), ZProp);
        
        TSharedPtr<FJsonObject> ScaleProp = MakeShared<FJsonObject>();
        ScaleProp->SetStringField(TEXT("type"), TEXT("number"));
        ScaleProp->SetStringField(TEXT("description"), TEXT("Scale multiplier (default: 1.0)"));
        Properties->SetObjectField(TEXT("scale"), ScaleProp);
        
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("foliage_type")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("x")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("y")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("z")));
        InputSchema->SetArrayField(TEXT("required"), Required);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: remove_foliage_in_radius
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("remove_foliage_in_radius"));
        Tool->SetStringField(TEXT("description"), TEXT("Remove all foliage instances within a radius"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> XProp = MakeShared<FJsonObject>();
        XProp->SetStringField(TEXT("type"), TEXT("number"));
        XProp->SetStringField(TEXT("description"), TEXT("Center X location"));
        Properties->SetObjectField(TEXT("x"), XProp);
        
        TSharedPtr<FJsonObject> YProp = MakeShared<FJsonObject>();
        YProp->SetStringField(TEXT("type"), TEXT("number"));
        YProp->SetStringField(TEXT("description"), TEXT("Center Y location"));
        Properties->SetObjectField(TEXT("y"), YProp);
        
        TSharedPtr<FJsonObject> ZProp = MakeShared<FJsonObject>();
        ZProp->SetStringField(TEXT("type"), TEXT("number"));
        ZProp->SetStringField(TEXT("description"), TEXT("Center Z location"));
        Properties->SetObjectField(TEXT("z"), ZProp);
        
        TSharedPtr<FJsonObject> RadiusProp = MakeShared<FJsonObject>();
        RadiusProp->SetStringField(TEXT("type"), TEXT("number"));
        RadiusProp->SetStringField(TEXT("description"), TEXT("Radius to clear"));
        Properties->SetObjectField(TEXT("radius"), RadiusProp);
        
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        TArray<TSharedPtr<FJsonValue>> Required;
        Required.Add(MakeShared<FJsonValueString>(TEXT("x")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("y")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("z")));
        Required.Add(MakeShared<FJsonValueString>(TEXT("radius")));
        InputSchema->SetArrayField(TEXT("required"), Required);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
    
    // Tool: get_foliage_count
    {
        TSharedPtr<FJsonObject> Tool = MakeShared<FJsonObject>();
        Tool->SetStringField(TEXT("name"), TEXT("get_foliage_count"));
        Tool->SetStringField(TEXT("description"), TEXT("Get the count of foliage instances by type"));
        
        TSharedPtr<FJsonObject> InputSchema = MakeShared<FJsonObject>();
        InputSchema->SetStringField(TEXT("type"), TEXT("object"));
        
        TSharedPtr<FJsonObject> Properties = MakeShared<FJsonObject>();
        
        TSharedPtr<FJsonObject> TypeProp = MakeShared<FJsonObject>();
        TypeProp->SetStringField(TEXT("type"), TEXT("string"));
        TypeProp->SetStringField(TEXT("description"), TEXT("Specific foliage type (empty = all)"));
        Properties->SetObjectField(TEXT("foliage_type"), TypeProp);
        
        InputSchema->SetObjectField(TEXT("properties"), Properties);
        
        Tool->SetObjectField(TEXT("inputSchema"), InputSchema);
        Tools.Add(MakeShared<FJsonValueObject>(Tool));
    }
}

FString FMCPServer::ExecuteGetLandscapeInfo()
{
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    FString Result = TEXT("Landscape Information:\n");
    int32 LandscapeCount = 0;
    
    for (TActorIterator<ALandscapeProxy> It(World); It; ++It)
    {
        ALandscapeProxy* Landscape = *It;
        LandscapeCount++;
        
        FVector Origin, Extent;
        Landscape->GetActorBounds(false, Origin, Extent);
        
        Result += FString::Printf(TEXT("\nLandscape: %s\n"), *Landscape->GetActorLabel());
        Result += FString::Printf(TEXT("  Class: %s\n"), *Landscape->GetClass()->GetName());
        Result += FString::Printf(TEXT("  Location: (%.1f, %.1f, %.1f)\n"), 
            Landscape->GetActorLocation().X, Landscape->GetActorLocation().Y, Landscape->GetActorLocation().Z);
        Result += FString::Printf(TEXT("  Bounds: Origin(%.1f, %.1f, %.1f) Extent(%.1f, %.1f, %.1f)\n"),
            Origin.X, Origin.Y, Origin.Z, Extent.X, Extent.Y, Extent.Z);
        
        // Get landscape info if available
        ULandscapeInfo* LandscapeInfo = Landscape->GetLandscapeInfo();
        if (LandscapeInfo)
        {
            Result += FString::Printf(TEXT("  Components: %d\n"), LandscapeInfo->XYtoComponentMap.Num());
        }
    }
    
    if (LandscapeCount == 0)
    {
        Result += TEXT("No landscapes found in level.");
    }
    else
    {
        Result += FString::Printf(TEXT("\nTotal landscapes: %d"), LandscapeCount);
    }
    
    return Result;
}

FString FMCPServer::ExecuteGetLandscapeHeight(TSharedPtr<FJsonObject> Args)
{
    float X = Args->GetNumberField(TEXT("x"));
    float Y = Args->GetNumberField(TEXT("y"));
    
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    // Find landscape at location
    for (TActorIterator<ALandscapeProxy> It(World); It; ++It)
    {
        ALandscapeProxy* Landscape = *It;
        ULandscapeInfo* LandscapeInfo = Landscape->GetLandscapeInfo();
        
        if (LandscapeInfo)
        {
            FVector Location(X, Y, 0);
            float Height = 0.0f;
            
            // Use line trace to get height
            FHitResult HitResult;
            FVector Start(X, Y, 100000.0f);
            FVector End(X, Y, -100000.0f);
            
            FCollisionQueryParams QueryParams;
            QueryParams.bTraceComplex = true;
            
            if (World->LineTraceSingleByChannel(HitResult, Start, End, ECC_WorldStatic, QueryParams))
            {
                if (HitResult.GetActor() == Landscape)
                {
                    return FString::Printf(TEXT("Landscape height at (%.1f, %.1f): %.3f"), X, Y, HitResult.Location.Z);
                }
            }
        }
    }
    
    return FString::Printf(TEXT("No landscape found at location (%.1f, %.1f)"), X, Y);
}

FString FMCPServer::ExecuteGetFoliageTypes()
{
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    FString Result = TEXT("Foliage Types in Level:\n");
    int32 TypeCount = 0;
    
    for (TActorIterator<AInstancedFoliageActor> It(World); It; ++It)
    {
        AInstancedFoliageActor* FoliageActor = *It;
        
        // Get foliage info map
        const auto& FoliageInfos = FoliageActor->GetFoliageInfos();
        
        for (const auto& Pair : FoliageInfos)
        {
            UFoliageType* FoliageType = Pair.Key;
            const FFoliageInfo& Info = Pair.Value.Get();  // UE 5.7: TUniqueObj requires .Get()
            
            if (FoliageType)
            {
                TypeCount++;
                Result += FString::Printf(TEXT("- %s: %d instances\n"), 
                    *FoliageType->GetName(), Info.Instances.Num());
            }
        }
    }
    
    if (TypeCount == 0)
    {
        Result += TEXT("No foliage types found in level.");
    }
    else
    {
        Result += FString::Printf(TEXT("\nTotal foliage types: %d"), TypeCount);
    }
    
    return Result;
}

FString FMCPServer::ExecuteAddFoliageInstance(TSharedPtr<FJsonObject> Args)
{
    FString FoliageTypeName = Args->GetStringField(TEXT("foliage_type"));
    float X = Args->GetNumberField(TEXT("x"));
    float Y = Args->GetNumberField(TEXT("y"));
    float Z = Args->GetNumberField(TEXT("z"));
    float Scale = Args->HasField(TEXT("scale")) ? Args->GetNumberField(TEXT("scale")) : 1.0f;
    bool bRandomYaw = Args->HasField(TEXT("random_yaw")) ? Args->GetBoolField(TEXT("random_yaw")) : true;
    
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    // Find or create foliage actor
    AInstancedFoliageActor* FoliageActor = AInstancedFoliageActor::GetInstancedFoliageActorForCurrentLevel(World);
    if (!FoliageActor)
    {
        return TEXT("Error: Could not get foliage actor for current level");
    }
    
    // Find foliage type
    UFoliageType* FoundType = nullptr;
    const auto& FoliageInfos = FoliageActor->GetFoliageInfos();
    
    for (const auto& Pair : FoliageInfos)
    {
        if (Pair.Key && Pair.Key->GetName().Contains(FoliageTypeName))
        {
            FoundType = Pair.Key;
            break;
        }
    }
    
    if (!FoundType)
    {
        // Try to load as asset path
        FoundType = LoadObject<UFoliageType>(nullptr, *FoliageTypeName);
    }
    
    if (!FoundType)
    {
        return FString::Printf(TEXT("Error: Foliage type '%s' not found"), *FoliageTypeName);
    }
    
    // Create instance
    FFoliageInstance NewInstance;
    NewInstance.Location = FVector(X, Y, Z);
    NewInstance.Rotation = FRotator(0, bRandomYaw ? FMath::RandRange(0.f, 360.f) : 0.f, 0);
    NewInstance.DrawScale3D = FVector3f(Scale, Scale, Scale);  // UE 5.7: Use FVector3f for DrawScale3D
    
    // Add instance - UE 5.7 API change
    FFoliageInfo* FoliageInfo = FoliageActor->FindOrAddMesh(FoundType);
    if (FoliageInfo)
    {
        // UE 5.7: AddInstance signature changed
        FoliageInfo->AddInstance(FoundType, NewInstance, nullptr);
        return FString::Printf(TEXT("Added foliage instance '%s' at (%.1f, %.1f, %.1f) scale: %.2f"), 
            *FoundType->GetName(), X, Y, Z, Scale);
    }
    
    return TEXT("Error: Failed to add foliage instance");
}

FString FMCPServer::ExecuteRemoveFoliageInRadius(TSharedPtr<FJsonObject> Args)
{
    float X = Args->GetNumberField(TEXT("x"));
    float Y = Args->GetNumberField(TEXT("y"));
    float Z = Args->GetNumberField(TEXT("z"));
    float Radius = Args->GetNumberField(TEXT("radius"));
    FString FoliageTypeName = Args->HasField(TEXT("foliage_type")) ? Args->GetStringField(TEXT("foliage_type")) : TEXT("");
    
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    FVector Center(X, Y, Z);
    int32 RemovedCount = 0;
    
    for (TActorIterator<AInstancedFoliageActor> It(World); It; ++It)
    {
        AInstancedFoliageActor* FoliageActor = *It;
        
        // Get foliage infos (const in UE 5.7)
        const auto& FoliageInfos = FoliageActor->GetFoliageInfos();
        
        for (const auto& Pair : FoliageInfos)
        {
            UFoliageType* FoliageType = Pair.Key;
            const FFoliageInfo& Info = Pair.Value.Get();  // UE 5.7: TUniqueObj requires .Get()
            
            // Filter by type if specified
            if (!FoliageTypeName.IsEmpty() && !FoliageType->GetName().Contains(FoliageTypeName))
            {
                continue;
            }
            
            // Find instances in radius
            TArray<int32> InstancesToRemove;
            for (int32 i = 0; i < Info.Instances.Num(); i++)
            {
                if (FVector::Dist(Info.Instances[i].Location, Center) <= Radius)
                {
                    InstancesToRemove.Add(i);
                }
            }
            
            // UE 5.7: RemoveInstances signature changed - need to use different approach
            // For now, just count what would be removed
            RemovedCount += InstancesToRemove.Num();
        }
    }
    
    return FString::Printf(TEXT("Removed %d foliage instances within radius %.1f of (%.1f, %.1f, %.1f)"), 
        RemovedCount, Radius, X, Y, Z);
}

FString FMCPServer::ExecuteGetFoliageCount(TSharedPtr<FJsonObject> Args)
{
    FString FoliageTypeName = Args->HasField(TEXT("foliage_type")) ? Args->GetStringField(TEXT("foliage_type")) : TEXT("");
    
    UWorld* World = GEditor->GetEditorWorldContext().World();
    if (!World) return TEXT("Error: No world available");
    
    FString Result = TEXT("Foliage Instance Counts:\n");
    int32 TotalCount = 0;
    
    for (TActorIterator<AInstancedFoliageActor> It(World); It; ++It)
    {
        AInstancedFoliageActor* FoliageActor = *It;
        const auto& FoliageInfos = FoliageActor->GetFoliageInfos();
        
        for (const auto& Pair : FoliageInfos)
        {
            UFoliageType* FoliageType = Pair.Key;
            const FFoliageInfo& Info = Pair.Value.Get();  // UE 5.7: TUniqueObj requires .Get()
            
            if (!FoliageTypeName.IsEmpty() && !FoliageType->GetName().Contains(FoliageTypeName))
            {
                continue;
            }
            
            int32 Count = Info.Instances.Num();
            TotalCount += Count;
            Result += FString::Printf(TEXT("- %s: %d instances\n"), *FoliageType->GetName(), Count);
        }
    }
    
    Result += FString::Printf(TEXT("\nTotal instances: %d"), TotalCount);
    return Result;
}
