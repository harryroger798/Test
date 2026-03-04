#pragma once
#include "CoreMinimal.h"
#include "GameFramework/GameModeBase.h"
#include "ProceduralMeshComponent.h"
#include "Components/PointLightComponent.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/SkyLightComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/PostProcessVolume.h"
#include "Engine/SkyLight.h"
#include "Components/TextRenderComponent.h"
#include "Camera/CameraActor.h"
#include "Engine/Texture2D.h"
#include "EmersynGameMode.generated.h"

UENUM()
enum class ETexturePattern : uint8
{
    WoodGrain, TileGrid, Wallpaper, Carpet, Grass, Concrete,
    Brick, Marble, Metal, Fabric, Sand, Water
};

// v25: Sims-style lighting presets
UENUM()
enum class ELightingPreset : uint8
{
    Day, Sunset, Night, Morning, Party
};

UCLASS()
class EMERSYNUE5_API AEmersynGameMode : public AGameModeBase
{
    GENERATED_BODY()
public:
    AEmersynGameMode();
    virtual void InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage) override;
    virtual void BeginPlay() override;
    virtual void Tick(float DeltaTime) override;

    // Room management
    void LoadRoom(const FString& RoomName);
    void ClearRoom();
    FString CurrentRoom;
    TArray<AActor*> RoomActors;
    TArray<FString> RoomList;
    int32 RoomIndex;
    float RoomTimer;
    float RoomDuration;

    // Material
    UPROPERTY() UMaterial* M_VertexColor;
    UPROPERTY() UMaterialInstanceDynamic* DefaultMID;

    // Camera
    UPROPERTY() ACameraActor* IsoCam;
    FVector CamStartPos, CamTargetPos;
    FRotator CamStartRot, CamTargetRot;
    float CamMoveAlpha;
    bool bCameraMoving;

    // Texture cache
    TMap<FString, UTexture2D*> TextureCache;

    // Noise
    float SimpleNoise(float X, float Y) const;
    float FBMNoise(float X, float Y, int32 Octaves) const;

    // Procedural texture fill
    void FillWoodGrain(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Accent);
    void FillTileGrid(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Grout);
    void FillWallpaper(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Pattern);
    void FillCarpet(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Fiber);
    void FillGrass(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Tip);
    void FillConcrete(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Speckle);
    void FillBrick(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Mortar);
    void FillMarble(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Vein);
    void FillMetal(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Highlight);
    void FillFabric(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Thread);
    void FillSand(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Grain);
    void FillWater(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Highlight);

    UTexture2D* GenerateProceduralTexture(ETexturePattern Pattern, FLinearColor BaseColor, FLinearColor AccentColor, int32 Size);
    UMaterialInstanceDynamic* CreateTexturedMaterial(UTexture2D* Texture, float Roughness = 0.5f, float Metallic = 0.f);

    // v25: Enhanced lighting with Sims-style multi-bounce
    FLinearColor ApplyDirectionalShading(FLinearColor BaseColor, FVector Normal, float AO = 1.0f) const;
    FLinearColor ApplySimsLighting(FLinearColor BaseColor, FVector Normal, FVector WorldPos, float AO = 1.0f) const;

    // v25: Lighting preset system
    ELightingPreset CurrentLightPreset;
    FLinearColor LightKeyColor;
    FLinearColor LightFillColor;
    FLinearColor LightAmbientColor;
    float LightKeyIntensity;
    float LightFillIntensity;
    void SetLightingPreset(ELightingPreset Preset);

    // Spawn geometry
    AActor* SpawnTexturedFloor(FVector Center, FVector Size, ETexturePattern Pattern, FLinearColor Base, FLinearColor Accent, float UVScale = 1.f);
    AActor* SpawnTexturedWall(FVector Start, FVector End, float Height, ETexturePattern Pattern, FLinearColor Base, FLinearColor Accent);
    AActor* SpawnTexturedCeiling(FVector Center, FVector Size, FLinearColor Color);
    AActor* SpawnTexturedBox(FVector Loc, FVector Scale, ETexturePattern Pattern, FLinearColor Base, FLinearColor Accent);

    // v25: Enhanced geometry builders
    AActor* SpawnCylinder(FVector Loc, float Radius, float Height, int32 Sides, FLinearColor Color, float AO = 1.0f);
    AActor* SpawnSphere(FVector Loc, float Radius, int32 Segments, FLinearColor Color);
    AActor* SpawnBaseboard(FVector Start, FVector End, float Height, FLinearColor Color);
    AActor* SpawnCrownMolding(FVector Start, FVector End, float WallHeight, FLinearColor Color);
    AActor* SpawnWindowFrame(FVector WallStart, FVector WallEnd, float WallHeight, float WindowY, float WindowWidth, float WindowHeight, FLinearColor FrameColor, FLinearColor GlassColor);
    AActor* SpawnPictureFrame(FVector Location, FRotator Rotation, FVector Size, FLinearColor FrameColor, FLinearColor CanvasColor);

    // v25: Multi-part procedural furniture builders
    void SpawnDetailedBed(FVector Location, FLinearColor FrameColor, FLinearColor SheetColor, FLinearColor PillowColor, float Scale = 1.0f);
    void SpawnDetailedSofa(FVector Location, FRotator Rotation, FLinearColor FabricColor, FLinearColor CushionColor, FLinearColor LegColor, float Scale = 1.0f);
    void SpawnDetailedTable(FVector Location, FLinearColor TopColor, FLinearColor LegColor, float Scale = 1.0f);
    void SpawnDetailedChair(FVector Location, FRotator Rotation, FLinearColor SeatColor, FLinearColor LegColor, float Scale = 1.0f);
    void SpawnDetailedBookshelf(FVector Location, FRotator Rotation, FLinearColor ShelfColor, float Scale = 1.0f);
    void SpawnDetailedDresser(FVector Location, FLinearColor BodyColor, FLinearColor HandleColor, float Scale = 1.0f);
    void SpawnDetailedLamp(FVector Location, FLinearColor BaseColor, FLinearColor ShadeColor, float Scale = 1.0f);
    void SpawnDetailedRug(FVector Location, FLinearColor CenterColor, FLinearColor BorderColor, FVector Size);
    void SpawnDetailedTV(FVector Location, FRotator Rotation, FLinearColor FrameColor, float Scale = 1.0f);
    void SpawnDetailedFridge(FVector Location, FLinearColor BodyColor, FLinearColor HandleColor, float Scale = 1.0f);
    void SpawnDetailedStove(FVector Location, FLinearColor BodyColor, float Scale = 1.0f);
    void SpawnDetailedSink(FVector Location, FLinearColor BasinColor, FLinearColor FaucetColor, float Scale = 1.0f);
    void SpawnDetailedBathtub(FVector Location, FLinearColor TubColor, FLinearColor FeetColor, float Scale = 1.0f);
    void SpawnDetailedToilet(FVector Location, FRotator Rotation, FLinearColor Color, float Scale = 1.0f);
    void SpawnDetailedMirror(FVector Location, FRotator Rotation, FLinearColor FrameColor, float Scale = 1.0f);
    void SpawnDetailedPlant(FVector Location, FLinearColor PotColor, FLinearColor LeafColor, float Scale = 1.0f);
    void SpawnDetailedDesk(FVector Location, FRotator Rotation, FLinearColor TopColor, FLinearColor LegColor, float Scale = 1.0f);
    void SpawnDetailedSwing(FVector Location, FLinearColor FrameColor, FLinearColor SeatColor, float Scale = 1.0f);
    void SpawnDetailedSlide(FVector Location, FLinearColor SlideColor, FLinearColor LadderColor, float Scale = 1.0f);
    void SpawnDetailedFountain(FVector Location, FLinearColor StoneColor, FLinearColor WaterColor, float Scale = 1.0f);
    void SpawnDetailedBench(FVector Location, FRotator Rotation, FLinearColor WoodColor, FLinearColor MetalColor, float Scale = 1.0f);
    void SpawnDetailedCabinet(FVector Location, FLinearColor BodyColor, FLinearColor ScreenColor, float Scale = 1.0f);
    void SpawnDetailedCounter(FVector Location, FLinearColor TopColor, FLinearColor BaseColor, float Scale = 1.0f);
    void SpawnDetailedShelf(FVector Location, FRotator Rotation, FLinearColor Color, float Scale = 1.0f);
    void SpawnDetailedTree(FVector Location, FLinearColor TrunkColor, FLinearColor LeafColor, float Scale = 1.0f);

    // Sky
    void SpawnSky();

    // Mesh spawning (using MeshData headers)
    AActor* SpawnMesh(const float* Verts, const float* Norms, const float* UVData,
        const int32* Tris, int32 NumVerts, int32 NumTris,
        FVector Location, FRotator Rotation, FVector Scale,
        ETexturePattern Pattern, FLinearColor Base, FLinearColor Accent, float Brightness = 1.0f);
    AActor* SpawnMeshVC(const float* Verts, const float* Norms, const float* UVData,
        const int32* Tris, int32 NumVerts, int32 NumTris,
        FVector Location, FRotator Rotation, FVector Scale,
        const FLinearColor& Tint, float Brightness = 1.0f);
    AActor* SpawnCharacterMesh(const FString& Name, FVector Location, FRotator Rotation,
        float InScale, const FLinearColor& SkinTint, const FLinearColor& OutfitTint);

    // Lighting
    void SpawnLight(FVector Loc, float Intensity, FLinearColor Color, float Radius);
    void SpawnDirectionalLight(FRotator Rot, float Intensity, FLinearColor Color);
    void SpawnSkyLight(float Intensity);
    void SpawnRoomLighting(FVector RoomCenter, FVector RoomSize);

    // Post-processing
    void SetupPostProcessing();

    // Text and camera
    void SpawnWorldText(const FString& Text, FVector Location, float Size, FLinearColor Color);
    void SpawnRoomLabel(const FString& Label);
    void SetupIsometricCamera(FVector RoomCenter, float Distance);

    // v25: Room shell builder (cutaway walls - only back and side walls, like Sims)
    void BuildRoomShell(FVector RoomSize, ETexturePattern FloorPattern, FLinearColor FloorBase, FLinearColor FloorAccent,
        ETexturePattern WallPattern, FLinearColor WallBase, FLinearColor WallAccent, FLinearColor CeilingColor,
        ELightingPreset LightPreset, const FString& RoomLabel);

    // Room builders
    void BuildSplashScreen();
    void BuildMainMenu();
    void BuildBedroom();
    void BuildKitchen();
    void BuildBathroom();
    void BuildLivingRoom();
    void BuildGarden();
    void BuildSchool();
    void BuildShop();
    void BuildPlayground();
    void BuildPark();
    void BuildMall();
    void BuildArcade();
    void BuildAmusementPark();
};
