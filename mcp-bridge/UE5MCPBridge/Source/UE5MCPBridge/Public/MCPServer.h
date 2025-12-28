// MCPServer.h - UE5 MCP Bridge v3.3.0 - Compatible with UE5.1-5.7
// Phase 1 + Phase 2 + Phase 3 + Phase 4 Implementation: 88 Tools Total
#pragma once

#include "CoreMinimal.h"
#include "HAL/Runnable.h"
#include "MCPVersionCompat.h"

DECLARE_LOG_CATEGORY_EXTERN(LogMCPServer, Log, All);

// Forward declarations
class FSocket;
class FJsonObject;
class FRunnableThread;
class AActor;
class UWorld;

/**
 * MCP Server - Model Context Protocol server for Unreal Engine
 * 
 * This class implements a TCP server that listens for MCP protocol messages
 * and executes commands in the Unreal Editor.
 * 
 * Supported UE Versions: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 * 
 * Version 3.3.0 - Phase 1 + Phase 2 + Phase 3 + Phase 4 Tools (88 total):
 * - Actor Management (19 tools)
 * - Selection & Focus (4 tools)
 * - Viewport & Camera (9 tools)
 * - Level Management (3 tools)
 * - Play In Editor (2 tools)
 * - Asset Management (8 tools)
 * - Blueprint Operations (9 tools)
 * - Material Operations (7 tools)
 * - Physics & Collision (5 tools)
 * - Editor Utilities (4 tools)
 * - Viewport Bookmarks (4 tools)
 * - Component Operations (5 tools)
 * - Animation & Sequencer (8 tools) [NEW Phase 4]
 * - Audio (6 tools) [NEW Phase 4]
 * - Landscape & Foliage (6 tools) [NEW Phase 4]
 */
class UE5MCPBRIDGE_API FMCPServer : public FRunnable
{
public:
    FMCPServer();
    virtual ~FMCPServer();
    
    /** Start the MCP server on the specified port */
    bool Start(int32 Port = 55557);
    
    /** Stop the MCP server */
    void Stop();
    
    /** Check if the server is currently running */
    bool IsRunning() const { return bIsRunning; }
    
    /** Get the port the server is listening on */
    int32 GetPort() const { return ServerPort; }
    
    /** Get the server version string */
    static FString GetVersionString() { return TEXT("3.3.0"); }
    
    // FRunnable interface
    virtual bool Init() override;
    virtual uint32 Run() override;
    virtual void Exit() override;
    
private:
    /** Process an incoming JSON-RPC message */
    FString ProcessMessage(const FString& Message);
    
    // MCP Protocol handlers
    FString HandleInitialize(int32 Id);
    FString HandleToolsList(int32 Id);
    FString HandleToolsCall(int32 Id, TSharedPtr<FJsonObject> Params);
    
