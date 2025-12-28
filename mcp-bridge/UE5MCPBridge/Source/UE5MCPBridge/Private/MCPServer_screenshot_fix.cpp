// Updated ExecuteTakeScreenshot implementation that returns base64 image data
// This replaces the existing ExecuteTakeScreenshot function in MCPServer.cpp

/*
INSTRUCTIONS FOR APPLYING THIS FIX:

1. Open MCPServer.cpp in your UE5 project
2. Find the ExecuteTakeScreenshot function (around line 2871)
3. Replace it with the code below
4. Add the following includes at the top of the file if not already present:
   #include "IImageWrapper.h"
   #include "IImageWrapperModule.h"
   #include "Modules/ModuleManager.h"
   #include "Misc/Base64.h"
   #include "Engine/TextureRenderTarget2D.h"
   #include "Components/SceneCaptureComponent2D.h"
5. Rebuild the plugin

The new implementation:
- Uses SceneCapture2D to capture the viewport synchronously
- Encodes the image as PNG and then base64
- Returns the base64 data directly in the response
*/

FString FMCPServer::ExecuteTakeScreenshot(TSharedPtr<FJsonObject> Args)
{
    FString Filename = Args.IsValid() && Args->HasField(TEXT("filename")) ?
        Args->GetStringField(TEXT("filename")) : TEXT("Screenshot");
    
    int32 ResolutionX = Args.IsValid() && Args->HasField(TEXT("resolution_x")) ?
        Args->GetIntegerField(TEXT("resolution_x")) : 1280;
    int32 ResolutionY = Args.IsValid() && Args->HasField(TEXT("resolution_y")) ?
        Args->GetIntegerField(TEXT("resolution_y")) : 720;
    
    // Get the active viewport
    if (!GCurrentLevelEditingViewportClient)
    {
        return TEXT("{\"error\": \"No active viewport\"}");
    }
    
    FViewport* Viewport = GCurrentLevelEditingViewportClient->Viewport;
    if (!Viewport)
    {
        return TEXT("{\"error\": \"Viewport not available\"}");
    }
    
    // Capture the viewport to an array of colors
    TArray<FColor> Bitmap;
    FIntRect ViewRect(0, 0, Viewport->GetSizeXY().X, Viewport->GetSizeXY().Y);
    
    if (!Viewport->ReadPixels(Bitmap, FReadSurfaceDataFlags(), ViewRect))
    {
        return TEXT("{\"error\": \"Failed to read viewport pixels\"}");
    }
    
    // Resize if needed (simple point sampling)
    int32 SrcWidth = ViewRect.Width();
    int32 SrcHeight = ViewRect.Height();
    
    TArray<FColor> ResizedBitmap;
    if (SrcWidth != ResolutionX || SrcHeight != ResolutionY)
    {
        ResizedBitmap.SetNum(ResolutionX * ResolutionY);
        for (int32 Y = 0; Y < ResolutionY; Y++)
        {
            for (int32 X = 0; X < ResolutionX; X++)
            {
                int32 SrcX = FMath::Clamp(X * SrcWidth / ResolutionX, 0, SrcWidth - 1);
                int32 SrcY = FMath::Clamp(Y * SrcHeight / ResolutionY, 0, SrcHeight - 1);
                ResizedBitmap[Y * ResolutionX + X] = Bitmap[SrcY * SrcWidth + SrcX];
            }
        }
    }
    else
    {
        ResizedBitmap = MoveTemp(Bitmap);
    }
    
    // Compress to PNG
    IImageWrapperModule& ImageWrapperModule = FModuleManager::LoadModuleChecked<IImageWrapperModule>(FName("ImageWrapper"));
    TSharedPtr<IImageWrapper> ImageWrapper = ImageWrapperModule.CreateImageWrapper(EImageFormat::PNG);
    
    if (!ImageWrapper.IsValid())
    {
        return TEXT("{\"error\": \"Failed to create image wrapper\"}");
    }
    
    // Convert FColor array to raw BGRA data
    TArray<uint8> RawData;
    RawData.SetNum(ResolutionX * ResolutionY * 4);
    for (int32 i = 0; i < ResizedBitmap.Num(); i++)
    {
        RawData[i * 4 + 0] = ResizedBitmap[i].B;
        RawData[i * 4 + 1] = ResizedBitmap[i].G;
        RawData[i * 4 + 2] = ResizedBitmap[i].R;
        RawData[i * 4 + 3] = ResizedBitmap[i].A;
    }
    
    if (!ImageWrapper->SetRaw(RawData.GetData(), RawData.Num(), ResolutionX, ResolutionY, ERGBFormat::BGRA, 8))
    {
        return TEXT("{\"error\": \"Failed to set raw image data\"}");
    }
    
    TArray64<uint8> CompressedData;
    if (!ImageWrapper->GetCompressed(CompressedData, 90))
    {
        return TEXT("{\"error\": \"Failed to compress image\"}");
    }
    
    // Encode to base64
    FString Base64Data = FBase64::Encode(CompressedData.GetData(), CompressedData.Num());
    
    // Also save to file for local reference
    FString ScreenshotDir = FPaths::ProjectSavedDir() / TEXT("Screenshots");
    IFileManager::Get().MakeDirectory(*ScreenshotDir, true);
    FString FullPath = ScreenshotDir / Filename + TEXT(".png");
    FFileHelper::SaveArrayToFile(CompressedData, *FullPath);
    
    // Return JSON with base64 data
    return FString::Printf(TEXT("{\"success\": true, \"filename\": \"%s\", \"width\": %d, \"height\": %d, \"file_path\": \"%s\", \"base64\": \"%s\"}"),
        *Filename, ResolutionX, ResolutionY, *FullPath, *Base64Data);
}

/*
ALTERNATIVE SIMPLER FIX:

If the above doesn't work or you want a simpler solution, you can modify the 
agent-source to read the file from disk after the screenshot is taken.

In the agent's mcp-client.js, after calling take_screenshot:
1. Parse the file path from the response
2. Wait 500ms for the file to be written
3. Read the file from disk
4. Convert to base64
5. Return the base64 data

This approach works because the agent runs on the same machine as UE5.
*/