    // ============================================
    // ACTOR TOOLS (Original + Phase 1 + Phase 2)
    // ============================================
    FString ExecuteGetActorList();
    FString ExecuteSpawnActor(TSharedPtr<FJsonObject> Args);
    FString ExecuteDeleteActor(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetActorProperties(TSharedPtr<FJsonObject> Args);
    FString ExecuteSetActorProperty(TSharedPtr<FJsonObject> Args);
    FString ExecuteFindActorsByClass(TSharedPtr<FJsonObject> Args);
    FString ExecuteFindActorsByTag(TSharedPtr<FJsonObject> Args);
    FString ExecuteFindActorsByName(TSharedPtr<FJsonObject> Args);
    FString ExecuteDuplicateActor(TSharedPtr<FJsonObject> Args);
    FString ExecuteSetActorVisibility(TSharedPtr<FJsonObject> Args);
    FString ExecuteSnapActorToGround(TSharedPtr<FJsonObject> Args);
    FString ExecuteRenameActor(TSharedPtr<FJsonObject> Args);
    FString ExecuteAddActorTag(TSharedPtr<FJsonObject> Args);
    FString ExecuteRemoveActorTag(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetActorTags(TSharedPtr<FJsonObject> Args);
    FString ExecuteSetActorMobility(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetActorMobility(TSharedPtr<FJsonObject> Args);
    FString ExecuteAttachActorToActor(TSharedPtr<FJsonObject> Args);
    FString ExecuteDetachActor(TSharedPtr<FJsonObject> Args);
    
    // ============================================
    // SELECTION TOOLS (Phase 1)
    // ============================================
    FString ExecuteSelectActors(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetSelectedActors();
    FString ExecuteClearSelection();
    FString ExecuteFocusOnActor(TSharedPtr<FJsonObject> Args);
    
    // ============================================
    // VIEWPORT TOOLS (Phase 1 + Phase 2)
    // ============================================
    FString ExecuteGetViewportCamera();
    FString ExecuteSetViewportCamera(TSharedPtr<FJsonObject> Args);
    FString ExecuteTakeScreenshot(TSharedPtr<FJsonObject> Args);
    FString ExecuteSetViewMode(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetViewMode();
    FString ExecutePilotActor(TSharedPtr<FJsonObject> Args);
    FString ExecuteStopPiloting();
    FString ExecuteSetViewportRealtime(TSharedPtr<FJsonObject> Args);
    FString ExecuteSetViewportStats(TSharedPtr<FJsonObject> Args);
    
    // ============================================
    // LEVEL TOOLS (Phase 1)
    // ============================================
    FString ExecuteGetCurrentLevel();
    FString ExecuteLoadLevel(TSharedPtr<FJsonObject> Args);
    FString ExecuteSaveLevel(TSharedPtr<FJsonObject> Args);
    
    // ============================================
    // PIE TOOLS (Phase 1)
    // ============================================
    FString ExecuteStartPIE(TSharedPtr<FJsonObject> Args);
    FString ExecuteStopPIE();
    
    // ============================================
    // ASSET TOOLS (Phase 1 + Phase 2)
    // ============================================
    FString ExecuteSearchAssets(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetAssetInfo(TSharedPtr<FJsonObject> Args);
    FString ExecuteLoadAsset(TSharedPtr<FJsonObject> Args);
    FString ExecuteDuplicateAsset(TSharedPtr<FJsonObject> Args);
    FString ExecuteRenameAsset(TSharedPtr<FJsonObject> Args);
    FString ExecuteDeleteAsset(TSharedPtr<FJsonObject> Args);
    FString ExecuteCreateFolder(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetAssetReferences(TSharedPtr<FJsonObject> Args);
    
    // ============================================
    // BLUEPRINT TOOLS (Phase 1 + Phase 2)
    // ============================================
    FString ExecuteCreateBlueprint(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetBlueprintInfo(TSharedPtr<FJsonObject> Args);
    FString ExecuteCompileBlueprint(TSharedPtr<FJsonObject> Args);
    FString ExecuteSpawnBlueprintActor(TSharedPtr<FJsonObject> Args);
    FString ExecuteAddBlueprintVariable(TSharedPtr<FJsonObject> Args);
    FString ExecuteRemoveBlueprintVariable(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetBlueprintVariables(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetBlueprintFunctions(TSharedPtr<FJsonObject> Args);
    FString ExecuteSetBlueprintVariableDefault(TSharedPtr<FJsonObject> Args);
    
    // ============================================
    // MATERIAL TOOLS (Phase 1 + Phase 2)
    // ============================================
    FString ExecuteCreateMaterialInstance(TSharedPtr<FJsonObject> Args);
    FString ExecuteSetMaterialScalar(TSharedPtr<FJsonObject> Args);
    FString ExecuteApplyMaterialToActor(TSharedPtr<FJsonObject> Args);
    FString ExecuteSetMaterialVector(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetMaterialParameters(TSharedPtr<FJsonObject> Args);
    FString ExecuteReplaceActorMaterial(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetActorMaterials(TSharedPtr<FJsonObject> Args);
    
    // ============================================
    // EDITOR TOOLS (Original)
    // ============================================
    FString ExecuteConsoleCommand(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetProjectInfo();
    
    // ============================================
    // PHASE 3: PHYSICS & COLLISION TOOLS
    // ============================================
    FString ExecuteSetSimulatePhysics(TSharedPtr<FJsonObject> Args);
    FString ExecuteSetCollisionEnabled(TSharedPtr<FJsonObject> Args);
    FString ExecuteSetCollisionProfile(TSharedPtr<FJsonObject> Args);
    FString ExecuteAddImpulse(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetPhysicsState(TSharedPtr<FJsonObject> Args);
    
    // ============================================
    // PHASE 3: EDITOR UTILITIES TOOLS
    // ============================================
    FString ExecuteGetEditorPreference(TSharedPtr<FJsonObject> Args);
    FString ExecuteSetEditorPreference(TSharedPtr<FJsonObject> Args);
    FString ExecuteRunEditorUtility(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetEngineInfo();
    
    // ============================================
    // PHASE 3: VIEWPORT BOOKMARK TOOLS
    // ============================================
    FString ExecuteSetViewportBookmark(TSharedPtr<FJsonObject> Args);
    FString ExecuteJumpToBookmark(TSharedPtr<FJsonObject> Args);
    FString ExecuteClearBookmark(TSharedPtr<FJsonObject> Args);
    FString ExecuteListBookmarks();
    
    // ============================================
    // PHASE 3: COMPONENT OPERATIONS TOOLS
    // ============================================
    FString ExecuteGetActorComponents(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetComponentProperties(TSharedPtr<FJsonObject> Args);
    FString ExecuteSetComponentTransform(TSharedPtr<FJsonObject> Args);
    FString ExecuteSetComponentVisibility(TSharedPtr<FJsonObject> Args);
    FString ExecuteRemoveComponent(TSharedPtr<FJsonObject> Args);
    
    // ============================================
    // PHASE 4: ANIMATION & SEQUENCER TOOLS
    // ============================================
    FString ExecutePlayAnimation(TSharedPtr<FJsonObject> Args);
    FString ExecuteStopAnimation(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetAnimationList(TSharedPtr<FJsonObject> Args);
    FString ExecuteCreateLevelSequence(TSharedPtr<FJsonObject> Args);
    FString ExecuteAddActorToSequence(TSharedPtr<FJsonObject> Args);
    FString ExecutePlaySequence(TSharedPtr<FJsonObject> Args);
    FString ExecuteStopSequence();
    FString ExecuteSetSequenceTime(TSharedPtr<FJsonObject> Args);
    
    // ============================================
    // PHASE 4: AUDIO TOOLS
    // ============================================
    FString ExecutePlaySoundAtLocation(TSharedPtr<FJsonObject> Args);
    FString ExecuteSpawnAudioComponent(TSharedPtr<FJsonObject> Args);
    FString ExecuteSetAudioVolume(TSharedPtr<FJsonObject> Args);
    FString ExecuteStopAllSounds();
    FString ExecuteGetAudioComponents(TSharedPtr<FJsonObject> Args);
    FString ExecuteSetAudioAttenuation(TSharedPtr<FJsonObject> Args);
    
    // ============================================
    // PHASE 4: LANDSCAPE & FOLIAGE TOOLS
    // ============================================
    FString ExecuteGetLandscapeInfo();
    FString ExecuteGetLandscapeHeight(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetFoliageTypes();
    FString ExecuteAddFoliageInstance(TSharedPtr<FJsonObject> Args);
    FString ExecuteRemoveFoliageInRadius(TSharedPtr<FJsonObject> Args);
    FString ExecuteGetFoliageCount(TSharedPtr<FJsonObject> Args);
    
    // ============================================
    // HELPER FUNCTIONS
    // ============================================
    AActor* FindActorByName(UWorld* World, const FString& ActorName);
    FString CreateSuccessResponse(int32 Id, TSharedPtr<FJsonObject> Result);
    FString CreateErrorResponse(int32 Id, int32 Code, const FString& Message);
    
    // Tool registration helpers
    void RegisterActorTools(TArray<TSharedPtr<FJsonValue>>& Tools);
    void RegisterSelectionTools(TArray<TSharedPtr<FJsonValue>>& Tools);
    void RegisterViewportTools(TArray<TSharedPtr<FJsonValue>>& Tools);
    void RegisterLevelTools(TArray<TSharedPtr<FJsonValue>>& Tools);
    void RegisterPIETools(TArray<TSharedPtr<FJsonValue>>& Tools);
    void RegisterAssetTools(TArray<TSharedPtr<FJsonValue>>& Tools);
    void RegisterBlueprintTools(TArray<TSharedPtr<FJsonValue>>& Tools);
    void RegisterMaterialTools(TArray<TSharedPtr<FJsonValue>>& Tools);
    void RegisterEditorTools(TArray<TSharedPtr<FJsonValue>>& Tools);
    // Phase 3 registration helpers
    void RegisterPhysicsTools(TArray<TSharedPtr<FJsonValue>>& Tools);
    void RegisterEditorUtilityTools(TArray<TSharedPtr<FJsonValue>>& Tools);
    void RegisterBookmarkTools(TArray<TSharedPtr<FJsonValue>>& Tools);
    void RegisterComponentTools(TArray<TSharedPtr<FJsonValue>>& Tools);
    // Phase 4 registration helpers
    void RegisterAnimationTools(TArray<TSharedPtr<FJsonValue>>& Tools);
    void RegisterAudioTools(TArray<TSharedPtr<FJsonValue>>& Tools);
    void RegisterLandscapeTools(TArray<TSharedPtr<FJsonValue>>& Tools);
    
private:
    /** Listener socket for accepting connections */
    FSocket* ListenerSocket;
    
    /** Currently connected client socket */
    FSocket* ClientSocket;
    
    /** Port number the server is listening on */
    int32 ServerPort;
    
    /** Flag indicating if the server is running */
    TAtomic<bool> bIsRunning;
    
    /** Flag to signal the server thread to stop */
    TAtomic<bool> bShouldStop;
    
    /** Server thread handle */
    FRunnableThread* Thread;
    
    /** MCP Protocol version */
    static const FString ProtocolVersion;
    
    /** Viewport bookmarks storage (slot 0-9) */
    struct FViewportBookmark
    {
        bool bIsSet = false;
        FVector Location;
        FRotator Rotation;
        FString Name;
    };
    TArray<FViewportBookmark> ViewportBookmarks;
    
    /** Active level sequence player reference */
    TWeakObjectPtr<class ULevelSequencePlayer> ActiveSequencePlayer;
};
