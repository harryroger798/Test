// v49: Ultra-short walls (15u), camera maxDim*4.0, FS 3.0. v48 proved steep camera works but walls still too dominant. Make walls barely-visible borders.
#include "EmersynGameMode.h"
#include "Engine/StaticMeshActor.h"
#include "Engine/DirectionalLight.h"
#include "Engine/PointLight.h"
#include "Components/DirectionalLightComponent.h"
#include "Components/PointLightComponent.h"
#include "Kismet/GameplayStatics.h"
#include "GameFramework/PlayerController.h"
#include "Camera/CameraActor.h"
#include "Camera/CameraComponent.h"
#include "Engine/World.h"
#include "GameFramework/DefaultPawn.h"
#include "Engine/PostProcessVolume.h"
#include "Engine/SkyLight.h"
#include "Components/SkyLightComponent.h"
#include "Components/PostProcessComponent.h"
#include "Components/TextRenderComponent.h"
#include "Materials/MaterialInstanceDynamic.h"
#include "Engine/Texture2D.h"
#include "TextureResource.h"
#include "GameFramework/TouchInterface.h"
#include "Engine/GameViewportClient.h"

// v25b: MeshData headers removed to fix mobile init crash (29MB binary too large)
// Using lightweight procedural geometry (SpawnDetailed* builders) instead

// ============================================================
// v25 SIMS-QUALITY COLOR PALETTE (60+ colors)
// ============================================================
namespace SC {
    // Wood tones
    const FLinearColor WoodLight(0.85f, 0.65f, 0.40f);
    const FLinearColor WoodMedium(0.62f, 0.38f, 0.15f);
    const FLinearColor WoodDark(0.38f, 0.20f, 0.07f);
    const FLinearColor WoodCherry(0.52f, 0.13f, 0.07f);
    const FLinearColor WoodOak(0.78f, 0.58f, 0.32f);
    const FLinearColor WoodMaple(0.90f, 0.72f, 0.45f);
    const FLinearColor WoodEbony(0.10f, 0.08f, 0.06f);
    const FLinearColor WoodWalnut(0.35f, 0.20f, 0.10f);

    // Fabric / upholstery
    const FLinearColor FabricPink(1.0f, 0.48f, 0.63f);
    const FLinearColor FabricHotPink(1.0f, 0.25f, 0.50f);
    const FLinearColor FabricBlue(0.28f, 0.52f, 0.95f);
    const FLinearColor FabricNavy(0.10f, 0.20f, 0.55f);
    const FLinearColor FabricGreen(0.22f, 0.82f, 0.42f);
    const FLinearColor FabricSage(0.48f, 0.68f, 0.45f);
    const FLinearColor FabricPurple(0.68f, 0.28f, 0.90f);
    const FLinearColor FabricLavender(0.75f, 0.60f, 0.95f);
    const FLinearColor FabricRed(0.95f, 0.12f, 0.12f);
    const FLinearColor FabricCoral(1.0f, 0.45f, 0.35f);
    const FLinearColor FabricYellow(1.0f, 0.92f, 0.22f);
    const FLinearColor FabricOrange(1.0f, 0.55f, 0.12f);
    const FLinearColor FabricCream(0.98f, 0.96f, 0.88f);
    const FLinearColor FabricTeal(0.15f, 0.72f, 0.70f);
    const FLinearColor FabricMint(0.62f, 0.95f, 0.80f);
    const FLinearColor FabricPeach(1.0f, 0.78f, 0.62f);

    // Metal tones
    const FLinearColor MetalSilver(0.80f, 0.80f, 0.82f);
    const FLinearColor MetalGold(0.88f, 0.78f, 0.42f);
    const FLinearColor MetalBlack(0.12f, 0.12f, 0.14f);
    const FLinearColor MetalBrass(0.82f, 0.68f, 0.28f);
    const FLinearColor MetalCopper(0.78f, 0.45f, 0.22f);
    const FLinearColor MetalChrome(0.90f, 0.92f, 0.95f);

    // Wall colors (v26: darker/more saturated to be visible against sky)
    const FLinearColor WallWhite(0.82f, 0.80f, 0.76f);
    const FLinearColor WallCream(0.78f, 0.72f, 0.62f);
    const FLinearColor WallPink(0.82f, 0.45f, 0.55f);
    const FLinearColor WallBlue(0.38f, 0.55f, 0.78f);
    const FLinearColor WallGreen(0.38f, 0.68f, 0.45f);
    const FLinearColor WallYellow(0.82f, 0.75f, 0.38f);
    const FLinearColor WallSage(0.52f, 0.62f, 0.48f);
    const FLinearColor WallLavender(0.62f, 0.55f, 0.78f);
    const FLinearColor WallPeach(0.82f, 0.62f, 0.48f);

    // Floor colors (v28: much darker to actually appear as wood, not white)
    const FLinearColor FloorWood(0.28f, 0.19f, 0.10f);
    const FLinearColor FloorTile(0.72f, 0.70f, 0.65f);
    const FLinearColor FloorGrass(0.15f, 0.55f, 0.15f);
    const FLinearColor FloorGrassDark(0.08f, 0.38f, 0.08f);
    const FLinearColor FloorSand(0.75f, 0.65f, 0.42f);
    const FLinearColor FloorConcrete(0.52f, 0.50f, 0.46f);
    const FLinearColor FloorMarble(0.78f, 0.75f, 0.72f);

    // Sky colors (v29: warmer, brighter sky like Sims Mobile outdoor feel)
    const FLinearColor SkyTopDay(0.40f, 0.58f, 0.85f);
    const FLinearColor SkyBotDay(0.65f, 0.78f, 0.92f);
    const FLinearColor SkyTopSunset(0.55f, 0.28f, 0.12f);
    const FLinearColor SkyBotSunset(0.65f, 0.48f, 0.32f);
    const FLinearColor SkyTopNight(0.03f, 0.03f, 0.12f);
    const FLinearColor SkyBotNight(0.08f, 0.08f, 0.18f);
    const FLinearColor SkyTopMorning(0.38f, 0.52f, 0.68f);
    const FLinearColor SkyBotMorning(0.62f, 0.58f, 0.48f);

    // Surface colors
    const FLinearColor CeilingWhite(0.72f, 0.70f, 0.66f);
    const FLinearColor TileWhite(0.95f, 0.95f, 0.92f);
    const FLinearColor TileBlue(0.58f, 0.78f, 0.95f);
    const FLinearColor TileMint(0.72f, 0.95f, 0.88f);
    const FLinearColor BrickRed(0.72f, 0.28f, 0.15f);
    const FLinearColor BrickMortar(0.85f, 0.82f, 0.75f);
    const FLinearColor MarbleWhite(0.96f, 0.94f, 0.90f);
    const FLinearColor MarbleVein(0.62f, 0.60f, 0.56f);
    const FLinearColor CarpetBeige(0.85f, 0.78f, 0.65f);
    const FLinearColor CarpetPurple(0.52f, 0.28f, 0.68f);
    const FLinearColor CarpetPink(0.95f, 0.68f, 0.78f);
    const FLinearColor WPStripe1(0.90f, 0.85f, 0.75f);
    const FLinearColor WPStripe2(0.80f, 0.70f, 0.55f);

    // Special
    const FLinearColor GlassBlue(0.68f, 0.85f, 0.98f, 0.6f);
    const FLinearColor PlantGreen(0.18f, 0.68f, 0.22f);
    const FLinearColor PlantDark(0.10f, 0.45f, 0.12f);
    const FLinearColor WaterBlue(0.22f, 0.62f, 0.95f);
    const FLinearColor WaterLight(0.58f, 0.85f, 1.0f);
}

// ============================================================
// CONSTRUCTOR
// ============================================================
AEmersynGameMode::AEmersynGameMode()
{
    PrimaryActorTick.bCanEverTick = true;
    DefaultPawnClass = nullptr;
    bCameraMoving = false;
    CamMoveAlpha = 0.f;
    IsoCam = nullptr;
    // Load M_VertexColor material at constructor/CDO time (UE5 requirement)
    static ConstructorHelpers::FObjectFinder<UMaterial> MatFinder(TEXT("/Game/Materials/M_VertexColor"));
    if (MatFinder.Succeeded()) { M_VertexColor = MatFinder.Object; }
    else { M_VertexColor = nullptr; }
    DefaultMID = nullptr;
    RoomIndex = 0;
    RoomTimer = 0.f;
    RoomDuration = 7.f;
    CurrentLightPreset = ELightingPreset::Day;
    LightKeyColor = FLinearColor(1.0f, 0.96f, 0.88f);
    LightFillColor = FLinearColor(0.62f, 0.72f, 0.88f);
    LightAmbientColor = FLinearColor(0.38f, 0.38f, 0.42f);
    LightKeyIntensity = 1.0f;
    LightFillIntensity = 0.38f;

    RoomList.Add(TEXT("Splash"));
    RoomList.Add(TEXT("Bedroom"));
    RoomList.Add(TEXT("Kitchen"));
    RoomList.Add(TEXT("Bathroom"));
    RoomList.Add(TEXT("LivingRoom"));
    RoomList.Add(TEXT("Garden"));
    RoomList.Add(TEXT("School"));
    RoomList.Add(TEXT("Shop"));
    RoomList.Add(TEXT("Playground"));
    RoomList.Add(TEXT("Park"));
    RoomList.Add(TEXT("Mall"));
    RoomList.Add(TEXT("Arcade"));
    RoomList.Add(TEXT("AmusementPark"));
}

// ============================================================
// INITGAME
// ============================================================
void AEmersynGameMode::InitGame(const FString& MapName, const FString& Options, FString& ErrorMessage)
{
    Super::InitGame(MapName, Options, ErrorMessage);
    // Material is now loaded in the constructor per UE5 API contract
}

// ============================================================
// BEGINPLAY
// ============================================================
void AEmersynGameMode::BeginPlay()
{
    Super::BeginPlay();
    APlayerController* PC = GetWorld()->GetFirstPlayerController();
    if (PC) {
        // v27: Fully disable ALL input AND hide virtual joystick overlays
        PC->SetIgnoreLookInput(true);
        PC->SetIgnoreMoveInput(true);
        PC->SetCinematicMode(true, false, false, true, true);
        // v27: Remove virtual joystick widgets completely
        PC->ActivateTouchInterface(nullptr);
        APawn* P = PC->GetPawn();
        if (P) {
            P->SetActorHiddenInGame(true);
            P->SetActorEnableCollision(false);
            P->DisableInput(PC);
        }
    }
    RoomIndex = 1;
    LoadRoom(RoomList[1]);
}

// ============================================================
// TICK
// ============================================================
void AEmersynGameMode::Tick(float DeltaSeconds)
{
    Super::Tick(DeltaSeconds);

    // v47: FORCE camera position + rotation + view target EVERY FRAME
    // v46 diagnostic proved camera works initially but fuzz test rotates it via pawn input
    if (IsoCam) {
        // v47: Force camera actor back to locked position every frame
        IsoCam->SetActorLocation(LockedCamPos);
        IsoCam->SetActorRotation(LockedCamRot);
        IsoCam->GetCameraComponent()->FieldOfView = LockedCamFOV;
        
        APlayerController* PC = GetWorld()->GetFirstPlayerController();
        if (PC) {
            // v47: Force view target every frame
            PC->SetViewTargetWithBlend(IsoCam, 0.f);
            PC->SetControlRotation(LockedCamRot);
            // v47: Re-disable input every frame (fuzz test may re-enable)
            PC->SetIgnoreLookInput(true);
            PC->SetIgnoreMoveInput(true);
            // v47: Also force pawn to stay disabled
            APawn* P = PC->GetPawn();
            if (P) {
                P->SetActorHiddenInGame(true);
                P->SetActorEnableCollision(false);
            }
        }
    }

    if (bCameraMoving && IsoCam) {
        CamMoveAlpha = FMath::Clamp(CamMoveAlpha + DeltaSeconds * 1.8f, 0.f, 1.f);
        float T = FMath::InterpEaseInOut(0.f, 1.f, CamMoveAlpha, 2.2f);
        IsoCam->SetActorLocation(FMath::Lerp(CamStartPos, CamTargetPos, T));
        IsoCam->SetActorRotation(FMath::Lerp(CamStartRot, CamTargetRot, T));
        if (CamMoveAlpha >= 1.f) bCameraMoving = false;
    }
    RoomTimer += DeltaSeconds;
    if (RoomTimer >= RoomDuration) {
        RoomTimer = 0.f;
        RoomIndex = (RoomIndex + 1) % RoomList.Num();
        LoadRoom(RoomList[RoomIndex]);
    }
}

// ============================================================
// LOAD / CLEAR ROOM
// ============================================================
void AEmersynGameMode::LoadRoom(const FString& RoomName)
{
    ClearRoom();
    CurrentRoom = RoomName;
    if (RoomName == TEXT("Splash"))       BuildSplashScreen();
    if (RoomName == TEXT("MainMenu"))     BuildMainMenu();
    if (RoomName == TEXT("Bedroom"))      BuildBedroom();
    if (RoomName == TEXT("Kitchen"))      BuildKitchen();
    if (RoomName == TEXT("Bathroom"))     BuildBathroom();
    if (RoomName == TEXT("LivingRoom"))   BuildLivingRoom();
    if (RoomName == TEXT("Garden"))       BuildGarden();
    if (RoomName == TEXT("School"))       BuildSchool();
    if (RoomName == TEXT("Shop"))         BuildShop();
    if (RoomName == TEXT("Playground"))   BuildPlayground();
    if (RoomName == TEXT("Park"))         BuildPark();
    if (RoomName == TEXT("Mall"))         BuildMall();
    if (RoomName == TEXT("Arcade"))       BuildArcade();
    if (RoomName == TEXT("AmusementPark"))BuildAmusementPark();
}

void AEmersynGameMode::ClearRoom()
{
    for (AActor* A : RoomActors) { if (A && A != IsoCam) A->Destroy(); }
    RoomActors.Empty();
}

// ============================================================
// v25: LIGHTING PRESET SYSTEM
// ============================================================
void AEmersynGameMode::SetLightingPreset(ELightingPreset Preset)
{
    CurrentLightPreset = Preset;
    switch (Preset) {
    case ELightingPreset::Day:
        // v26: Reduced intensity, warmer key, cooler fill (Sims-accurate)
        LightKeyColor     = FLinearColor(1.0f,  0.95f, 0.85f);
        LightFillColor    = FLinearColor(0.50f, 0.60f, 0.80f);
        LightAmbientColor = FLinearColor(0.22f, 0.23f, 0.28f);
        LightKeyIntensity = 0.70f;
        LightFillIntensity= 0.25f;
        break;
    case ELightingPreset::Sunset:
        LightKeyColor     = FLinearColor(1.0f,  0.60f, 0.25f);
        LightFillColor    = FLinearColor(0.70f, 0.40f, 0.55f);
        LightAmbientColor = FLinearColor(0.22f, 0.15f, 0.20f);
        LightKeyIntensity = 0.75f;
        LightFillIntensity= 0.30f;
        break;
    case ELightingPreset::Night:
        LightKeyColor     = FLinearColor(0.35f, 0.42f, 0.68f);
        LightFillColor    = FLinearColor(0.15f, 0.18f, 0.40f);
        LightAmbientColor = FLinearColor(0.08f, 0.10f, 0.16f);
        LightKeyIntensity = 0.45f;
        LightFillIntensity= 0.20f;
        break;
    case ELightingPreset::Morning:
        LightKeyColor     = FLinearColor(1.0f,  0.88f, 0.68f);
        LightFillColor    = FLinearColor(0.60f, 0.72f, 0.88f);
        LightAmbientColor = FLinearColor(0.25f, 0.28f, 0.32f);
        LightKeyIntensity = 0.65f;
        LightFillIntensity= 0.28f;
        break;
    case ELightingPreset::Party:
        LightKeyColor     = FLinearColor(0.85f, 0.25f, 0.65f);
        LightFillColor    = FLinearColor(0.25f, 0.65f, 0.85f);
        LightAmbientColor = FLinearColor(0.18f, 0.12f, 0.25f);
        LightKeyIntensity = 0.80f;
        LightFillIntensity= 0.35f;
        break;
    }
}

// ============================================================
// v25: ENHANCED SIMS-STYLE LIGHTING
// ============================================================
FLinearColor AEmersynGameMode::ApplyDirectionalShading(FLinearColor BaseColor, FVector Normal, float AO) const
{
    FVector KeyLightDir  = FVector(0.5f,  -0.3f, -0.7f).GetSafeNormal();
    FVector FillLightDir = FVector(-0.6f,  0.4f, -0.3f).GetSafeNormal();
    FVector RimLightDir  = FVector(0.0f,   0.8f, -0.2f).GetSafeNormal();
    float KeyDot  = FMath::Max(0.f, FVector::DotProduct(Normal, -KeyLightDir));
    float FillDot = FMath::Max(0.f, FVector::DotProduct(Normal, -FillLightDir));
    float RimDot  = FMath::Max(0.f, FVector::DotProduct(Normal, -RimLightDir));
    FLinearColor Ambient(0.35f, 0.35f, 0.40f);
    FLinearColor Lit = Ambient;
    Lit.R += BaseColor.R * KeyDot  * 0.80f * LightKeyColor.R;
    Lit.G += BaseColor.G * KeyDot  * 0.80f * LightKeyColor.G;
    Lit.B += BaseColor.B * KeyDot  * 0.80f * LightKeyColor.B;
    Lit.R += BaseColor.R * FillDot * 0.35f * LightFillColor.R;
    Lit.G += BaseColor.G * FillDot * 0.35f * LightFillColor.G;
    Lit.B += BaseColor.B * FillDot * 0.35f * LightFillColor.B;
    float RimPow = FMath::Pow(RimDot, 2.2f);
    Lit.R += RimPow * 0.12f;
    Lit.G += RimPow * 0.12f;
    Lit.B += RimPow * 0.14f;
    Lit.R *= AO; Lit.G *= AO; Lit.B *= AO; Lit.A = 1.0f;
    Lit.R = FMath::Clamp(Lit.R, 0.f, 1.f);
    Lit.G = FMath::Clamp(Lit.G, 0.f, 1.f);
    Lit.B = FMath::Clamp(Lit.B, 0.f, 1.f);
    return Lit;
}

FLinearColor AEmersynGameMode::ApplySimsLighting(FLinearColor BaseColor, FVector Normal, FVector WorldPos, float AO) const
{
    // v30: Improved lighting with depth cues (Bedrock #4)
    FVector KeyDir  = FVector(0.7f, 0.5f, 0.35f).GetSafeNormal();
    FVector FillDir = FVector(-0.5f, -0.3f, 0.2f).GetSafeNormal();

    float KeyDot   = FMath::Max(0.f, FVector::DotProduct(Normal, KeyDir));
    float FillDot  = FMath::Max(0.f, FVector::DotProduct(Normal, FillDir));
    float SkyDot   = FMath::Max(0.f, Normal.Z);
    float GroundDot= FMath::Max(0.f, -Normal.Z);

    KeyDot = FMath::Pow(KeyDot, 0.7f);
    FillDot = FMath::Pow(FillDot, 0.8f);

    bool bIsFloor = (Normal.Z > 0.8f);
    float SkyMult = bIsFloor ? 0.02f : 0.12f;
    float KeyMult = bIsFloor ? 0.3f : 1.0f;
    float FillMult = bIsFloor ? 0.15f : 1.0f;

    // v30: Enhanced vertical gradient AO (darker at floor level = depth)
    float HeightFactor = FMath::Clamp(WorldPos.Z / 200.f, 0.f, 1.f);
    float VerticalAO = FMath::Lerp(0.65f, 1.0f, HeightFactor);

    // v30: Corner darkening (fake AO - objects near room edges are darker)
    float DistFromCenter = FMath::Sqrt(WorldPos.X * WorldPos.X + WorldPos.Y * WorldPos.Y);
    float CornerAO = FMath::Clamp(1.0f - (DistFromCenter / 500.f) * 0.3f, 0.7f, 1.0f);

    // v30: Normal-based edge darkening (vertical edges slightly darker)
    float EdgeDarken = FMath::Abs(Normal.Z) < 0.1f ? 0.88f : 1.0f;

    float CombinedAO = AO * VerticalAO * CornerAO * EdgeDarken;

    // Floor edge darkening
    if (WorldPos.Z < 30.f && !bIsFloor) {
        CombinedAO *= FMath::Lerp(0.6f, 1.0f, WorldPos.Z / 30.f);
    }

    FLinearColor AccLight =
        (LightKeyColor * LightKeyIntensity * KeyDot * KeyMult) +
        (LightFillColor * LightFillIntensity * FillDot * FillMult) +
        (FLinearColor(0.35f, 0.40f, 0.48f) * SkyMult * SkyDot) +
        (FLinearColor(0.30f, 0.25f, 0.20f) * 0.06f * GroundDot);

    if (bIsFloor) {
        AccLight += LightAmbientColor * 0.4f;
    } else {
        AccLight += LightAmbientColor;
    }

    FLinearColor Lit;
    Lit.R = BaseColor.R * AccLight.R;
    Lit.G = BaseColor.G * AccLight.G;
    Lit.B = BaseColor.B * AccLight.B;

    // v30: Per-vertex color noise for visual richness (Bedrock #4)
    if (!bIsFloor) {
        uint32 Hash = (uint32)(FMath::Abs(WorldPos.X) * 73.f + FMath::Abs(WorldPos.Y) * 151.f + FMath::Abs(WorldPos.Z) * 283.f);
        float ColorNoise = 0.95f + (float)(Hash % 100) / 1000.f;
        Lit.R *= ColorNoise;
        Lit.G *= ColorNoise;
        Lit.B *= ColorNoise;
    }

    // Saturation boost for non-floor surfaces
    if (!bIsFloor) {
        float Lum = Lit.R * 0.299f + Lit.G * 0.587f + Lit.B * 0.114f;
        Lit.R = FMath::Lerp(Lum, Lit.R, 1.4f);
        Lit.G = FMath::Lerp(Lum, Lit.G, 1.4f);
        Lit.B = FMath::Lerp(Lum, Lit.B, 1.4f);
    }

    // Rim highlight (very subtle)
    FVector ViewDir = FVector(-0.5f, -0.5f, 0.3f).GetSafeNormal();
    float RimDot = FMath::Pow(FMath::Max(0.f, 1.f - FVector::DotProduct(Normal, -ViewDir)), 3.0f);
    Lit.R += RimDot * 0.03f * LightKeyColor.R;
    Lit.G += RimDot * 0.03f * LightKeyColor.G;
    Lit.B += RimDot * 0.03f * LightKeyColor.B;

    // v30: Apply combined AO (vertical + corner + edge)
    Lit.R *= CombinedAO;
    Lit.G *= CombinedAO;
    Lit.B *= CombinedAO;
    Lit.A = 1.0f;

    // v28: Aggressive gamma darken — floors get pow(1.8), furniture gets pow(1.15)
    float GammaPow = bIsFloor ? 1.8f : 1.15f;
    Lit.R = FMath::Pow(FMath::Clamp(Lit.R, 0.f, 1.f), GammaPow);
    Lit.G = FMath::Pow(FMath::Clamp(Lit.G, 0.f, 1.f), GammaPow);
    Lit.B = FMath::Pow(FMath::Clamp(Lit.B, 0.f, 1.f), GammaPow);

    // v28: Extra floor brightness cut
    if (bIsFloor) {
        Lit.R *= 0.5f;
        Lit.G *= 0.5f;
        Lit.B *= 0.5f;
    }
    return Lit;
}

// ============================================================
// NOISE FUNCTIONS
// ============================================================
float AEmersynGameMode::SimpleNoise(float X, float Y) const
{
    int32 IX = FMath::FloorToInt(X) & 255;
    int32 IY = FMath::FloorToInt(Y) & 255;
    float FX = X - FMath::FloorToFloat(X);
    float FY = Y - FMath::FloorToFloat(Y);
    float U = FX * FX * (3.f - 2.f * FX);
    float V = FY * FY * (3.f - 2.f * FY);
    int32 A = (IX * 127 + IY * 311 + 12345) & 255;
    int32 B = ((IX+1) * 127 + IY * 311 + 12345) & 255;
    int32 C = (IX * 127 + (IY+1) * 311 + 12345) & 255;
    int32 D = ((IX+1) * 127 + (IY+1) * 311 + 12345) & 255;
    float FA = (float)(A & 127) / 127.f;
    float FB = (float)(B & 127) / 127.f;
    float FC = (float)(C & 127) / 127.f;
    float FD = (float)(D & 127) / 127.f;
    return FMath::Lerp(FMath::Lerp(FA, FB, U), FMath::Lerp(FC, FD, U), V);
}

float AEmersynGameMode::FBMNoise(float X, float Y, int32 Octaves) const
{
    float Val = 0.f, Amp = 1.f, Freq = 1.f, MaxVal = 0.f;
    for (int32 I = 0; I < Octaves; I++) {
        Val += SimpleNoise(X * Freq, Y * Freq) * Amp;
        MaxVal += Amp; Amp *= 0.5f; Freq *= 2.f;
    }
    return Val / MaxVal;
}

// ============================================================
// TEXTURE FILL FUNCTIONS
// ============================================================
void AEmersynGameMode::FillWoodGrain(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Accent)
{
    for (int32 Y = 0; Y < H; Y++) {
        for (int32 X = 0; X < W; X++) {
            float N = FBMNoise(X * 0.03f, Y * 0.15f, 4);
            float Ring = FMath::Sin(N * 25.f + Y * 0.08f) * 0.5f + 0.5f;
            FLinearColor C = FMath::Lerp(Base, Accent, Ring * 0.6f);
            float Detail = SimpleNoise(X * 0.5f, Y * 0.5f) * 0.08f;
            C.R = FMath::Clamp(C.R + Detail, 0.f, 1.f);
            C.G = FMath::Clamp(C.G + Detail, 0.f, 1.f);
            C.B = FMath::Clamp(C.B + Detail, 0.f, 1.f);
            P[Y * W + X] = C.ToFColor(true);
        }
    }
}

void AEmersynGameMode::FillTileGrid(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Grout)
{
    int32 TS = 32, GW = 2;
    for (int32 Y = 0; Y < H; Y++) {
        for (int32 X = 0; X < W; X++) {
            bool bG = ((X % TS) < GW || (Y % TS) < GW);
            FLinearColor C = bG ? Grout : Base;
            if (!bG) { float N = SimpleNoise(X * 0.2f, Y * 0.2f) * 0.06f; C.R = FMath::Clamp(C.R + N, 0.f, 1.f); C.G = FMath::Clamp(C.G + N, 0.f, 1.f); C.B = FMath::Clamp(C.B + N, 0.f, 1.f); }
            P[Y * W + X] = C.ToFColor(true);
        }
    }
}

void AEmersynGameMode::FillWallpaper(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Pattern)
{
    for (int32 Y = 0; Y < H; Y++) {
        for (int32 X = 0; X < W; X++) {
            int32 SX = (X / 16) % 2;
            FLinearColor C = (SX == 0) ? Base : FMath::Lerp(Base, Pattern, 0.35f);
            float N = SimpleNoise(X * 0.1f, Y * 0.1f) * 0.03f;
            C.R = FMath::Clamp(C.R + N, 0.f, 1.f); C.G = FMath::Clamp(C.G + N, 0.f, 1.f); C.B = FMath::Clamp(C.B + N, 0.f, 1.f);
            P[Y * W + X] = C.ToFColor(true);
        }
    }
}

void AEmersynGameMode::FillCarpet(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Fiber)
{
    for (int32 Y = 0; Y < H; Y++) {
        for (int32 X = 0; X < W; X++) {
            float N1 = FBMNoise(X * 0.08f, Y * 0.08f, 3);
            float N2 = SimpleNoise(X * 2.f, Y * 2.f) * 0.15f;
            P[Y * W + X] = FMath::Lerp(Base, Fiber, N1 * 0.4f + N2).ToFColor(true);
        }
    }
}

void AEmersynGameMode::FillGrass(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Tip)
{
    for (int32 Y = 0; Y < H; Y++) {
        for (int32 X = 0; X < W; X++) {
            float N = FBMNoise(X * 0.06f, Y * 0.06f, 4);
            float Blade = FMath::Abs(FMath::Sin(X * 0.8f + N * 5.f));
            FLinearColor C = FMath::Lerp(Base, Tip, Blade * 0.5f + N * 0.3f);
            float D = SimpleNoise(X * 1.5f, Y * 1.5f) * 0.1f;
            C.R = FMath::Clamp(C.R + D - 0.05f, 0.f, 1.f); C.G = FMath::Clamp(C.G + D, 0.f, 1.f); C.B = FMath::Clamp(C.B + D - 0.05f, 0.f, 1.f);
            P[Y * W + X] = C.ToFColor(true);
        }
    }
}

void AEmersynGameMode::FillConcrete(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Speckle)
{
    for (int32 Y = 0; Y < H; Y++) {
        for (int32 X = 0; X < W; X++) {
            float N = FBMNoise(X * 0.04f, Y * 0.04f, 3);
            float S = SimpleNoise(X * 3.f, Y * 3.f);
            FLinearColor C = FMath::Lerp(Base, Speckle, N * 0.3f);
            if (S > 0.85f) C = FMath::Lerp(C, Speckle, 0.4f);
            P[Y * W + X] = C.ToFColor(true);
        }
    }
}

void AEmersynGameMode::FillBrick(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Mortar)
{
    int32 BW = 32, BH = 16, MW = 2;
    for (int32 Y = 0; Y < H; Y++) {
        for (int32 X = 0; X < W; X++) {
            int32 Row = Y / BH;
            int32 BX = (X + ((Row % 2 == 0) ? 0 : BW / 2)) % BW;
            bool bM = (BX < MW || (Y % BH) < MW);
            FLinearColor C = bM ? Mortar : Base;
            if (!bM) { float N = SimpleNoise(X * 0.15f, Y * 0.15f) * 0.1f; C.R = FMath::Clamp(C.R + N, 0.f, 1.f); C.G = FMath::Clamp(C.G + N * 0.5f, 0.f, 1.f); }
            P[Y * W + X] = C.ToFColor(true);
        }
    }
}

void AEmersynGameMode::FillMarble(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Vein)
{
    for (int32 Y = 0; Y < H; Y++) {
        for (int32 X = 0; X < W; X++) {
            float N = FBMNoise(X * 0.02f, Y * 0.02f, 5);
            float VF = FMath::Pow(FMath::Abs(FMath::Sin((X + Y) * 0.03f + N * 8.f)), 3.0f);
            FLinearColor C = FMath::Lerp(Base, Vein, VF * 0.6f);
            float Sh = SimpleNoise(X * 0.3f, Y * 0.3f) * 0.04f;
            C.R = FMath::Clamp(C.R + Sh, 0.f, 1.f); C.G = FMath::Clamp(C.G + Sh, 0.f, 1.f); C.B = FMath::Clamp(C.B + Sh, 0.f, 1.f);
            P[Y * W + X] = C.ToFColor(true);
        }
    }
}

void AEmersynGameMode::FillMetal(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Highlight)
{
    for (int32 Y = 0; Y < H; Y++) {
        for (int32 X = 0; X < W; X++) {
            float N = SimpleNoise(X * 0.5f, Y * 0.01f) * 0.15f;
            float Brush = FMath::Abs(FMath::Sin(Y * 0.3f + N * 10.f));
            P[Y * W + X] = FMath::Lerp(Base, Highlight, Brush * 0.3f + N).ToFColor(true);
        }
    }
}

void AEmersynGameMode::FillFabric(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Thread)
{
    for (int32 Y = 0; Y < H; Y++) {
        for (int32 X = 0; X < W; X++) {
            bool bT = ((X + Y) % 3 == 0) || ((X - Y + 256) % 5 == 0);
            float N = SimpleNoise(X * 0.3f, Y * 0.3f) * 0.08f;
            FLinearColor C = bT ? FMath::Lerp(Base, Thread, 0.3f) : Base;
            C.R = FMath::Clamp(C.R + N, 0.f, 1.f); C.G = FMath::Clamp(C.G + N, 0.f, 1.f); C.B = FMath::Clamp(C.B + N, 0.f, 1.f);
            P[Y * W + X] = C.ToFColor(true);
        }
    }
}

void AEmersynGameMode::FillSand(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Grain)
{
    for (int32 Y = 0; Y < H; Y++) {
        for (int32 X = 0; X < W; X++) {
            float N = FBMNoise(X * 0.05f, Y * 0.05f, 3);
            float G = SimpleNoise(X * 4.f, Y * 4.f);
            FLinearColor C = FMath::Lerp(Base, Grain, N * 0.25f);
            if (G > 0.7f) C = FMath::Lerp(C, Grain, 0.2f);
            P[Y * W + X] = C.ToFColor(true);
        }
    }
}

void AEmersynGameMode::FillWater(TArray<FColor>& P, int32 W, int32 H, FLinearColor Base, FLinearColor Highlight)
{
    for (int32 Y = 0; Y < H; Y++) {
        for (int32 X = 0; X < W; X++) {
            float N = FBMNoise(X * 0.03f, Y * 0.03f, 4);
            float Wave = FMath::Sin(X * 0.1f + N * 6.f) * 0.5f + 0.5f;
            FLinearColor C = FMath::Lerp(Base, Highlight, Wave * 0.3f);
            float Sp = SimpleNoise(X * 2.f, Y * 2.f);
            if (Sp > 0.92f) C = FMath::Lerp(C, FLinearColor::White, 0.5f);
            P[Y * W + X] = C.ToFColor(true);
        }
    }
}

// ============================================================
// GENERATE PROCEDURAL TEXTURE
// ============================================================
UTexture2D* AEmersynGameMode::GenerateProceduralTexture(ETexturePattern Pattern, FLinearColor BaseColor, FLinearColor AccentColor, int32 Size)
{
    FString Key = FString::Printf(TEXT("%d_%f_%f_%f_%f_%f_%f_%d"), (int)Pattern, BaseColor.R, BaseColor.G, BaseColor.B, AccentColor.R, AccentColor.G, AccentColor.B, Size);
    if (TObjectPtr<UTexture2D>* Found = TextureCache.Find(Key)) return *Found;
    TArray<FColor> Pixels; Pixels.SetNum(Size * Size);
    switch (Pattern) {
    case ETexturePattern::WoodGrain: FillWoodGrain(Pixels, Size, Size, BaseColor, AccentColor); break;
    case ETexturePattern::TileGrid: FillTileGrid(Pixels, Size, Size, BaseColor, AccentColor); break;
    case ETexturePattern::Wallpaper: FillWallpaper(Pixels, Size, Size, BaseColor, AccentColor); break;
    case ETexturePattern::Carpet: FillCarpet(Pixels, Size, Size, BaseColor, AccentColor); break;
    case ETexturePattern::Grass: FillGrass(Pixels, Size, Size, BaseColor, AccentColor); break;
    case ETexturePattern::Concrete: FillConcrete(Pixels, Size, Size, BaseColor, AccentColor); break;
    case ETexturePattern::Brick: FillBrick(Pixels, Size, Size, BaseColor, AccentColor); break;
    case ETexturePattern::Marble: FillMarble(Pixels, Size, Size, BaseColor, AccentColor); break;
    case ETexturePattern::Metal: FillMetal(Pixels, Size, Size, BaseColor, AccentColor); break;
    case ETexturePattern::Fabric: FillFabric(Pixels, Size, Size, BaseColor, AccentColor); break;
    case ETexturePattern::Sand: FillSand(Pixels, Size, Size, BaseColor, AccentColor); break;
    case ETexturePattern::Water: FillWater(Pixels, Size, Size, BaseColor, AccentColor); break;
    }
    UTexture2D* Tex = UTexture2D::CreateTransient(Size, Size, PF_B8G8R8A8);
    if (!Tex) return nullptr;
    void* Data = Tex->GetPlatformData()->Mips[0].BulkData.Lock(LOCK_READ_WRITE);
    FMemory::Memcpy(Data, Pixels.GetData(), Pixels.Num() * sizeof(FColor));
    Tex->GetPlatformData()->Mips[0].BulkData.Unlock();
    Tex->Filter = TF_Bilinear; Tex->SRGB = true; Tex->UpdateResource();
    TextureCache.Add(Key, Tex);
    return Tex;
}

UMaterialInstanceDynamic* AEmersynGameMode::CreateTexturedMaterial(UTexture2D* Texture, float Roughness, float Metallic)
{
    if (!M_VertexColor) return nullptr;
    return UMaterialInstanceDynamic::Create(M_VertexColor, this);
}

// ============================================================
// TEXTURED FLOOR (with Sims lighting)
// ============================================================
AActor* AEmersynGameMode::SpawnTexturedFloor(FVector Center, FVector Size, ETexturePattern Pattern, FLinearColor Base, FLinearColor Accent, float UVScale)
{
    AActor* A = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FTransform(Center));
    if (!A) return nullptr;
    A->SetRootComponent(NewObject<USceneComponent>(A));
    A->GetRootComponent()->RegisterComponent();
    UProceduralMeshComponent* PMC = NewObject<UProceduralMeshComponent>(A);
    PMC->SetupAttachment(A->GetRootComponent());
    PMC->RegisterComponent();
    float HX = Size.X, HY = Size.Y;
    int32 GR = 32;
    TArray<FVector> V; TArray<int32> T; TArray<FColor> C;
    TArray<FVector> N; TArray<FVector2D> UV; TArray<FProcMeshTangent> Tan;
    for (int32 GY = 0; GY <= GR; GY++) {
        for (int32 GX = 0; GX <= GR; GX++) {
            float FX = (float)GX / GR, FY = (float)GY / GR;
            FVector Pos(FX * HX * 2 - HX, FY * HY * 2 - HY, 0);
            V.Add(Pos); N.Add(FVector(0, 0, 1));
            UV.Add(FVector2D(FX * UVScale, FY * UVScale));
            Tan.Add(FProcMeshTangent(1, 0, 0));
            float NV = FBMNoise(FX * 6.f * UVScale, FY * 6.f * UVScale, 4);
            FLinearColor FC = FMath::Lerp(Base, Accent, NV * 0.65f + 0.18f);
            FLinearColor Lit = ApplySimsLighting(FC, FVector(0, 0, 1), Center + Pos, 1.0f);
            C.Add(Lit.ToFColor(true));
        }
    }
    for (int32 GY = 0; GY < GR; GY++) {
        for (int32 GX = 0; GX < GR; GX++) {
            int32 I = GY * (GR + 1) + GX;
            T.Add(I); T.Add(I + GR + 1); T.Add(I + 1);
            T.Add(I + 1); T.Add(I + GR + 1); T.Add(I + GR + 2);
        }
    }
    PMC->CreateMeshSection(0, V, T, N, UV, C, Tan, false);
    if (M_VertexColor) { PMC->SetMaterial(0, UMaterialInstanceDynamic::Create(M_VertexColor, this)); }
    PMC->SetCastShadow(true);
    RoomActors.Add(A);
    return A;
}

// ============================================================
// TEXTURED WALL (with Sims lighting)
// ============================================================
AActor* AEmersynGameMode::SpawnTexturedWall(FVector Start, FVector End, float Height, ETexturePattern Pattern, FLinearColor Base, FLinearColor Accent)
{
    AActor* A = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FTransform(Start));
    if (!A) return nullptr;
    A->SetRootComponent(NewObject<USceneComponent>(A));
    A->GetRootComponent()->RegisterComponent();
    UProceduralMeshComponent* PMC = NewObject<UProceduralMeshComponent>(A);
    PMC->SetupAttachment(A->GetRootComponent());
    PMC->RegisterComponent();
    FVector Dir = End - Start; float WL = Dir.Size(); Dir.Normalize();
    FVector Normal = FVector::CrossProduct(Dir, FVector::UpVector).GetSafeNormal();
    int32 SX = 24, SY = 16;
    TArray<FVector> V; TArray<int32> T; TArray<FColor> C;
    TArray<FVector> N; TArray<FVector2D> UV; TArray<FProcMeshTangent> Tan;
    for (int32 IY = 0; IY <= SY; IY++) {
        for (int32 IX = 0; IX <= SX; IX++) {
            float FX = (float)IX / SX, FY = (float)IY / SY;
            FVector Pos = Start + Dir * (FX * WL) + FVector(0, 0, FY * Height);
            V.Add(Pos - Start); N.Add(Normal);
            UV.Add(FVector2D(FX * WL / 100.f, FY * Height / 100.f));
            Tan.Add(FProcMeshTangent(Dir.X, Dir.Y, Dir.Z));
            float NV = FBMNoise(FX * 12.f, FY * 8.f, 3);
            int32 Row = (int32)(FY * 16.f);
            FLinearColor WC;
            if (Pattern == ETexturePattern::Brick) {
                float BX = FX * 24.f + ((Row % 2 == 0) ? 0.f : 0.5f);
                bool bM = (FMath::Frac(BX / 2.f) < 0.08f) || (FMath::Frac(FY * 16.f) < 0.12f);
                WC = bM ? Accent : Base;
                WC.R = FMath::Clamp(WC.R + NV * 0.08f, 0.f, 1.f);
            } else if (Pattern == ETexturePattern::TileGrid) {
                int32 TX = ((int32)(FX * 32.f)) % 4, TY = ((int32)(FY * 16.f)) % 4;
                WC = (TX == 0 || TY == 0) ? Accent : Base;
                WC.R = FMath::Clamp(WC.R + NV * 0.04f, 0.f, 1.f);
                WC.G = FMath::Clamp(WC.G + NV * 0.04f, 0.f, 1.f);
                WC.B = FMath::Clamp(WC.B + NV * 0.04f, 0.f, 1.f);
            } else {
                WC = FMath::Lerp(Base, Accent, NV * 0.3f);
            }
            // Height-based AO: darker at bottom
            float WAO = FMath::Clamp(0.82f + FY * 0.18f, 0.75f, 1.0f);
            FLinearColor Lit = ApplySimsLighting(WC, Normal, Pos, WAO);
            C.Add(Lit.ToFColor(true));
        }
    }
    for (int32 IY = 0; IY < SY; IY++) {
        for (int32 IX = 0; IX < SX; IX++) {
            int32 I = IY * (SX + 1) + IX;
            T.Add(I); T.Add(I + SX + 1); T.Add(I + 1);
            T.Add(I + 1); T.Add(I + SX + 1); T.Add(I + SX + 2);
        }
    }
    PMC->CreateMeshSection(0, V, T, N, UV, C, Tan, false);
    if (M_VertexColor) { PMC->SetMaterial(0, UMaterialInstanceDynamic::Create(M_VertexColor, this)); }
    PMC->SetCastShadow(true);
    RoomActors.Add(A);
    return A;
}

// ============================================================
// TEXTURED CEILING / TEXTURED BOX
// ============================================================
AActor* AEmersynGameMode::SpawnTexturedCeiling(FVector Center, FVector Size, FLinearColor Color)
{
    return SpawnTexturedFloor(Center, Size, ETexturePattern::Concrete, Color, Color * 0.95f, 1.0f);
}

AActor* AEmersynGameMode::SpawnTexturedBox(FVector Loc, FVector Scale, ETexturePattern Pattern, FLinearColor Base, FLinearColor Accent)
{
    AActor* A = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FTransform(Loc));
    if (!A) return nullptr;
    A->SetRootComponent(NewObject<USceneComponent>(A));
    A->GetRootComponent()->RegisterComponent();
    UProceduralMeshComponent* PMC = NewObject<UProceduralMeshComponent>(A);
    PMC->SetupAttachment(A->GetRootComponent());
    PMC->RegisterComponent();
    FVector HE = Scale;
    TArray<FVector> V; TArray<int32> T; TArray<FColor> C;
    TArray<FVector> N; TArray<FVector2D> UV; TArray<FProcMeshTangent> Tan;
    auto AddFace = [&](FVector P0, FVector P1, FVector P2, FVector P3, FVector Norm) {
        int32 BI = V.Num();
        V.Add(P0); V.Add(P1); V.Add(P2); V.Add(P3);
        N.Add(Norm); N.Add(Norm); N.Add(Norm); N.Add(Norm);
        UV.Add(FVector2D(0,0)); UV.Add(FVector2D(1,0)); UV.Add(FVector2D(1,1)); UV.Add(FVector2D(0,1));
        Tan.Add(FProcMeshTangent(1,0,0)); Tan.Add(FProcMeshTangent(1,0,0)); Tan.Add(FProcMeshTangent(1,0,0)); Tan.Add(FProcMeshTangent(1,0,0));
        for (int32 I = 0; I < 4; I++) {
            FVector WP = Loc + V[BI + I];
            float NV = SimpleNoise(WP.X * 0.02f, WP.Y * 0.02f) * 0.15f;
            FLinearColor FC = FMath::Lerp(Base, Accent, 0.3f + NV);
            FLinearColor Lit = ApplySimsLighting(FC, Norm, WP, 0.9f);
            C.Add(Lit.ToFColor(true));
        }
        T.Add(BI); T.Add(BI+1); T.Add(BI+2);
        T.Add(BI); T.Add(BI+2); T.Add(BI+3);
    };
    AddFace(FVector(-HE.X,-HE.Y,-HE.Z), FVector(HE.X,-HE.Y,-HE.Z), FVector(HE.X,-HE.Y,HE.Z), FVector(-HE.X,-HE.Y,HE.Z), FVector(0,-1,0));
    AddFace(FVector(HE.X,HE.Y,-HE.Z), FVector(-HE.X,HE.Y,-HE.Z), FVector(-HE.X,HE.Y,HE.Z), FVector(HE.X,HE.Y,HE.Z), FVector(0,1,0));
    AddFace(FVector(-HE.X,HE.Y,-HE.Z), FVector(-HE.X,-HE.Y,-HE.Z), FVector(-HE.X,-HE.Y,HE.Z), FVector(-HE.X,HE.Y,HE.Z), FVector(-1,0,0));
    AddFace(FVector(HE.X,-HE.Y,-HE.Z), FVector(HE.X,HE.Y,-HE.Z), FVector(HE.X,HE.Y,HE.Z), FVector(HE.X,-HE.Y,HE.Z), FVector(1,0,0));
    AddFace(FVector(-HE.X,-HE.Y,HE.Z), FVector(HE.X,-HE.Y,HE.Z), FVector(HE.X,HE.Y,HE.Z), FVector(-HE.X,HE.Y,HE.Z), FVector(0,0,1));
    AddFace(FVector(-HE.X,HE.Y,-HE.Z), FVector(HE.X,HE.Y,-HE.Z), FVector(HE.X,-HE.Y,-HE.Z), FVector(-HE.X,-HE.Y,-HE.Z), FVector(0,0,-1));
    PMC->CreateMeshSection(0, V, T, N, UV, C, Tan, false);
    if (M_VertexColor) { PMC->SetMaterial(0, UMaterialInstanceDynamic::Create(M_VertexColor, this)); }
    PMC->SetCastShadow(true);
    RoomActors.Add(A);
    return A;
}

// ============================================================
// v25: CYLINDER (for lamp bases, table legs, etc)
// ============================================================
AActor* AEmersynGameMode::SpawnCylinder(FVector Loc, float Radius, float Height, int32 Sides, FLinearColor Color, float AO)
{
    AActor* A = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FTransform(Loc));
    if (!A) return nullptr;
    A->SetRootComponent(NewObject<USceneComponent>(A));
    A->GetRootComponent()->RegisterComponent();
    UProceduralMeshComponent* PMC = NewObject<UProceduralMeshComponent>(A);
    PMC->SetupAttachment(A->GetRootComponent());
    PMC->RegisterComponent();
    TArray<FVector> V; TArray<int32> T; TArray<FColor> C;
    TArray<FVector> N; TArray<FVector2D> UV; TArray<FProcMeshTangent> Tan;
    // Side faces
    for (int32 I = 0; I <= Sides; I++) {
        float Angle = 2.f * PI * I / Sides;
        float CX = FMath::Cos(Angle) * Radius;
        float CY = FMath::Sin(Angle) * Radius;
        FVector Norm(FMath::Cos(Angle), FMath::Sin(Angle), 0);
        // Bottom vertex
        V.Add(FVector(CX, CY, 0)); N.Add(Norm);
        UV.Add(FVector2D((float)I / Sides, 0)); Tan.Add(FProcMeshTangent(0, 0, 1));
        FLinearColor LitBot = ApplySimsLighting(Color, Norm, Loc + FVector(CX, CY, 0), AO * 0.85f);
        C.Add(LitBot.ToFColor(true));
        // Top vertex
        V.Add(FVector(CX, CY, Height)); N.Add(Norm);
        UV.Add(FVector2D((float)I / Sides, 1)); Tan.Add(FProcMeshTangent(0, 0, 1));
        FLinearColor LitTop = ApplySimsLighting(Color, Norm, Loc + FVector(CX, CY, Height), AO);
        C.Add(LitTop.ToFColor(true));
    }
    for (int32 I = 0; I < Sides; I++) {
        int32 B = I * 2;
        T.Add(B); T.Add(B + 2); T.Add(B + 1);
        T.Add(B + 1); T.Add(B + 2); T.Add(B + 3);
    }
    // Top cap
    int32 TopCenter = V.Num();
    V.Add(FVector(0, 0, Height)); N.Add(FVector(0, 0, 1));
    UV.Add(FVector2D(0.5f, 0.5f)); Tan.Add(FProcMeshTangent(1, 0, 0));
    FLinearColor TopLit = ApplySimsLighting(Color, FVector(0, 0, 1), Loc + FVector(0, 0, Height), AO);
    C.Add(TopLit.ToFColor(true));
    for (int32 I = 0; I < Sides; I++) {
        int32 Cur = I * 2 + 1, Next = ((I + 1) % (Sides + 1)) * 2 + 1;
        T.Add(TopCenter); T.Add(Cur); T.Add(Next);
    }
    PMC->CreateMeshSection(0, V, T, N, UV, C, Tan, false);
    if (M_VertexColor) { PMC->SetMaterial(0, UMaterialInstanceDynamic::Create(M_VertexColor, this)); }
    RoomActors.Add(A);
    return A;
}

// ============================================================
// v25: SPHERE (for decorative items)
// ============================================================
AActor* AEmersynGameMode::SpawnSphere(FVector Loc, float Radius, int32 Seg, FLinearColor Color)
{
    AActor* A = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FTransform(Loc));
    if (!A) return nullptr;
    A->SetRootComponent(NewObject<USceneComponent>(A));
    A->GetRootComponent()->RegisterComponent();
    UProceduralMeshComponent* PMC = NewObject<UProceduralMeshComponent>(A);
    PMC->SetupAttachment(A->GetRootComponent());
    PMC->RegisterComponent();
    TArray<FVector> V; TArray<int32> T; TArray<FColor> C;
    TArray<FVector> N; TArray<FVector2D> UV; TArray<FProcMeshTangent> Tan;
    for (int32 Lat = 0; Lat <= Seg; Lat++) {
        float Phi = PI * Lat / Seg;
        for (int32 Lon = 0; Lon <= Seg; Lon++) {
            float Theta = 2.f * PI * Lon / Seg;
            FVector P(Radius * FMath::Sin(Phi) * FMath::Cos(Theta), Radius * FMath::Sin(Phi) * FMath::Sin(Theta), Radius * FMath::Cos(Phi));
            FVector Norm = P.GetSafeNormal();
            V.Add(P); N.Add(Norm);
            UV.Add(FVector2D((float)Lon / Seg, (float)Lat / Seg));
            Tan.Add(FProcMeshTangent(1, 0, 0));
            FLinearColor Lit = ApplySimsLighting(Color, Norm, Loc + P, 0.95f);
            C.Add(Lit.ToFColor(true));
        }
    }
    for (int32 Lat = 0; Lat < Seg; Lat++) {
        for (int32 Lon = 0; Lon < Seg; Lon++) {
            int32 Cur = Lat * (Seg + 1) + Lon;
            T.Add(Cur); T.Add(Cur + Seg + 1); T.Add(Cur + 1);
            T.Add(Cur + 1); T.Add(Cur + Seg + 1); T.Add(Cur + Seg + 2);
        }
    }
    PMC->CreateMeshSection(0, V, T, N, UV, C, Tan, false);
    if (M_VertexColor) { PMC->SetMaterial(0, UMaterialInstanceDynamic::Create(M_VertexColor, this)); }
    RoomActors.Add(A);
    return A;
}

// ============================================================
// v25: BASEBOARD & CROWN MOLDING
// ============================================================
AActor* AEmersynGameMode::SpawnBaseboard(FVector Start, FVector End, float Height, FLinearColor Color)
{
    FVector Mid = (Start + End) * 0.5f + FVector(0, 0, Height * 0.5f);
    FVector Dir = End - Start; float Len = Dir.Size();
    FVector HE(Len * 0.5f, 3.f, Height * 0.5f);
    return SpawnTexturedBox(Mid, HE, ETexturePattern::WoodGrain, Color, Color * 0.9f);
}

AActor* AEmersynGameMode::SpawnCrownMolding(FVector Start, FVector End, float WallHeight, FLinearColor Color)
{
    FVector Mid = (Start + End) * 0.5f + FVector(0, 0, WallHeight - 5.f);
    FVector Dir = End - Start; float Len = Dir.Size();
    FVector HE(Len * 0.5f, 4.f, 5.f);
    return SpawnTexturedBox(Mid, HE, ETexturePattern::WoodGrain, Color, Color * 1.05f);
}

// ============================================================
// v25: WINDOW FRAME & PICTURE FRAME
// ============================================================
AActor* AEmersynGameMode::SpawnWindowFrame(FVector WallStart, FVector WallEnd, float WallHeight, float WindowY, float WindowWidth, float WindowHeight, FLinearColor FrameColor, FLinearColor GlassColor)
{
    FVector WallMid = (WallStart + WallEnd) * 0.5f;
    FVector WinCenter = WallMid + FVector(0, 0, WindowY + WindowHeight * 0.5f);
    // Frame (slightly larger than glass)
    SpawnTexturedBox(WinCenter, FVector(WindowWidth * 0.5f + 5.f, 3.f, WindowHeight * 0.5f + 5.f), ETexturePattern::WoodGrain, FrameColor, FrameColor * 0.9f);
    // Glass pane
    return SpawnTexturedBox(WinCenter, FVector(WindowWidth * 0.5f, 2.f, WindowHeight * 0.5f), ETexturePattern::Water, GlassColor, SC::WaterLight);
}

AActor* AEmersynGameMode::SpawnPictureFrame(FVector Location, FRotator Rotation, FVector Size, FLinearColor FrameColor, FLinearColor CanvasColor)
{
    // Frame border
    SpawnTexturedBox(Location, FVector(Size.X + 4.f, 2.f, Size.Z + 4.f), ETexturePattern::WoodGrain, FrameColor, FrameColor * 0.85f);
    // Canvas
    return SpawnTexturedBox(Location, FVector(Size.X - 2.f, 1.5f, Size.Z - 2.f), ETexturePattern::Fabric, CanvasColor, CanvasColor * 1.1f);
}

// ============================================================
// SKY DOME
// ============================================================
void AEmersynGameMode::SpawnSky()
{
    AActor* A = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FTransform(FVector(0, 0, -500)));
    if (!A) return;
    A->SetRootComponent(NewObject<USceneComponent>(A));
    A->GetRootComponent()->RegisterComponent();
    UProceduralMeshComponent* PMC = NewObject<UProceduralMeshComponent>(A);
    PMC->SetupAttachment(A->GetRootComponent());
    PMC->RegisterComponent();
    // Use sky colors based on current preset
    FLinearColor SkyTop, SkyBot;
    switch (CurrentLightPreset) {
    case ELightingPreset::Day:     SkyTop = SC::SkyTopDay;     SkyBot = SC::SkyBotDay;     break;
    case ELightingPreset::Sunset:  SkyTop = SC::SkyTopSunset;  SkyBot = SC::SkyBotSunset;  break;
    case ELightingPreset::Night:   SkyTop = SC::SkyTopNight;   SkyBot = SC::SkyBotNight;   break;
    case ELightingPreset::Morning: SkyTop = SC::SkyTopMorning; SkyBot = SC::SkyBotMorning; break;
    case ELightingPreset::Party:   SkyTop = FLinearColor(0.15f, 0.05f, 0.30f); SkyBot = FLinearColor(0.35f, 0.15f, 0.50f); break;
    }
    int32 Seg = 32; float Radius = 10000.f;
    TArray<FVector> V; TArray<int32> T; TArray<FColor> C;
    TArray<FVector> N; TArray<FVector2D> UV; TArray<FProcMeshTangent> Tan;
    V.Add(FVector(0, 0, Radius)); N.Add(FVector(0, 0, -1));
    UV.Add(FVector2D(0.5f, 0.5f)); C.Add(SkyTop.ToFColor(true));
    Tan.Add(FProcMeshTangent(1, 0, 0));
    for (int32 Ring = 1; Ring <= Seg / 2; Ring++) {
        float Phi = PI * Ring / (Seg / 2);
        float HF = 1.f - (float)Ring / (Seg / 2);
        FLinearColor RC = FMath::Lerp(SkyBot, SkyTop, HF);
        for (int32 S = 0; S < Seg; S++) {
            float Theta = 2.f * PI * S / Seg;
            V.Add(FVector(Radius * FMath::Sin(Phi) * FMath::Cos(Theta), Radius * FMath::Sin(Phi) * FMath::Sin(Theta), Radius * FMath::Cos(Phi)));
            N.Add(-V.Last().GetSafeNormal());
            UV.Add(FVector2D(FMath::Cos(Theta) * 0.5f + 0.5f, FMath::Sin(Theta) * 0.5f + 0.5f));
            C.Add(RC.ToFColor(true));
            Tan.Add(FProcMeshTangent(1, 0, 0));
        }
    }
    for (int32 S = 0; S < Seg; S++) {
        T.Add(0); T.Add(1 + (S + 1) % Seg); T.Add(1 + S);
    }
    for (int32 Ring = 0; Ring < Seg / 2 - 1; Ring++) {
        for (int32 S = 0; S < Seg; S++) {
            int32 Cur = 1 + Ring * Seg + S;
            int32 Next = 1 + Ring * Seg + (S + 1) % Seg;
            int32 CurB = 1 + (Ring + 1) * Seg + S;
            int32 NextB = 1 + (Ring + 1) * Seg + (S + 1) % Seg;
            T.Add(Cur); T.Add(Next); T.Add(CurB);
            T.Add(Next); T.Add(NextB); T.Add(CurB);
        }
    }
    PMC->CreateMeshSection(0, V, T, N, UV, C, Tan, false);
    if (M_VertexColor) {
        UMaterialInstanceDynamic* MID = UMaterialInstanceDynamic::Create(M_VertexColor, this);
        MID->TwoSided = true;
        PMC->SetMaterial(0, MID);
    }
    RoomActors.Add(A);
}

// ============================================================
// SPAWN MESH (using MeshData headers)
// ============================================================
AActor* AEmersynGameMode::SpawnMesh(const float* Verts, const float* Norms, const float* UVData,
    const int32* Tris, int32 NumVerts, int32 NumTris,
    FVector Location, FRotator Rotation, FVector Scale,
    ETexturePattern Pattern, FLinearColor Base, FLinearColor Accent, float Brightness)
{
    // Validate raw buffer inputs to prevent null pointer dereference
    if (!Verts || !Tris || NumVerts <= 0 || NumTris <= 0)
    {
        UE_LOG(LogTemp, Warning, TEXT("SpawnMesh: Invalid mesh data (Verts=%p, Tris=%p, NumVerts=%d, NumTris=%d)"), Verts, Tris, NumVerts, NumTris);
        return nullptr;
    }
    AActor* A = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FTransform(Rotation, Location, Scale));
    if (!A) return nullptr;
    A->SetRootComponent(NewObject<USceneComponent>(A));
    A->GetRootComponent()->RegisterComponent();
    UProceduralMeshComponent* PMC = NewObject<UProceduralMeshComponent>(A);
    PMC->SetupAttachment(A->GetRootComponent());
    PMC->RegisterComponent();
    TArray<FVector> V; TArray<int32> T; TArray<FColor> C;
    TArray<FVector> N; TArray<FVector2D> UV; TArray<FProcMeshTangent> Tan;
    V.Reserve(NumVerts); N.Reserve(NumVerts); UV.Reserve(NumVerts); C.Reserve(NumVerts);
    for (int32 I = 0; I < NumVerts; I++) {
        V.Add(FVector(Verts[I*3], Verts[I*3+1], Verts[I*3+2]));
        FVector Norm(0, 0, 1);
        if (Norms) Norm = FVector(Norms[I*3], Norms[I*3+1], Norms[I*3+2]);
        N.Add(Norm);
        FVector2D UVCoord(0, 0);
        if (UVData) UVCoord = FVector2D(UVData[I*2], UVData[I*2+1]);
        UV.Add(UVCoord);
        Tan.Add(FProcMeshTangent(1, 0, 0));
        float NV = SimpleNoise(Verts[I*3] * 0.08f, Verts[I*3+1] * 0.08f);
        float HF = FMath::Clamp((Verts[I*3+2] + 50.f) / 100.f, 0.f, 1.f);
        FLinearColor BaseVC = FMath::Lerp(Base, Accent, NV * 0.6f + HF * 0.25f);
        BaseVC *= Brightness;
        float AOVal = FMath::Clamp(0.65f + HF * 0.35f, 0.45f, 1.0f);
        FVector WP = Location + FVector(Verts[I*3], Verts[I*3+1], Verts[I*3+2]) * Scale.X;
        FLinearColor VC = ApplySimsLighting(BaseVC, Norm, WP, AOVal);
        VC.A = 1.f;
        C.Add(VC.ToFColor(true));
    }
    for (int32 I = 0; I < NumTris * 3; I++) {
        T.Add(FMath::Clamp(Tris[I], 0, NumVerts - 1));
    }
    PMC->CreateMeshSection(0, V, T, N, UV, C, Tan, false);
    if (M_VertexColor) { PMC->SetMaterial(0, UMaterialInstanceDynamic::Create(M_VertexColor, this)); }
    PMC->SetCastShadow(true);
    RoomActors.Add(A);
    return A;
}

AActor* AEmersynGameMode::SpawnMeshVC(const float* Verts, const float* Norms, const float* UVData,
    const int32* Tris, int32 NumVerts, int32 NumTris,
    FVector Location, FRotator Rotation, FVector Scale,
    const FLinearColor& Tint, float Brightness)
{
    return SpawnMesh(Verts, Norms, UVData, Tris, NumVerts, NumTris, Location, Rotation, Scale, ETexturePattern::Fabric, Tint, Tint * 0.8f, Brightness);
}

AActor* AEmersynGameMode::SpawnCharacterMesh(const FString& Name, FVector Location, FRotator Rotation,
    float InScale, const FLinearColor& SkinTint, const FLinearColor& OutfitTint)
{
    // v25b: Lightweight procedural character (head + body + arms + legs)
    // Replaces heavy MeshData headers to fix mobile init crash
    float S = InScale * 10.f;
    bool bIsPet = (Name == TEXT("Cat") || Name == TEXT("Dog"));
    if (bIsPet) {
        // Pet: body + head + legs + tail
        SpawnTexturedBox(Location + FVector(0, 0, 12*S), FVector(8*S, 14*S, 7*S), ETexturePattern::Fabric, SkinTint, SkinTint * 0.9f);
        SpawnSphere(Location + FVector(0, -14*S, 16*S), 6*S, 8, SkinTint * 1.05f);
        // Legs
        SpawnCylinder(Location + FVector(-5*S, -8*S, 0), 2*S, 12*S, 6, SkinTint * 0.85f);
        SpawnCylinder(Location + FVector(5*S, -8*S, 0), 2*S, 12*S, 6, SkinTint * 0.85f);
        SpawnCylinder(Location + FVector(-5*S, 8*S, 0), 2*S, 12*S, 6, SkinTint * 0.85f);
        SpawnCylinder(Location + FVector(5*S, 8*S, 0), 2*S, 12*S, 6, SkinTint * 0.85f);
        // Ears
        SpawnTexturedBox(Location + FVector(-3*S, -18*S, 22*S), FVector(2*S, 2*S, 4*S), ETexturePattern::Fabric, SkinTint * 0.9f, SkinTint);
        SpawnTexturedBox(Location + FVector(3*S, -18*S, 22*S), FVector(2*S, 2*S, 4*S), ETexturePattern::Fabric, SkinTint * 0.9f, SkinTint);
        // Tail
        SpawnCylinder(Location + FVector(0, 14*S, 18*S), 1.5f*S, 8*S, 6, SkinTint * 0.8f);
    } else {
        // Human: head + torso + arms + legs + hair
        // Legs (outfit color)
        SpawnCylinder(Location + FVector(-4*S, 0, 0), 3*S, 25*S, 8, OutfitTint * 0.85f);
        SpawnCylinder(Location + FVector(4*S, 0, 0), 3*S, 25*S, 8, OutfitTint * 0.85f);
        // Torso (outfit)
        SpawnTexturedBox(Location + FVector(0, 0, 38*S), FVector(10*S, 6*S, 14*S), ETexturePattern::Fabric, OutfitTint, OutfitTint * 0.95f);
        // Arms (skin)
        SpawnCylinder(Location + FVector(-12*S, 0, 35*S), 2.5f*S, 14*S, 6, SkinTint * 0.95f);
        SpawnCylinder(Location + FVector(12*S, 0, 35*S), 2.5f*S, 14*S, 6, SkinTint * 0.95f);
        // Head (skin)
        SpawnSphere(Location + FVector(0, 0, 58*S), 7*S, 10, SkinTint);
        // Hair
        FLinearColor HairColor = FLinearColor(0.15f, 0.10f, 0.05f);
        if (Name == TEXT("Emersyn")) HairColor = FLinearColor(0.85f, 0.55f, 0.20f);
        if (Name == TEXT("Ava")) HairColor = FLinearColor(0.12f, 0.08f, 0.04f);
        if (Name == TEXT("Leo")) HairColor = FLinearColor(0.25f, 0.15f, 0.08f);
        if (Name == TEXT("Mia")) HairColor = FLinearColor(0.55f, 0.25f, 0.10f);
        SpawnSphere(Location + FVector(0, 1*S, 62*S), 7.5f*S, 8, HairColor);
        // Shoes
        SpawnTexturedBox(Location + FVector(-4*S, -1*S, 1*S), FVector(3.5f*S, 5*S, 2*S), ETexturePattern::Fabric, OutfitTint * 0.5f, OutfitTint * 0.4f);
        SpawnTexturedBox(Location + FVector(4*S, -1*S, 1*S), FVector(3.5f*S, 5*S, 2*S), ETexturePattern::Fabric, OutfitTint * 0.5f, OutfitTint * 0.4f);
    }
    return nullptr;
}

// ============================================================
// LIGHTING
// ============================================================
void AEmersynGameMode::SpawnLight(FVector Loc, float Intensity, FLinearColor Color, float Radius)
{
    AActor* A = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FTransform(Loc));
    if (!A) return;
    A->SetRootComponent(NewObject<USceneComponent>(A));
    A->GetRootComponent()->RegisterComponent();
    UPointLightComponent* PLC = NewObject<UPointLightComponent>(A);
    PLC->SetupAttachment(A->GetRootComponent());
    PLC->RegisterComponent();
    PLC->SetIntensity(Intensity); PLC->SetLightColor(Color);
    PLC->SetAttenuationRadius(Radius); PLC->SetCastShadows(true);
    RoomActors.Add(A);
}

void AEmersynGameMode::SpawnDirectionalLight(FRotator Rot, float Intensity, FLinearColor Color)
{
    AActor* A = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FTransform(Rot, FVector(0, 0, 2000)));
    if (!A) return;
    A->SetRootComponent(NewObject<USceneComponent>(A));
    A->GetRootComponent()->RegisterComponent();
    UDirectionalLightComponent* DLC = NewObject<UDirectionalLightComponent>(A);
    DLC->SetupAttachment(A->GetRootComponent());
    DLC->RegisterComponent();
    DLC->SetIntensity(Intensity); DLC->SetLightColor(Color); DLC->SetCastShadows(true);
    RoomActors.Add(A);
}

void AEmersynGameMode::SpawnSkyLight(float Intensity)
{
    FActorSpawnParameters Params;
    ASkyLight* SL = GetWorld()->SpawnActor<ASkyLight>(ASkyLight::StaticClass(), FTransform(FVector(0, 0, 1000)), Params);
    if (!SL) return;
    SL->GetLightComponent()->SetIntensity(Intensity);
    SL->GetLightComponent()->SetLightColor(LightFillColor);
    SL->GetLightComponent()->bLowerHemisphereIsBlack = false;
    RoomActors.Add(SL);
}

void AEmersynGameMode::SpawnRoomLighting(FVector RC, FVector RS)
{
    SpawnLight(RC + FVector(0, 0, RS.Z * 0.95f), 22.f, LightKeyColor, RS.X * 2.2f);
    SpawnLight(RC + FVector(RS.X * 0.4f, -RS.Y * 0.4f, RS.Z * 0.7f), 12.f, LightKeyColor * FLinearColor(1.0f, 0.92f, 0.72f), RS.X * 1.3f);
    SpawnLight(RC + FVector(-RS.X * 0.4f, RS.Y * 0.4f, RS.Z * 0.6f), 9.f, LightFillColor, RS.X * 1.3f);
    SpawnLight(RC + FVector(0, 0, 25.f), 6.f, FLinearColor(0.95f, 0.92f, 0.85f), RS.X * 1.6f);
    SpawnLight(RC + FVector(0, -RS.Y * 0.5f, RS.Z * 0.3f), 7.f, LightKeyColor * 0.8f, RS.X);
}

// ============================================================
// POST-PROCESSING (v25: preset-aware)
// ============================================================
void AEmersynGameMode::SetupPostProcessing()
{
    FActorSpawnParameters Params;
    APostProcessVolume* PPV = GetWorld()->SpawnActor<APostProcessVolume>(APostProcessVolume::StaticClass(), FTransform(FVector::ZeroVector), Params);
    if (!PPV) return;
    PPV->bUnbound = true;
    PPV->Settings.bOverride_BloomIntensity = true; PPV->Settings.BloomIntensity = 0.55f;
    PPV->Settings.bOverride_BloomThreshold = true; PPV->Settings.BloomThreshold = 0.75f;
    PPV->Settings.bOverride_AmbientOcclusionIntensity = true; PPV->Settings.AmbientOcclusionIntensity = 1.4f;
    PPV->Settings.bOverride_AmbientOcclusionRadius = true; PPV->Settings.AmbientOcclusionRadius = 250.f;
    PPV->Settings.bOverride_AmbientOcclusionQuality = true; PPV->Settings.AmbientOcclusionQuality = 100.f;
    PPV->Settings.bOverride_VignetteIntensity = true; PPV->Settings.VignetteIntensity = 0.06f;
    PPV->Settings.bOverride_AutoExposureBias = true; PPV->Settings.AutoExposureBias = 2.0f;
    PPV->Settings.bOverride_AutoExposureMinBrightness = true; PPV->Settings.AutoExposureMinBrightness = 0.5f;
    PPV->Settings.bOverride_AutoExposureMaxBrightness = true; PPV->Settings.AutoExposureMaxBrightness = 2.0f;
    // Preset-specific color grading
    switch (CurrentLightPreset) {
    case ELightingPreset::Day:
        PPV->Settings.bOverride_ColorSaturation = true; PPV->Settings.ColorSaturation = FVector4(1.45f, 1.45f, 1.45f, 1.0f);
        PPV->Settings.bOverride_ColorContrast = true; PPV->Settings.ColorContrast = FVector4(1.20f, 1.20f, 1.20f, 1.0f);
        PPV->Settings.bOverride_ColorGamma = true; PPV->Settings.ColorGamma = FVector4(0.90f, 0.90f, 0.90f, 1.0f);
        break;
    case ELightingPreset::Sunset:
        PPV->Settings.bOverride_ColorSaturation = true; PPV->Settings.ColorSaturation = FVector4(1.60f, 1.35f, 1.15f, 1.0f);
        PPV->Settings.bOverride_ColorContrast = true; PPV->Settings.ColorContrast = FVector4(1.25f, 1.15f, 1.10f, 1.0f);
        PPV->Settings.bOverride_ColorGamma = true; PPV->Settings.ColorGamma = FVector4(0.88f, 0.92f, 0.98f, 1.0f);
        break;
    case ELightingPreset::Night:
        PPV->Settings.bOverride_ColorSaturation = true; PPV->Settings.ColorSaturation = FVector4(0.85f, 0.90f, 1.20f, 1.0f);
        PPV->Settings.bOverride_ColorContrast = true; PPV->Settings.ColorContrast = FVector4(1.30f, 1.30f, 1.35f, 1.0f);
        PPV->Settings.bOverride_ColorGamma = true; PPV->Settings.ColorGamma = FVector4(1.05f, 1.02f, 0.92f, 1.0f);
        break;
    case ELightingPreset::Morning:
        PPV->Settings.bOverride_ColorSaturation = true; PPV->Settings.ColorSaturation = FVector4(1.30f, 1.35f, 1.25f, 1.0f);
        PPV->Settings.bOverride_ColorContrast = true; PPV->Settings.ColorContrast = FVector4(1.12f, 1.15f, 1.18f, 1.0f);
        PPV->Settings.bOverride_ColorGamma = true; PPV->Settings.ColorGamma = FVector4(0.92f, 0.90f, 0.88f, 1.0f);
        break;
    case ELightingPreset::Party:
        PPV->Settings.bOverride_ColorSaturation = true; PPV->Settings.ColorSaturation = FVector4(1.80f, 1.80f, 1.80f, 1.0f);
        PPV->Settings.bOverride_ColorContrast = true; PPV->Settings.ColorContrast = FVector4(1.35f, 1.35f, 1.35f, 1.0f);
        PPV->Settings.bOverride_ColorGamma = true; PPV->Settings.ColorGamma = FVector4(0.85f, 0.85f, 0.85f, 1.0f);
        PPV->Settings.BloomIntensity = 0.85f;
        break;
    }
    RoomActors.Add(PPV);
}

// ============================================================
// TEXT & CAMERA
// ============================================================
void AEmersynGameMode::SpawnWorldText(const FString& Text, FVector Location, float Size, FLinearColor Color)
{
    AActor* A = GetWorld()->SpawnActor<AActor>(AActor::StaticClass(), FTransform(Location));
    if (!A) return;
    A->SetRootComponent(NewObject<USceneComponent>(A));
    A->GetRootComponent()->RegisterComponent();
    UTextRenderComponent* TRC = NewObject<UTextRenderComponent>(A);
    TRC->SetupAttachment(A->GetRootComponent());
    TRC->RegisterComponent();
    TRC->SetText(FText::FromString(Text));
    TRC->SetWorldSize(Size);
    TRC->SetTextRenderColor(Color.ToFColor(true));
    TRC->SetHorizontalAlignment(EHTA_Center);
    TRC->SetVerticalAlignment(EVRTA_TextCenter);
    RoomActors.Add(A);
}

void AEmersynGameMode::SpawnRoomLabel(const FString& Label)
{
    SpawnWorldText(Label, FVector(0, 0, 500), 55.f, FLinearColor(1.f, 1.f, 1.f));
}

void AEmersynGameMode::SetupIsometricCamera(FVector RoomCenter, float Distance)
{
    // v31: Legacy wrapper - forward to auto camera when possible
    float SafeDistance = FMath::Max(Distance, 900.f);
    FRotator CamRot(-65.f, 45.f, 0.f);  // v31: Steep pitch to look DOWN at dollhouse
    FVector CamOffset = CamRot.Vector() * -SafeDistance;
    FVector CamPos = RoomCenter + CamOffset;
    if (!IsoCam) {
        IsoCam = GetWorld()->SpawnActor<ACameraActor>(ACameraActor::StaticClass(), FTransform(CamRot, CamPos));
        if (IsoCam) {
            IsoCam->GetCameraComponent()->FieldOfView = 50.f;  // v36: Sims-style near-orthographic
            APlayerController* PC = GetWorld()->GetFirstPlayerController();
            if (PC) {
                PC->SetViewTarget(IsoCam);
                PC->SetIgnoreLookInput(true);
                PC->SetIgnoreMoveInput(true);
            }
        }
    } else {
        CamStartPos = IsoCam->GetActorLocation();
        CamStartRot = IsoCam->GetActorRotation();
        CamTargetPos = CamPos;
        CamTargetRot = CamRot;
        CamMoveAlpha = 0.f;
        bCameraMoving = true;
    }
}

// v45: Camera distance for Sims dollhouse
float AEmersynGameMode::CalcAutoCameraDistance(FVector RoomSize) const
{
    float MaxDim = FMath::Max(RoomSize.X, RoomSize.Y);
    float Dist = MaxDim * 2.0f;  // v45: high above for true dollhouse
    return FMath::Clamp(Dist, 800.f, 2500.f);  // v45: allow very far for large rooms
}

// v49: High altitude camera for true Sims dollhouse view
void AEmersynGameMode::SetupAutoCamera(FVector RoomSize)
{
    float MaxDim = FMath::Max(RoomSize.X, RoomSize.Y);
    float AutoDist = MaxDim * 4.0f;  // v49: very high for overhead dollhouse
    AutoDist = FMath::Clamp(AutoDist, 1200.f, 4000.f);

    // v49: 70° pitch (good balance between overhead and perspective), 35° yaw
    float PitchDeg = 70.f;
    float YawDeg = 35.f;
    float PitchRad = FMath::DegreesToRadians(PitchDeg);
    float YawRad = FMath::DegreesToRadians(YawDeg);

    float CamZ = AutoDist * FMath::Sin(PitchRad);
    float CamHoriz = AutoDist * FMath::Cos(PitchRad);
    float CamX = CamHoriz * FMath::Cos(YawRad);
    float CamY = CamHoriz * FMath::Sin(YawRad);
    FVector CamPos(CamX, CamY, CamZ);

    FVector LookDir = (FVector::ZeroVector - CamPos).GetSafeNormal();
    FRotator CamRot = LookDir.Rotation();
    float FOV = 35.f;  // v49: very narrow FOV for tight dollhouse framing

    // v47: Store locked values for every-frame enforcement in Tick()
    LockedCamPos = CamPos;
    LockedCamRot = CamRot;
    LockedCamFOV = FOV;

    APlayerController* PC = GetWorld()->GetFirstPlayerController();

    if (!IsoCam) {
        IsoCam = GetWorld()->SpawnActor<ACameraActor>(ACameraActor::StaticClass(), FTransform(CamRot, CamPos));
        if (IsoCam) {
            IsoCam->GetCameraComponent()->FieldOfView = FOV;
            if (PC) {
                PC->SetViewTargetWithBlend(IsoCam, 0.f);
                PC->SetControlRotation(CamRot);
                PC->SetIgnoreLookInput(true);
                PC->SetIgnoreMoveInput(true);
            }
        }
    } else {
        IsoCam->SetActorLocation(CamPos);
        IsoCam->SetActorRotation(CamRot);
        IsoCam->GetCameraComponent()->FieldOfView = FOV;
        if (PC) {
            PC->SetViewTargetWithBlend(IsoCam, 0.f);
            PC->SetControlRotation(CamRot);
        }
        bCameraMoving = false;
    }
}

// ============================================================
// v25: ROOM SHELL BUILDER (Sims cutaway - only back + side walls)
// ============================================================
void AEmersynGameMode::BuildRoomShell(FVector RS, ETexturePattern FloorPattern, FLinearColor FloorBase, FLinearColor FloorAccent,
    ETexturePattern WallPattern, FLinearColor WallBase, FLinearColor WallAccent, FLinearColor CeilingColor,
    ELightingPreset LightPreset, const FString& RoomLabel)
{
    SetLightingPreset(LightPreset);
    // v44: NO sky dome — it was filling the screen as huge colored triangles
    // SpawnSky();
    SetupPostProcessing();
    SpawnSkyLight(9.f);
    SpawnDirectionalLight(FRotator(-45.f, -90.f, 0.f), 30.f, LightKeyColor);
    // v44: Neutral background plane below room (light grey)
    SpawnTexturedFloor(FVector(0.f, 0.f, -10.f), FVector(RS.X * 3.f, RS.Y * 3.f, 0), ETexturePattern::Concrete, FLinearColor(0.85f, 0.87f, 0.90f), FLinearColor(0.82f, 0.84f, 0.87f), 1.f);

    SpawnTexturedFloor(FVector::ZeroVector, FVector(RS.X, RS.Y, 0), FloorPattern, FloorBase, FloorAccent, 2.f);

    // v49: BACK WALL — ultra-short border
    SpawnTexturedWall(FVector(-RS.X, RS.Y, 0), FVector(RS.X, RS.Y, 0), RS.Z, WallPattern, WallBase, WallAccent);
    // v49: LEFT WALL — same ultra-short height for thin border look
    SpawnTexturedWall(FVector(-RS.X, -RS.Y, 0), FVector(-RS.X, RS.Y, 0), RS.Z, WallPattern, WallBase * 0.9f, WallAccent * 0.9f);

    // v29: NO CEILING — removed so top-down camera can see inside the room
    // SpawnTexturedCeiling(FVector(0, 0, RS.Z), FVector(RS.X, RS.Y, 0), CeilingColor);
    SpawnRoomLighting(FVector(0, 0, RS.Z * 0.5f), RS);

    // v38: Baseboards on back wall + half-height left wall
    SpawnBaseboard(FVector(-RS.X, RS.Y, 0), FVector(RS.X, RS.Y, 0), 8.f, SC::WoodMedium);
    SpawnBaseboard(FVector(-RS.X, -RS.Y, 0), FVector(-RS.X, RS.Y, 0), 8.f, SC::WoodMedium);

    // v38: Crown molding only on back wall (left wall is half height)
    SpawnCrownMolding(FVector(-RS.X, RS.Y, 0), FVector(RS.X, RS.Y, 0), RS.Z, SC::WoodLight);

    SpawnRoomLabel(RoomLabel);
}

// ============================================================
// v25: DETAILED FURNITURE BUILDERS (multi-part procedural)
// ============================================================

// BED: frame + mattress + pillow + headboard + sheet
void AEmersynGameMode::SpawnDetailedBed(FVector Loc, FLinearColor FrameColor, FLinearColor SheetColor, FLinearColor PillowColor, float S)
{
    // Bed frame
    SpawnTexturedBox(Loc + FVector(0, 0, 15*S), FVector(55*S, 90*S, 15*S), ETexturePattern::WoodGrain, FrameColor, FrameColor * 0.85f);
    // Headboard
    SpawnTexturedBox(Loc + FVector(0, 80*S, 55*S), FVector(55*S, 5*S, 40*S), ETexturePattern::WoodGrain, FrameColor, FrameColor * 0.9f);
    // Mattress
    SpawnTexturedBox(Loc + FVector(0, -5*S, 33*S), FVector(50*S, 80*S, 12*S), ETexturePattern::Fabric, SheetColor, SheetColor * 0.95f);
    // Sheet (thin layer on mattress)
    SpawnTexturedBox(Loc + FVector(0, -20*S, 46*S), FVector(48*S, 55*S, 2*S), ETexturePattern::Fabric, SheetColor * 0.92f, SheetColor);
    // Pillow left
    SpawnTexturedBox(Loc + FVector(-20*S, 60*S, 48*S), FVector(18*S, 14*S, 6*S), ETexturePattern::Fabric, PillowColor, PillowColor * 1.05f);
    // Pillow right
    SpawnTexturedBox(Loc + FVector(20*S, 60*S, 48*S), FVector(18*S, 14*S, 6*S), ETexturePattern::Fabric, PillowColor, PillowColor * 1.05f);
    // Bed legs (4 corners)
    SpawnCylinder(Loc + FVector(-50*S, -85*S, 0), 4*S, 15*S, 8, FrameColor * 0.7f);
    SpawnCylinder(Loc + FVector(50*S, -85*S, 0), 4*S, 15*S, 8, FrameColor * 0.7f);
    SpawnCylinder(Loc + FVector(-50*S, 85*S, 0), 4*S, 15*S, 8, FrameColor * 0.7f);
    SpawnCylinder(Loc + FVector(50*S, 85*S, 0), 4*S, 15*S, 8, FrameColor * 0.7f);
}

// SOFA: base + cushions + arms + back + legs
void AEmersynGameMode::SpawnDetailedSofa(FVector Loc, FRotator Rot, FLinearColor FabricColor, FLinearColor CushionColor, FLinearColor LegColor, float S)
{
    // Sofa base
    SpawnTexturedBox(Loc + FVector(0, 0, 18*S), FVector(80*S, 35*S, 18*S), ETexturePattern::Fabric, FabricColor, FabricColor * 0.9f);
    // Back rest
    SpawnTexturedBox(Loc + FVector(0, 30*S, 42*S), FVector(78*S, 6*S, 22*S), ETexturePattern::Fabric, FabricColor, FabricColor * 0.85f);
    // Left arm
    SpawnTexturedBox(Loc + FVector(-75*S, 0, 30*S), FVector(6*S, 30*S, 14*S), ETexturePattern::Fabric, FabricColor * 0.95f, FabricColor * 0.85f);
    // Right arm
    SpawnTexturedBox(Loc + FVector(75*S, 0, 30*S), FVector(6*S, 30*S, 14*S), ETexturePattern::Fabric, FabricColor * 0.95f, FabricColor * 0.85f);
    // Seat cushion left
    SpawnTexturedBox(Loc + FVector(-30*S, -2*S, 37*S), FVector(32*S, 28*S, 5*S), ETexturePattern::Fabric, CushionColor, CushionColor * 1.05f);
    // Seat cushion right
    SpawnTexturedBox(Loc + FVector(30*S, -2*S, 37*S), FVector(32*S, 28*S, 5*S), ETexturePattern::Fabric, CushionColor, CushionColor * 1.05f);
    // Back cushions
    SpawnTexturedBox(Loc + FVector(-30*S, 22*S, 48*S), FVector(28*S, 8*S, 12*S), ETexturePattern::Fabric, CushionColor * 0.98f, CushionColor);
    SpawnTexturedBox(Loc + FVector(30*S, 22*S, 48*S), FVector(28*S, 8*S, 12*S), ETexturePattern::Fabric, CushionColor * 0.98f, CushionColor);
    // Legs
    SpawnCylinder(Loc + FVector(-70*S, -28*S, 0), 3*S, 8*S, 6, LegColor);
    SpawnCylinder(Loc + FVector(70*S, -28*S, 0), 3*S, 8*S, 6, LegColor);
    SpawnCylinder(Loc + FVector(-70*S, 28*S, 0), 3*S, 8*S, 6, LegColor);
    SpawnCylinder(Loc + FVector(70*S, 28*S, 0), 3*S, 8*S, 6, LegColor);
}

// TABLE: top + 4 legs
void AEmersynGameMode::SpawnDetailedTable(FVector Loc, FLinearColor TopColor, FLinearColor LegColor, float S)
{
    SpawnTexturedBox(Loc + FVector(0, 0, 40*S), FVector(50*S, 35*S, 3*S), ETexturePattern::WoodGrain, TopColor, TopColor * 0.92f);
    SpawnCylinder(Loc + FVector(-42*S, -28*S, 0), 3*S, 40*S, 8, LegColor);
    SpawnCylinder(Loc + FVector(42*S, -28*S, 0), 3*S, 40*S, 8, LegColor);
    SpawnCylinder(Loc + FVector(-42*S, 28*S, 0), 3*S, 40*S, 8, LegColor);
    SpawnCylinder(Loc + FVector(42*S, 28*S, 0), 3*S, 40*S, 8, LegColor);
}

// CHAIR: seat + back + 4 legs
void AEmersynGameMode::SpawnDetailedChair(FVector Loc, FRotator Rot, FLinearColor SeatColor, FLinearColor LegColor, float S)
{
    SpawnTexturedBox(Loc + FVector(0, 0, 25*S), FVector(20*S, 20*S, 2*S), ETexturePattern::Fabric, SeatColor, SeatColor * 0.95f);
    SpawnTexturedBox(Loc + FVector(0, 18*S, 42*S), FVector(19*S, 2*S, 18*S), ETexturePattern::WoodGrain, LegColor, LegColor * 0.9f);
    SpawnCylinder(Loc + FVector(-16*S, -16*S, 0), 2*S, 25*S, 6, LegColor);
    SpawnCylinder(Loc + FVector(16*S, -16*S, 0), 2*S, 25*S, 6, LegColor);
    SpawnCylinder(Loc + FVector(-16*S, 16*S, 0), 2*S, 25*S, 6, LegColor);
    SpawnCylinder(Loc + FVector(16*S, 16*S, 0), 2*S, 25*S, 6, LegColor);
}

// BOOKSHELF: frame + 4 shelves + books
void AEmersynGameMode::SpawnDetailedBookshelf(FVector Loc, FRotator Rot, FLinearColor ShelfColor, float S)
{
    // Frame sides
    SpawnTexturedBox(Loc + FVector(-32*S, 0, 70*S), FVector(2*S, 15*S, 70*S), ETexturePattern::WoodGrain, ShelfColor, ShelfColor * 0.85f);
    SpawnTexturedBox(Loc + FVector(32*S, 0, 70*S), FVector(2*S, 15*S, 70*S), ETexturePattern::WoodGrain, ShelfColor, ShelfColor * 0.85f);
    // Back
    SpawnTexturedBox(Loc + FVector(0, 13*S, 70*S), FVector(30*S, 1*S, 70*S), ETexturePattern::WoodGrain, ShelfColor * 0.8f, ShelfColor * 0.7f);
    // Shelves (4 levels)
    for (int32 I = 0; I < 5; I++) {
        float H = I * 28.f * S;
        SpawnTexturedBox(Loc + FVector(0, 0, H + 5*S), FVector(30*S, 14*S, 2*S), ETexturePattern::WoodGrain, ShelfColor, ShelfColor * 0.9f);
    }
    // Books (colored blocks on shelves)
    FLinearColor BookColors[] = { SC::FabricRed, SC::FabricBlue, SC::FabricGreen, SC::FabricPurple, SC::FabricOrange, SC::FabricNavy, SC::FabricCoral, SC::FabricTeal };
    for (int32 Shelf = 0; Shelf < 4; Shelf++) {
        float SH = (Shelf + 1) * 28.f * S;
        for (int32 B = 0; B < 5; B++) {
            float BX = (-20.f + B * 10.f) * S;
            float BH = (18.f + SimpleNoise(B * 3.f, Shelf * 5.f) * 8.f) * S;
            SpawnTexturedBox(Loc + FVector(BX, -2*S, SH + BH * 0.5f + 7*S), FVector(4*S, 8*S, BH * 0.5f), ETexturePattern::Fabric, BookColors[(Shelf * 5 + B) % 8], BookColors[(Shelf * 5 + B) % 8] * 0.85f);
        }
    }
}

// DRESSER: body + drawers + handles
void AEmersynGameMode::SpawnDetailedDresser(FVector Loc, FLinearColor BodyColor, FLinearColor HandleColor, float S)
{
    // Body
    SpawnTexturedBox(Loc + FVector(0, 0, 40*S), FVector(40*S, 22*S, 40*S), ETexturePattern::WoodGrain, BodyColor, BodyColor * 0.9f);
    // Top surface
    SpawnTexturedBox(Loc + FVector(0, 0, 81*S), FVector(42*S, 24*S, 2*S), ETexturePattern::WoodGrain, BodyColor * 1.05f, BodyColor);
    // Drawers (3 rows)
    for (int32 D = 0; D < 3; D++) {
        float DY = (10.f + D * 25.f) * S;
        SpawnTexturedBox(Loc + FVector(0, -22.5f*S, DY), FVector(36*S, 1*S, 10*S), ETexturePattern::WoodGrain, BodyColor * 0.92f, BodyColor * 0.85f);
        // Handle
        SpawnTexturedBox(Loc + FVector(0, -24*S, DY), FVector(8*S, 1.5f*S, 1.5f*S), ETexturePattern::Metal, HandleColor, HandleColor * 1.1f);
    }
    // Legs
    SpawnCylinder(Loc + FVector(-35*S, -18*S, 0), 3*S, 5*S, 6, BodyColor * 0.7f);
    SpawnCylinder(Loc + FVector(35*S, -18*S, 0), 3*S, 5*S, 6, BodyColor * 0.7f);
    SpawnCylinder(Loc + FVector(-35*S, 18*S, 0), 3*S, 5*S, 6, BodyColor * 0.7f);
    SpawnCylinder(Loc + FVector(35*S, 18*S, 0), 3*S, 5*S, 6, BodyColor * 0.7f);
}

// LAMP: base + pole + shade
void AEmersynGameMode::SpawnDetailedLamp(FVector Loc, FLinearColor BaseColor, FLinearColor ShadeColor, float S)
{
    // Base disc
    SpawnCylinder(Loc, 10*S, 4*S, 12, BaseColor);
    // Pole
    SpawnCylinder(Loc + FVector(0, 0, 4*S), 2*S, 45*S, 8, BaseColor * 0.85f);
    // Shade (wider cylinder)
    SpawnCylinder(Loc + FVector(0, 0, 42*S), 15*S, 18*S, 12, ShadeColor, 0.95f);
    // Light glow (small bright sphere inside shade)
    SpawnSphere(Loc + FVector(0, 0, 50*S), 4*S, 8, FLinearColor(1.0f, 0.95f, 0.80f));
    // Emit actual light
    SpawnLight(Loc + FVector(0, 0, 50*S), 8.f, FLinearColor(1.0f, 0.92f, 0.72f), 300.f * S);
}

// RUG: bordered rectangle on floor
void AEmersynGameMode::SpawnDetailedRug(FVector Loc, FLinearColor CenterColor, FLinearColor BorderColor, FVector Size)
{
    // Border
    SpawnTexturedBox(Loc + FVector(0, 0, 0.5f), FVector(Size.X, Size.Y, 1.f), ETexturePattern::Carpet, BorderColor, BorderColor * 0.9f);
    // Center
    SpawnTexturedBox(Loc + FVector(0, 0, 1.2f), FVector(Size.X * 0.82f, Size.Y * 0.82f, 0.8f), ETexturePattern::Carpet, CenterColor, CenterColor * 1.05f);
}

// TV: screen + stand + base
void AEmersynGameMode::SpawnDetailedTV(FVector Loc, FRotator Rot, FLinearColor FrameColor, float S)
{
    // Screen (dark)
    SpawnTexturedBox(Loc + FVector(0, 0, 45*S), FVector(55*S, 2*S, 32*S), ETexturePattern::Metal, FLinearColor(0.05f, 0.05f, 0.08f), FLinearColor(0.15f, 0.15f, 0.18f));
    // Frame bezel
    SpawnTexturedBox(Loc + FVector(0, 1*S, 45*S), FVector(58*S, 1*S, 34*S), ETexturePattern::Metal, FrameColor, FrameColor * 0.9f);
    // Stand neck
    SpawnCylinder(Loc + FVector(0, 0, 8*S), 3*S, 12*S, 8, FrameColor * 0.8f);
    // Stand base
    SpawnTexturedBox(Loc + FVector(0, 0, 3*S), FVector(22*S, 12*S, 3*S), ETexturePattern::Metal, FrameColor, FrameColor * 0.85f);
}

// FRIDGE: body + door handle + top
void AEmersynGameMode::SpawnDetailedFridge(FVector Loc, FLinearColor BodyColor, FLinearColor HandleColor, float S)
{
    // Body
    SpawnTexturedBox(Loc + FVector(0, 0, 75*S), FVector(35*S, 30*S, 75*S), ETexturePattern::Metal, BodyColor, BodyColor * 0.96f);
    // Upper door line
    SpawnTexturedBox(Loc + FVector(0, -30.5f*S, 95*S), FVector(33*S, 0.5f*S, 1*S), ETexturePattern::Metal, BodyColor * 0.8f, BodyColor * 0.7f);
    // Handle upper
    SpawnTexturedBox(Loc + FVector(25*S, -32*S, 110*S), FVector(1.5f*S, 2*S, 18*S), ETexturePattern::Metal, HandleColor, HandleColor * 1.1f);
    // Handle lower
    SpawnTexturedBox(Loc + FVector(25*S, -32*S, 45*S), FVector(1.5f*S, 2*S, 18*S), ETexturePattern::Metal, HandleColor, HandleColor * 1.1f);
    // Top
    SpawnTexturedBox(Loc + FVector(0, 0, 150.5f*S), FVector(36*S, 31*S, 1*S), ETexturePattern::Metal, BodyColor * 1.02f, BodyColor);
}

// STOVE: body + burners + oven door + knobs
void AEmersynGameMode::SpawnDetailedStove(FVector Loc, FLinearColor BodyColor, float S)
{
    // Body
    SpawnTexturedBox(Loc + FVector(0, 0, 45*S), FVector(35*S, 28*S, 45*S), ETexturePattern::Metal, BodyColor, BodyColor * 0.95f);
    // Cook top
    SpawnTexturedBox(Loc + FVector(0, 0, 90.5f*S), FVector(34*S, 27*S, 1*S), ETexturePattern::Metal, FLinearColor(0.12f, 0.12f, 0.14f), FLinearColor(0.18f, 0.18f, 0.20f));
    // 4 burners
    SpawnCylinder(Loc + FVector(-14*S, -10*S, 91*S), 7*S, 1*S, 12, FLinearColor(0.25f, 0.25f, 0.28f));
    SpawnCylinder(Loc + FVector(14*S, -10*S, 91*S), 7*S, 1*S, 12, FLinearColor(0.25f, 0.25f, 0.28f));
    SpawnCylinder(Loc + FVector(-14*S, 10*S, 91*S), 9*S, 1*S, 12, FLinearColor(0.25f, 0.25f, 0.28f));
    SpawnCylinder(Loc + FVector(14*S, 10*S, 91*S), 9*S, 1*S, 12, FLinearColor(0.25f, 0.25f, 0.28f));
    // Oven door
    SpawnTexturedBox(Loc + FVector(0, -28.5f*S, 32*S), FVector(30*S, 0.5f*S, 25*S), ETexturePattern::Metal, FLinearColor(0.08f, 0.08f, 0.10f), FLinearColor(0.15f, 0.15f, 0.18f));
    // Oven handle
    SpawnTexturedBox(Loc + FVector(0, -30*S, 58*S), FVector(20*S, 1.5f*S, 1.5f*S), ETexturePattern::Metal, SC::MetalChrome, SC::MetalSilver);
    // Knobs
    for (int32 K = 0; K < 4; K++) {
        float KX = (-21.f + K * 14.f) * S;
        SpawnCylinder(Loc + FVector(KX, -29*S, 78*S), 3*S, 2*S, 8, SC::MetalSilver);
    }
}

// SINK: basin + faucet + counter
void AEmersynGameMode::SpawnDetailedSink(FVector Loc, FLinearColor BasinColor, FLinearColor FaucetColor, float S)
{
    // Counter body
    SpawnTexturedBox(Loc + FVector(0, 0, 40*S), FVector(35*S, 25*S, 40*S), ETexturePattern::WoodGrain, SC::WoodOak, SC::WoodMedium);
    // Counter top
    SpawnTexturedBox(Loc + FVector(0, 0, 81*S), FVector(36*S, 26*S, 2*S), ETexturePattern::Marble, SC::MarbleWhite, SC::MarbleVein);
    // Basin (recessed)
    SpawnTexturedBox(Loc + FVector(0, -2*S, 78*S), FVector(22*S, 16*S, 6*S), ETexturePattern::Metal, BasinColor, BasinColor * 0.95f);
    // Faucet base
    SpawnCylinder(Loc + FVector(0, 14*S, 82*S), 2*S, 18*S, 8, FaucetColor);
    // Faucet spout
    SpawnTexturedBox(Loc + FVector(0, 6*S, 100*S), FVector(1.5f*S, 10*S, 1.5f*S), ETexturePattern::Metal, FaucetColor, FaucetColor * 1.1f);
}

// BATHTUB: tub body + rim + faucet + feet
void AEmersynGameMode::SpawnDetailedBathtub(FVector Loc, FLinearColor TubColor, FLinearColor FeetColor, float S)
{
    // Outer shell
    SpawnTexturedBox(Loc + FVector(0, 0, 25*S), FVector(35*S, 75*S, 25*S), ETexturePattern::Marble, TubColor, TubColor * 0.95f);
    // Inner basin (slightly smaller, higher)
    SpawnTexturedBox(Loc + FVector(0, 0, 30*S), FVector(30*S, 70*S, 18*S), ETexturePattern::Marble, TubColor * 1.05f, TubColor * 1.02f);
    // Rim
    SpawnTexturedBox(Loc + FVector(0, 0, 50.5f*S), FVector(36*S, 76*S, 2*S), ETexturePattern::Marble, TubColor * 1.02f, TubColor);
    // Faucet
    SpawnCylinder(Loc + FVector(0, 70*S, 50*S), 2.5f*S, 15*S, 8, SC::MetalChrome);
    SpawnTexturedBox(Loc + FVector(0, 65*S, 65*S), FVector(1.5f*S, 8*S, 1.5f*S), ETexturePattern::Metal, SC::MetalChrome, SC::MetalSilver);
    // Claw feet
    SpawnSphere(Loc + FVector(-28*S, -65*S, 4*S), 5*S, 6, FeetColor);
    SpawnSphere(Loc + FVector(28*S, -65*S, 4*S), 5*S, 6, FeetColor);
    SpawnSphere(Loc + FVector(-28*S, 65*S, 4*S), 5*S, 6, FeetColor);
    SpawnSphere(Loc + FVector(28*S, 65*S, 4*S), 5*S, 6, FeetColor);
}

// TOILET: bowl + tank + seat + lid
void AEmersynGameMode::SpawnDetailedToilet(FVector Loc, FRotator Rot, FLinearColor Color, float S)
{
    // Base/bowl
    SpawnCylinder(Loc, 15*S, 22*S, 12, Color, 0.85f);
    // Seat
    SpawnCylinder(Loc + FVector(0, 0, 22*S), 16*S, 2*S, 12, Color * 0.98f);
    // Tank
    SpawnTexturedBox(Loc + FVector(0, 14*S, 32*S), FVector(16*S, 8*S, 18*S), ETexturePattern::Marble, Color, Color * 0.96f);
    // Tank top
    SpawnTexturedBox(Loc + FVector(0, 14*S, 50.5f*S), FVector(17*S, 9*S, 1*S), ETexturePattern::Marble, Color * 1.02f, Color);
    // Flush handle
    SpawnTexturedBox(Loc + FVector(14*S, 14*S, 48*S), FVector(4*S, 1*S, 1*S), ETexturePattern::Metal, SC::MetalChrome, SC::MetalSilver);
}

// MIRROR: reflective glass + frame
void AEmersynGameMode::SpawnDetailedMirror(FVector Loc, FRotator Rot, FLinearColor FrameColor, float S)
{
    // Frame
    SpawnTexturedBox(Loc, FVector(30*S, 2*S, 40*S), ETexturePattern::WoodGrain, FrameColor, FrameColor * 0.85f);
    // Glass surface (bright reflective tint)
    FLinearColor MirrorColor(0.75f, 0.82f, 0.88f);
    SpawnTexturedBox(Loc + FVector(0, -1*S, 0), FVector(26*S, 0.5f*S, 36*S), ETexturePattern::Metal, MirrorColor, MirrorColor * 1.1f);
}

// PLANT: pot + soil + leaves
void AEmersynGameMode::SpawnDetailedPlant(FVector Loc, FLinearColor PotColor, FLinearColor LeafColor, float S)
{
    // Pot
    SpawnCylinder(Loc, 12*S, 20*S, 10, PotColor, 0.85f);
    // Soil
    SpawnCylinder(Loc + FVector(0, 0, 19*S), 11*S, 2*S, 10, FLinearColor(0.28f, 0.18f, 0.08f));
    // Leaves (spheres at different heights/positions)
    SpawnSphere(Loc + FVector(0, 0, 35*S), 16*S, 8, LeafColor);
    SpawnSphere(Loc + FVector(8*S, 5*S, 42*S), 12*S, 8, LeafColor * 1.1f);
    SpawnSphere(Loc + FVector(-6*S, -4*S, 38*S), 10*S, 8, LeafColor * 0.9f);
    // Stem
    SpawnCylinder(Loc + FVector(0, 0, 20*S), 1.5f*S, 18*S, 6, FLinearColor(0.22f, 0.42f, 0.12f));
}

// DESK: top + legs + drawer
void AEmersynGameMode::SpawnDetailedDesk(FVector Loc, FRotator Rot, FLinearColor TopColor, FLinearColor LegColor, float S)
{
    // Top
    SpawnTexturedBox(Loc + FVector(0, 0, 40*S), FVector(55*S, 30*S, 3*S), ETexturePattern::WoodGrain, TopColor, TopColor * 0.92f);
    // Legs
    SpawnTexturedBox(Loc + FVector(-48*S, -25*S, 20*S), FVector(3*S, 3*S, 20*S), ETexturePattern::Metal, LegColor, LegColor * 0.9f);
    SpawnTexturedBox(Loc + FVector(48*S, -25*S, 20*S), FVector(3*S, 3*S, 20*S), ETexturePattern::Metal, LegColor, LegColor * 0.9f);
    SpawnTexturedBox(Loc + FVector(-48*S, 25*S, 20*S), FVector(3*S, 3*S, 20*S), ETexturePattern::Metal, LegColor, LegColor * 0.9f);
    SpawnTexturedBox(Loc + FVector(48*S, 25*S, 20*S), FVector(3*S, 3*S, 20*S), ETexturePattern::Metal, LegColor, LegColor * 0.9f);
    // Drawer
    SpawnTexturedBox(Loc + FVector(30*S, 0, 30*S), FVector(20*S, 25*S, 8*S), ETexturePattern::WoodGrain, TopColor * 0.9f, TopColor * 0.82f);
    SpawnTexturedBox(Loc + FVector(30*S, -26*S, 30*S), FVector(8*S, 1*S, 1.5f*S), ETexturePattern::Metal, SC::MetalSilver, SC::MetalChrome);
}

// SWING: A-frame + seat + chains
void AEmersynGameMode::SpawnDetailedSwing(FVector Loc, FLinearColor FrameColor, FLinearColor SeatColor, float S)
{
    // Left A-frame
    SpawnTexturedBox(Loc + FVector(-40*S, -5*S, 60*S), FVector(3*S, 5*S, 60*S), ETexturePattern::Metal, FrameColor, FrameColor * 0.9f);
    SpawnTexturedBox(Loc + FVector(-40*S, 5*S, 60*S), FVector(3*S, 5*S, 60*S), ETexturePattern::Metal, FrameColor, FrameColor * 0.9f);
    // Right A-frame
    SpawnTexturedBox(Loc + FVector(40*S, -5*S, 60*S), FVector(3*S, 5*S, 60*S), ETexturePattern::Metal, FrameColor, FrameColor * 0.9f);
    SpawnTexturedBox(Loc + FVector(40*S, 5*S, 60*S), FVector(3*S, 5*S, 60*S), ETexturePattern::Metal, FrameColor, FrameColor * 0.9f);
    // Cross bar
    SpawnTexturedBox(Loc + FVector(0, 0, 120*S), FVector(42*S, 3*S, 3*S), ETexturePattern::Metal, FrameColor, FrameColor * 0.85f);
    // Chains
    SpawnCylinder(Loc + FVector(-8*S, 0, 60*S), 1*S, 60*S, 6, SC::MetalSilver);
    SpawnCylinder(Loc + FVector(8*S, 0, 60*S), 1*S, 60*S, 6, SC::MetalSilver);
    // Seat
    SpawnTexturedBox(Loc + FVector(0, 0, 30*S), FVector(15*S, 8*S, 2*S), ETexturePattern::WoodGrain, SeatColor, SeatColor * 0.9f);
}

// SLIDE: ladder + slide body + platform
void AEmersynGameMode::SpawnDetailedSlide(FVector Loc, FLinearColor SlideColor, FLinearColor LadderColor, float S)
{
    // Platform
    SpawnTexturedBox(Loc + FVector(-20*S, 0, 60*S), FVector(20*S, 20*S, 3*S), ETexturePattern::Metal, LadderColor, LadderColor * 0.9f);
    // Ladder (vertical bars)
    SpawnTexturedBox(Loc + FVector(-38*S, -12*S, 30*S), FVector(2*S, 2*S, 30*S), ETexturePattern::Metal, LadderColor, LadderColor * 0.85f);
    SpawnTexturedBox(Loc + FVector(-38*S, 12*S, 30*S), FVector(2*S, 2*S, 30*S), ETexturePattern::Metal, LadderColor, LadderColor * 0.85f);
    // Rungs
    for (int32 R = 0; R < 4; R++) {
        SpawnTexturedBox(Loc + FVector(-38*S, 0, (10 + R * 14)*S), FVector(1.5f*S, 12*S, 1.5f*S), ETexturePattern::Metal, LadderColor, LadderColor * 0.9f);
    }
    // Slide body (angled)
    SpawnTexturedBox(Loc + FVector(20*S, 0, 32*S), FVector(8*S, 40*S, 2*S), ETexturePattern::Metal, SlideColor, SlideColor * 1.1f);
    // Side rails
    SpawnTexturedBox(Loc + FVector(20*S, -10*S, 38*S), FVector(1.5f*S, 40*S, 5*S), ETexturePattern::Metal, SlideColor * 0.9f, SlideColor * 0.8f);
    SpawnTexturedBox(Loc + FVector(20*S, 10*S, 38*S), FVector(1.5f*S, 40*S, 5*S), ETexturePattern::Metal, SlideColor * 0.9f, SlideColor * 0.8f);
}

// FOUNTAIN: basin + center column + water
void AEmersynGameMode::SpawnDetailedFountain(FVector Loc, FLinearColor StoneColor, FLinearColor WaterColor, float S)
{
    // Base basin
    SpawnCylinder(Loc, 40*S, 12*S, 16, StoneColor, 0.85f);
    // Water in basin
    SpawnCylinder(Loc + FVector(0, 0, 8*S), 36*S, 3*S, 16, WaterColor);
    // Center column
    SpawnCylinder(Loc + FVector(0, 0, 10*S), 8*S, 40*S, 10, StoneColor * 0.95f);
    // Upper bowl
    SpawnCylinder(Loc + FVector(0, 0, 48*S), 18*S, 6*S, 12, StoneColor * 0.98f);
    // Upper water
    SpawnCylinder(Loc + FVector(0, 0, 52*S), 15*S, 2*S, 12, WaterColor * 1.1f);
    // Top piece
    SpawnSphere(Loc + FVector(0, 0, 60*S), 6*S, 8, StoneColor);
}

// BENCH: seat + back + legs
void AEmersynGameMode::SpawnDetailedBench(FVector Loc, FRotator Rot, FLinearColor WoodColor, FLinearColor MetalColor, float S)
{
    // Seat planks
    SpawnTexturedBox(Loc + FVector(0, 0, 25*S), FVector(55*S, 18*S, 3*S), ETexturePattern::WoodGrain, WoodColor, WoodColor * 0.9f);
    // Back planks
    SpawnTexturedBox(Loc + FVector(0, 15*S, 42*S), FVector(55*S, 2*S, 15*S), ETexturePattern::WoodGrain, WoodColor, WoodColor * 0.85f);
    // Metal supports
    SpawnTexturedBox(Loc + FVector(-40*S, 0, 14*S), FVector(3*S, 15*S, 14*S), ETexturePattern::Metal, MetalColor, MetalColor * 0.9f);
    SpawnTexturedBox(Loc + FVector(40*S, 0, 14*S), FVector(3*S, 15*S, 14*S), ETexturePattern::Metal, MetalColor, MetalColor * 0.9f);
    // Back supports
    SpawnTexturedBox(Loc + FVector(-40*S, 15*S, 35*S), FVector(3*S, 3*S, 20*S), ETexturePattern::Metal, MetalColor, MetalColor * 0.9f);
    SpawnTexturedBox(Loc + FVector(40*S, 15*S, 35*S), FVector(3*S, 3*S, 20*S), ETexturePattern::Metal, MetalColor, MetalColor * 0.9f);
}

// ARCADE CABINET: body + screen + controls
void AEmersynGameMode::SpawnDetailedCabinet(FVector Loc, FLinearColor BodyColor, FLinearColor ScreenColor, float S)
{
    // Body
    SpawnTexturedBox(Loc + FVector(0, 0, 55*S), FVector(28*S, 25*S, 55*S), ETexturePattern::Metal, BodyColor, BodyColor * 0.92f);
    // Screen
    SpawnTexturedBox(Loc + FVector(0, -25.5f*S, 72*S), FVector(22*S, 0.5f*S, 18*S), ETexturePattern::Metal, ScreenColor, ScreenColor * 1.2f);
    // Screen bezel
    SpawnTexturedBox(Loc + FVector(0, -26*S, 72*S), FVector(24*S, 0.5f*S, 20*S), ETexturePattern::Metal, FLinearColor(0.05f, 0.05f, 0.05f), FLinearColor(0.1f, 0.1f, 0.1f));
    // Control panel
    SpawnTexturedBox(Loc + FVector(0, -22*S, 48*S), FVector(24*S, 8*S, 2*S), ETexturePattern::Metal, FLinearColor(0.08f, 0.08f, 0.10f), FLinearColor(0.12f, 0.12f, 0.14f));
    // Joystick
    SpawnCylinder(Loc + FVector(-8*S, -22*S, 50*S), 1.5f*S, 8*S, 6, SC::MetalBlack);
    SpawnSphere(Loc + FVector(-8*S, -22*S, 59*S), 3*S, 6, SC::FabricRed);
    // Buttons
    SpawnCylinder(Loc + FVector(5*S, -22*S, 50*S), 2.5f*S, 2*S, 8, SC::FabricRed);
    SpawnCylinder(Loc + FVector(12*S, -22*S, 50*S), 2.5f*S, 2*S, 8, SC::FabricBlue);
}

// COUNTER: top + base + front panel
void AEmersynGameMode::SpawnDetailedCounter(FVector Loc, FLinearColor TopColor, FLinearColor BaseColor, float S)
{
    // Base
    SpawnTexturedBox(Loc + FVector(0, 0, 38*S), FVector(55*S, 25*S, 38*S), ETexturePattern::WoodGrain, BaseColor, BaseColor * 0.9f);
    // Counter top
    SpawnTexturedBox(Loc + FVector(0, 0, 77*S), FVector(57*S, 27*S, 2*S), ETexturePattern::Marble, TopColor, TopColor * 0.95f);
}

// SHELF: wall-mounted shelf
void AEmersynGameMode::SpawnDetailedShelf(FVector Loc, FRotator Rot, FLinearColor Color, float S)
{
    // Shelf board
    SpawnTexturedBox(Loc, FVector(40*S, 12*S, 2*S), ETexturePattern::WoodGrain, Color, Color * 0.9f);
    // Brackets
    SpawnTexturedBox(Loc + FVector(-30*S, 8*S, -8*S), FVector(2*S, 2*S, 8*S), ETexturePattern::Metal, SC::MetalBlack, SC::MetalBlack);
    SpawnTexturedBox(Loc + FVector(30*S, 8*S, -8*S), FVector(2*S, 2*S, 8*S), ETexturePattern::Metal, SC::MetalBlack, SC::MetalBlack);
}

// TREE: trunk + foliage layers
void AEmersynGameMode::SpawnDetailedTree(FVector Loc, FLinearColor TrunkColor, FLinearColor LeafColor, float S)
{
    // Trunk
    SpawnCylinder(Loc, 8*S, 80*S, 8, TrunkColor, 0.8f);
    // Foliage layers (3 spheres)
    SpawnSphere(Loc + FVector(0, 0, 100*S), 40*S, 10, LeafColor);
    SpawnSphere(Loc + FVector(15*S, 10*S, 115*S), 30*S, 8, LeafColor * 1.1f);
    SpawnSphere(Loc + FVector(-10*S, -8*S, 125*S), 25*S, 8, LeafColor * 0.92f);
}

// ============================================================
// ROOM BUILDERS
// ============================================================

void AEmersynGameMode::BuildSplashScreen()
{
    SetLightingPreset(ELightingPreset::Morning);
    SpawnSky();
    SetupPostProcessing();
    SpawnSkyLight(12.f);
    SpawnDirectionalLight(FRotator(-50.f, 150.f, 0.f), 35.f, FLinearColor(1.f, 0.95f, 0.82f));
    SpawnTexturedFloor(FVector::ZeroVector, FVector(800, 600, 0), ETexturePattern::Grass, SC::FloorGrass, SC::FloorGrassDark, 3.f);

    SpawnWorldText(TEXT("Emersyn's Big Day"), FVector(0, 0, 250), 80.f, FLinearColor(1.f, 0.85f, 0.2f));
    SpawnWorldText(TEXT("Tap to Play!"), FVector(0, 0, 150), 40.f, FLinearColor(1.f, 1.f, 1.f));

    // Decorative scene
    SpawnDetailedTree(FVector(-350, 200, 0), SC::WoodMedium, SC::PlantGreen, 1.5f);
    SpawnDetailedTree(FVector(400, 250, 0), SC::WoodDark, SC::PlantDark, 1.2f);
    SpawnDetailedFountain(FVector(0, 80, 0), SC::MarbleWhite, SC::WaterBlue, 1.8f);
    SpawnDetailedBench(FVector(-180, -100, 0), FRotator::ZeroRotator, SC::WoodLight, SC::MetalBlack, 1.2f);
    SpawnDetailedBench(FVector(180, -100, 0), FRotator::ZeroRotator, SC::WoodLight, SC::MetalBlack, 1.2f);
    SpawnDetailedPlant(FVector(-100, 200, 0), SC::BrickRed, SC::PlantGreen, 1.5f);
    SpawnDetailedPlant(FVector(100, 200, 0), SC::MetalCopper, SC::PlantDark, 1.5f);

    SpawnCharacterMesh(TEXT("Emersyn"), FVector(0, -60, 0), FRotator(0, 0, 0), 4.0f, FLinearColor(0.92f, 0.75f, 0.60f), SC::FabricPink);
    SpawnCharacterMesh(TEXT("Cat"), FVector(80, -30, 0), FRotator(0, -30, 0), 2.0f, FLinearColor(0.85f, 0.65f, 0.45f), FLinearColor(0.85f, 0.65f, 0.45f));
    SpawnCharacterMesh(TEXT("Dog"), FVector(-80, -30, 0), FRotator(0, 30, 0), 2.2f, FLinearColor(0.75f, 0.55f, 0.35f), FLinearColor(0.75f, 0.55f, 0.35f));

    SetupAutoCamera(FVector(800, 600, 250));  // v31: auto-scaling for splash scene
}

void AEmersynGameMode::BuildMainMenu()
{
    BuildSplashScreen(); // Reuse splash for now
}

void AEmersynGameMode::BuildBedroom()
{
    // v49: Ultra-short walls (15u), huge furniture (FS 3.0) for true dollhouse proportions
    FVector RS(450.f, 400.f, 15.f);  // v49: walls are barely-visible borders
    float FS = 3.0f;  // v49: large furniture clearly visible from overhead
    BuildRoomShell(RS, ETexturePattern::WoodGrain, SC::WoodMaple, SC::WoodOak,
        ETexturePattern::Wallpaper, SC::WallCream, SC::WallPink,
        SC::CeilingWhite, ELightingPreset::Morning, TEXT("Bedroom"));

    // v47: Bed — large, centered in room
    SpawnDetailedBed(FVector(0, 100, 0), SC::WoodOak, SC::FabricPink, FLinearColor::White, FS);
    // v47: Dresser against back wall
    SpawnDetailedDresser(FVector(-250, 280, 0), SC::WoodOak, SC::MetalGold, FS);
    // v47: Lamp on dresser
    SpawnDetailedLamp(FVector(-250, 280, 50*FS), SC::MetalGold, SC::FabricCream, FS);
    // v47: Bookshelf against left wall
    SpawnDetailedBookshelf(FVector(-320, 0, 0), FRotator(0, 90, 0), SC::WoodOak, FS);
    // v47: Desk with chair
    SpawnDetailedDesk(FVector(200, -100, 0), FRotator::ZeroRotator, SC::WoodMaple, SC::WoodMedium, FS);
    SpawnDetailedChair(FVector(200, -200, 0), FRotator::ZeroRotator, SC::FabricPink, SC::WoodMaple, FS);
    // v47: Rug under bed area
    SpawnDetailedRug(FVector(0, 50, 0), SC::FabricLavender, SC::FabricPurple, FVector(300, 250, 0));
    // v47: Plant in corner
    SpawnDetailedPlant(FVector(300, 280, 0), SC::FabricCream, SC::PlantGreen, FS);
    // v47: Window on back wall
    SpawnWindowFrame(FVector(-RS.X, RS.Y, 0), FVector(RS.X, RS.Y, 0), RS.Z, RS.Z*0.3f, RS.Z*0.5f, RS.Z*0.4f, SC::WoodLight, SC::GlassBlue);
    // v47: Character
    SpawnCharacterMesh(TEXT("Emersyn"), FVector(100, -50, 0), FRotator(0, -90, 0), FS * 2.0f, FLinearColor(0.88f, 0.70f, 0.52f), SC::FabricPink);

    SetupAutoCamera(RS);
}

void AEmersynGameMode::BuildKitchen()
{
    // v49: Ultra-short walls (15u), FS=3.0
    FVector RS(480.f, 420.f, 15.f);
    float FS = 3.0f;
    BuildRoomShell(RS, ETexturePattern::TileGrid, SC::TileWhite, SC::FloorConcrete,
        ETexturePattern::TileGrid, SC::TileWhite, SC::TileMint, SC::CeilingWhite,
        ELightingPreset::Morning, TEXT("Kitchen"));

    // v38: Furniture spread to center/front
    SpawnDetailedFridge(FVector(-150, -100, 0), SC::MetalChrome, SC::MetalSilver, FS);  // front-left
    SpawnDetailedStove(FVector(-150, 100, 0), SC::MetalChrome, FS);  // left-center
    SpawnDetailedCounter(FVector(0, 250, 0), SC::MarbleWhite, SC::WoodOak, FS);  // near back wall
    SpawnDetailedCounter(FVector(180, 250, 0), SC::MarbleWhite, SC::WoodOak, FS);
    SpawnDetailedSink(FVector(-100, 250, 0), SC::MetalChrome, SC::MetalSilver, FS);
    SpawnDetailedTable(FVector(80, -30, 0), SC::WoodMaple, SC::WoodMedium, FS);  // center
    SpawnDetailedChair(FVector(-20, -30, 0), FRotator(0, 90, 0), SC::FabricSage, SC::WoodMaple, FS);
    SpawnDetailedChair(FVector(180, -30, 0), FRotator(0, -90, 0), SC::FabricSage, SC::WoodMaple, FS);
    SpawnDetailedChair(FVector(80, -130, 0), FRotator::ZeroRotator, SC::FabricSage, SC::WoodMaple, FS);  // front
    SpawnDetailedChair(FVector(80, 70, 0), FRotator(0, 180, 0), SC::FabricSage, SC::WoodMaple, FS);
    SpawnDetailedShelf(FVector(-200, 200, RS.Z*0.7f), FRotator::ZeroRotator, SC::WoodOak, FS);
    SpawnDetailedPlant(FVector(250, 200, 0), SC::FabricCream, SC::PlantGreen, FS);
    SpawnDetailedRug(FVector(80, -30, 0), SC::FabricCream, SC::FabricSage, FVector(180, 140, 0));
    SpawnWindowFrame(FVector(-RS.X, RS.Y, 0), FVector(RS.X, RS.Y, 0), RS.Z, RS.Z*0.3f, RS.Z*0.5f, RS.Z*0.4f, SC::WoodLight, SC::GlassBlue);

    SpawnCharacterMesh(TEXT("Mia"), FVector(50, -80, 0), FRotator(0, -90, 0), FS * 2.0f, FLinearColor(0.88f, 0.70f, 0.52f), SC::FabricGreen);  // front
    SetupAutoCamera(RS);
}

void AEmersynGameMode::BuildBathroom()
{
    // v49: Ultra-short walls (15u), FS=3.0
    FVector RS(380.f, 350.f, 15.f);
    float FS = 3.0f;
    BuildRoomShell(RS, ETexturePattern::TileGrid, SC::TileWhite, SC::TileBlue,
        ETexturePattern::TileGrid, SC::TileWhite, SC::TileMint, SC::CeilingWhite,
        ELightingPreset::Day, TEXT("Bathroom"));

    // v38: Furniture spread to center/front
    SpawnDetailedBathtub(FVector(50, 50, 0), SC::MarbleWhite, SC::MetalGold, FS);  // center
    SpawnDetailedToilet(FVector(-100, -80, 0), FRotator::ZeroRotator, SC::MarbleWhite, FS);  // front-left
    SpawnDetailedSink(FVector(-100, 150, 0), SC::MetalChrome, SC::MetalSilver, FS);  // back-left
    SpawnDetailedMirror(FVector(-100, 280, 30*FS), FRotator::ZeroRotator, SC::MetalChrome, FS);  // on back wall
    SpawnDetailedRug(FVector(50, -30, 0), SC::FabricMint, SC::TileWhite, FVector(120, 80, 0));  // center-front
    SpawnDetailedShelf(FVector(-150, 200, RS.Z*0.7f), FRotator::ZeroRotator, SC::MetalChrome, FS);
    SpawnDetailedPlant(FVector(150, 150, 0), SC::FabricCream, SC::PlantGreen, FS);
    SpawnWindowFrame(FVector(-RS.X, RS.Y, 0), FVector(RS.X, RS.Y, 0), RS.Z, RS.Z*0.3f, RS.Z*0.5f, RS.Z*0.4f, SC::WoodLight, SC::GlassBlue);

    SpawnCharacterMesh(TEXT("Emersyn"), FVector(100, -100, 0), FRotator(0, 0, 0), FS * 2.0f, FLinearColor(0.92f, 0.75f, 0.60f), SC::FabricBlue);  // front
    SetupAutoCamera(RS);
}

void AEmersynGameMode::BuildLivingRoom()
{
    // v49: Ultra-short walls (15u), FS=3.0
    FVector RS(520.f, 450.f, 15.f);
    float FS = 3.0f;
    BuildRoomShell(RS, ETexturePattern::WoodGrain, SC::FloorWood, SC::WoodMedium,
        ETexturePattern::Wallpaper, SC::WallCream, SC::WPStripe1, SC::CeilingWhite,
        ELightingPreset::Sunset, TEXT("Living Room"));

    SpawnDetailedSofa(FVector(100, -50, 0), FRotator::ZeroRotator, SC::FabricNavy, SC::FabricCream, SC::WoodDark, FS);
    SpawnDetailedTable(FVector(100, -200, 0), SC::WoodWalnut, SC::MetalGold, FS);
    SpawnDetailedTV(FVector(-50, 350, 0), FRotator::ZeroRotator, SC::MetalBlack, FS);
    SpawnDetailedBookshelf(FVector(-420, 150, 0), FRotator::ZeroRotator, SC::WoodWalnut, FS * 0.7f);
    SpawnDetailedLamp(FVector(350, -20, 0), SC::MetalBrass, SC::FabricCream, FS);
    SpawnDetailedRug(FVector(100, -120, 0), SC::CarpetBeige, SC::WoodDark, FVector(250, 180, 0));
    SpawnDetailedPlant(FVector(420, 350, 0), SC::FabricCream, SC::PlantGreen, FS);
    SpawnDetailedPlant(FVector(-420, -100, 0), SC::MetalCopper, SC::PlantDark, FS);
    SpawnPictureFrame(FVector(250, 420, 50*FS), FRotator::ZeroRotator, FVector(50*FS, 3, 35*FS), SC::MetalGold, SC::FabricCoral);
    SpawnPictureFrame(FVector(-250, 420, 55*FS), FRotator::ZeroRotator, FVector(40*FS, 3, 48*FS), SC::WoodDark, SC::FabricBlue);
    SpawnDetailedTable(FVector(-300, -50, 0), SC::WoodDark, SC::MetalGold, FS);
    SpawnDetailedLamp(FVector(-300, -50, 35*FS), SC::MetalGold, SC::FabricLavender, FS * 0.7f);
    SpawnWindowFrame(FVector(-RS.X, RS.Y, 0), FVector(RS.X, RS.Y, 0), RS.Z, RS.Z*0.3f, RS.Z*0.5f, RS.Z*0.4f, SC::WoodMedium, SC::GlassBlue);

    SpawnCharacterMesh(TEXT("Emersyn"), FVector(-100, -100, 0), FRotator(0, 45, 0), FS * 2.0f, FLinearColor(0.92f, 0.75f, 0.60f), SC::FabricCoral);
    SpawnCharacterMesh(TEXT("Ava"), FVector(200, -250, 0), FRotator(0, 120, 0), FS * 2.0f, FLinearColor(0.88f, 0.70f, 0.52f), SC::FabricPurple);
    SetupAutoCamera(RS);
}

void AEmersynGameMode::BuildGarden()
{
    FVector RS(600.f, 500.f, 15.f);  // v49: ultra-short fence posts
    SetLightingPreset(ELightingPreset::Day);
    // v44: NO sky dome
    // SpawnSky();
    SetupPostProcessing();
    SpawnSkyLight(12.f);
    SpawnDirectionalLight(FRotator(-45.f, -90.f, 0.f), 35.f, LightKeyColor);
    // v44: neutral background plane
    SpawnTexturedFloor(FVector(0.f, 0.f, -10.f), FVector(RS.X * 3.f, RS.Y * 3.f, 0), ETexturePattern::Concrete, FLinearColor(0.85f, 0.87f, 0.90f), FLinearColor(0.82f, 0.84f, 0.87f), 1.f);

    SpawnTexturedFloor(FVector::ZeroVector, FVector(RS.X, RS.Y, 0), ETexturePattern::Grass, SC::FloorGrass, SC::FloorGrassDark, 3.f);
    SpawnRoomLighting(FVector(0, 0, RS.Z * 0.5f), RS);
    SpawnRoomLabel(TEXT("Garden"));

    // Fence around back and left sides (procedural fence posts + rails)
    for (int32 I = 0; I < 12; I++) {
        float FX = -RS.X + I * (2.f * RS.X / 11.f);
        SpawnCylinder(FVector(FX, RS.Y, 0), 3.f, 60.f, 6, SC::WoodLight, 0.85f);
    }
    SpawnTexturedBox(FVector(0, RS.Y, 50), FVector(RS.X, 2, 3), ETexturePattern::WoodGrain, SC::WoodMedium, SC::WoodLight);
    SpawnTexturedBox(FVector(0, RS.Y, 25), FVector(RS.X, 2, 3), ETexturePattern::WoodGrain, SC::WoodMedium, SC::WoodLight);

    // Trees
    SpawnDetailedTree(FVector(-350, 300, 0), SC::WoodMedium, SC::PlantGreen, 1.5f);
    SpawnDetailedTree(FVector(300, 350, 0), SC::WoodDark, SC::PlantDark, 1.8f);
    SpawnDetailedTree(FVector(-100, 400, 0), SC::WoodOak, SC::PlantGreen, 1.3f);

    // Flower beds (using plants)
    SpawnDetailedPlant(FVector(-200, 200, 0), SC::BrickRed, SC::FabricPink, 1.2f);
    SpawnDetailedPlant(FVector(-100, 200, 0), SC::BrickRed, SC::FabricYellow, 1.2f);
    SpawnDetailedPlant(FVector(0, 200, 0), SC::BrickRed, SC::FabricPurple, 1.2f);
    SpawnDetailedPlant(FVector(100, 200, 0), SC::BrickRed, SC::FabricRed, 1.2f);

    // Bench
    SpawnDetailedBench(FVector(200, -100, 0), FRotator::ZeroRotator, SC::WoodLight, SC::MetalBlack, 1.2f);
    // Fountain
    SpawnDetailedFountain(FVector(-200, -150, 0), SC::MarbleWhite, SC::WaterBlue, 1.0f);
    // Path stones (flat boxes)
    for (int32 I = 0; I < 5; I++) {
        SpawnTexturedBox(FVector(-200 + I * 100.f, -50, 1), FVector(25, 20, 2), ETexturePattern::Concrete, SC::FloorConcrete, SC::MarbleVein);
    }

    SpawnCharacterMesh(TEXT("Emersyn"), FVector(0, -100, 0), FRotator(0, 15, 0), 3.0f, FLinearColor(0.92f, 0.75f, 0.60f), SC::FabricYellow);
    SpawnCharacterMesh(TEXT("Dog"), FVector(120, -60, 0), FRotator(0, -45, 0), 2.0f, FLinearColor(0.75f, 0.55f, 0.35f), FLinearColor(0.75f, 0.55f, 0.35f));
    SetupAutoCamera(RS);  // v31: auto-scaling camera
}

void AEmersynGameMode::BuildSchool()
{
    // v49: Ultra-short walls (15u), FS=3.0
    FVector RS(480.f, 420.f, 15.f);
    float FS = 3.0f;
    BuildRoomShell(RS, ETexturePattern::WoodGrain, SC::FloorWood, SC::WoodLight,
        ETexturePattern::Wallpaper, SC::WallYellow, SC::WallCream, SC::CeilingWhite,
        ELightingPreset::Morning, TEXT("School"));

    SpawnDetailedDesk(FVector(0, 300, 0), FRotator::ZeroRotator, SC::WoodOak, SC::MetalBlack, FS);
    SpawnTexturedBox(FVector(0, 380, RS.Z*0.7f), FVector(120*FS, 3, 60*FS), ETexturePattern::Concrete, FLinearColor(0.15f, 0.32f, 0.18f), FLinearColor(0.10f, 0.25f, 0.12f));
    SpawnTexturedBox(FVector(0, 378, RS.Z*0.7f), FVector(125*FS, 2, 65*FS), ETexturePattern::WoodGrain, SC::WoodDark, SC::WoodEbony);
    SpawnDetailedDesk(FVector(-200, -50, 0), FRotator::ZeroRotator, SC::WoodMaple, SC::MetalBlack, FS);
    SpawnDetailedDesk(FVector(0, -50, 0), FRotator::ZeroRotator, SC::WoodMaple, SC::MetalBlack, FS);
    SpawnDetailedDesk(FVector(200, -50, 0), FRotator::ZeroRotator, SC::WoodMaple, SC::MetalBlack, FS);
    SpawnDetailedDesk(FVector(-200, -200, 0), FRotator::ZeroRotator, SC::WoodMaple, SC::MetalBlack, FS);
    SpawnDetailedDesk(FVector(0, -200, 0), FRotator::ZeroRotator, SC::WoodMaple, SC::MetalBlack, FS);
    SpawnDetailedDesk(FVector(200, -200, 0), FRotator::ZeroRotator, SC::WoodMaple, SC::MetalBlack, FS);
    SpawnDetailedChair(FVector(-200, -110, 0), FRotator(0, 180, 0), SC::FabricBlue, SC::MetalBlack, FS);
    SpawnDetailedChair(FVector(0, -110, 0), FRotator(0, 180, 0), SC::FabricBlue, SC::MetalBlack, FS);
    SpawnDetailedChair(FVector(200, -110, 0), FRotator(0, 180, 0), SC::FabricBlue, SC::MetalBlack, FS);
    SpawnDetailedChair(FVector(-200, -260, 0), FRotator(0, 180, 0), SC::FabricBlue, SC::MetalBlack, FS);
    SpawnDetailedChair(FVector(0, -260, 0), FRotator(0, 180, 0), SC::FabricBlue, SC::MetalBlack, FS);
    SpawnDetailedChair(FVector(200, -260, 0), FRotator(0, 180, 0), SC::FabricBlue, SC::MetalBlack, FS);
    SpawnDetailedBookshelf(FVector(-400, 100, 0), FRotator::ZeroRotator, SC::WoodOak, FS * 0.65f);
    SpawnTexturedBox(FVector(350, -200, 12*FS), FVector(10*FS, 6*FS, 14*FS), ETexturePattern::Fabric, SC::FabricRed, SC::FabricBlue);
    SpawnDetailedPlant(FVector(380, 350, 0), SC::FabricCream, SC::PlantGreen, FS);
    SpawnWindowFrame(FVector(-RS.X, RS.Y, 0), FVector(RS.X, RS.Y, 0), RS.Z, RS.Z*0.3f, RS.Z*0.5f, RS.Z*0.4f, SC::WoodLight, SC::GlassBlue);

    SpawnCharacterMesh(TEXT("Leo"), FVector(-100, 200, 0), FRotator(0, 180, 0), FS * 2.0f, FLinearColor(0.65f, 0.45f, 0.30f), SC::FabricBlue);
    SpawnCharacterMesh(TEXT("Emersyn"), FVector(100, -100, 0), FRotator(0, 0, 0), FS * 2.0f, FLinearColor(0.92f, 0.75f, 0.60f), SC::FabricPink);
    SetupAutoCamera(RS);
}

void AEmersynGameMode::BuildShop()
{
    // v49: Ultra-short walls (15u), FS=3.0
    FVector RS(500.f, 440.f, 15.f);
    float FS = 3.0f;
    BuildRoomShell(RS, ETexturePattern::TileGrid, SC::FloorTile, SC::FloorConcrete,
        ETexturePattern::Wallpaper, SC::WallPeach, SC::FabricCream, SC::CeilingWhite,
        ELightingPreset::Day, TEXT("Shop"));

    SpawnDetailedCounter(FVector(0, -200, 0), SC::MarbleWhite, SC::WoodOak, FS);
    SpawnTexturedBox(FVector(0, -170, 40*FS), FVector(15*FS, 12*FS, 10*FS), ETexturePattern::Metal, SC::MetalBlack, SC::MetalSilver);
    SpawnDetailedBookshelf(FVector(-300, 350, 0), FRotator::ZeroRotator, SC::WoodMaple, FS * 0.65f);
    SpawnDetailedBookshelf(FVector(-100, 350, 0), FRotator::ZeroRotator, SC::WoodMaple, FS * 0.65f);
    SpawnDetailedBookshelf(FVector(100, 350, 0), FRotator::ZeroRotator, SC::WoodMaple, FS * 0.65f);
    SpawnDetailedBookshelf(FVector(300, 350, 0), FRotator::ZeroRotator, SC::WoodMaple, FS * 0.65f);
    SpawnDetailedTable(FVector(0, 50, 0), SC::WoodLight, SC::WoodMedium, FS);
    SpawnDetailedPlant(FVector(400, 350, 0), SC::FabricCream, SC::PlantGreen, FS);
    SpawnDetailedPlant(FVector(-420, -100, 0), SC::MetalCopper, SC::PlantDark, FS);
    SpawnDetailedShelf(FVector(-430, 50, RS.Z*0.7f), FRotator::ZeroRotator, SC::WoodOak, FS);
    SpawnDetailedRug(FVector(0, 50, 0), SC::FabricCream, SC::FabricPeach, FVector(180, 140, 0));

    SpawnCharacterMesh(TEXT("Emersyn"), FVector(0, -100, 0), FRotator(0, 180, 0), FS * 2.0f, FLinearColor(0.92f, 0.75f, 0.60f), SC::FabricPurple);
    SetupAutoCamera(RS);
}

void AEmersynGameMode::BuildPlayground()
{
    FVector RS(550.f, 480.f, 15.f);  // v49: ultra-short for dollhouse
    SetLightingPreset(ELightingPreset::Day);
    // v44: NO sky dome
    // SpawnSky();
    SetupPostProcessing();
    SpawnSkyLight(12.f);
    SpawnDirectionalLight(FRotator(-45.f, -90.f, 0.f), 32.f, LightKeyColor);
    // v44: neutral background plane
    SpawnTexturedFloor(FVector(0.f, 0.f, -10.f), FVector(RS.X * 3.f, RS.Y * 3.f, 0), ETexturePattern::Concrete, FLinearColor(0.85f, 0.87f, 0.90f), FLinearColor(0.82f, 0.84f, 0.87f), 1.f);

    SpawnTexturedFloor(FVector::ZeroVector, FVector(RS.X, RS.Y, 0), ETexturePattern::Sand, SC::FloorSand, SC::FabricYellow, 2.f);
    SpawnRoomLighting(FVector(0, 0, RS.Z * 0.5f), RS);
    SpawnRoomLabel(TEXT("Playground"));

    // v49: Ultra-short brick border
    SpawnTexturedWall(FVector(-RS.X, RS.Y, 0), FVector(RS.X, RS.Y, 0), 15.f, ETexturePattern::Brick, SC::BrickRed, SC::BrickMortar);
    SpawnTexturedWall(FVector(-RS.X, -RS.Y, 0), FVector(-RS.X, RS.Y, 0), 15.f, ETexturePattern::Brick, SC::BrickRed, SC::BrickMortar);

    // Swing set
    SpawnDetailedSwing(FVector(-200, 100, 0), SC::MetalSilver, SC::WoodOak, 1.3f);
    // Slide
    SpawnDetailedSlide(FVector(200, 150, 0), SC::FabricRed, SC::FabricYellow, 1.3f);
    // Sandbox (procedural: wooden frame + sand fill)
    SpawnTexturedBox(FVector(0, -150, 8), FVector(60, 60, 8), ETexturePattern::Sand, SC::FloorSand, SC::FabricYellow);
    SpawnTexturedBox(FVector(0, -150, 4), FVector(65, 65, 4), ETexturePattern::WoodGrain, SC::WoodLight, SC::WoodMedium);
    // Sand toys
    SpawnCylinder(FVector(-20, -140, 16), 5, 8, 8, SC::FabricRed);
    SpawnCylinder(FVector(15, -160, 16), 4, 6, 8, SC::FabricBlue);
    // Bench for parents
    SpawnDetailedBench(FVector(-350, -200, 0), FRotator::ZeroRotator, SC::WoodLight, SC::MetalBlack, 1.0f);
    // Tree
    SpawnDetailedTree(FVector(350, -200, 0), SC::WoodMedium, SC::PlantGreen, 1.5f);
    // Plants
    SpawnDetailedPlant(FVector(-400, 350, 0), SC::BrickRed, SC::PlantGreen, 1.2f);

    SpawnCharacterMesh(TEXT("Emersyn"), FVector(0, 0, 0), FRotator::ZeroRotator, 3.0f, FLinearColor(0.92f, 0.75f, 0.60f), SC::FabricOrange);
    SpawnCharacterMesh(TEXT("Leo"), FVector(-150, -80, 0), FRotator(0, 60, 0), 3.0f, FLinearColor(0.65f, 0.45f, 0.30f), SC::FabricGreen);
    SetupAutoCamera(RS);  // v31: auto-scaling camera
}

void AEmersynGameMode::BuildPark()
{
    FVector RS(650.f, 550.f, 15.f);  // v49: ultra-short for dollhouse
    SetLightingPreset(ELightingPreset::Sunset);
    // v44: NO sky dome
    // SpawnSky();
    SetupPostProcessing();
    SpawnSkyLight(10.f);
    SpawnDirectionalLight(FRotator(-45.f, -90.f, 0.f), 28.f, LightKeyColor);
    // v44: neutral background plane
    SpawnTexturedFloor(FVector(0.f, 0.f, -10.f), FVector(RS.X * 3.f, RS.Y * 3.f, 0), ETexturePattern::Concrete, FLinearColor(0.85f, 0.87f, 0.90f), FLinearColor(0.82f, 0.84f, 0.87f), 1.f);

    SpawnTexturedFloor(FVector::ZeroVector, FVector(RS.X, RS.Y, 0), ETexturePattern::Grass, SC::FloorGrass, SC::FloorGrassDark, 3.f);
    SpawnRoomLighting(FVector(0, 0, RS.Z * 0.5f), RS);
    SpawnRoomLabel(TEXT("Park"));

    // Trees
    SpawnDetailedTree(FVector(-400, 350, 0), SC::WoodMedium, SC::PlantGreen, 2.0f);
    SpawnDetailedTree(FVector(350, 400, 0), SC::WoodDark, SC::PlantDark, 1.8f);
    SpawnDetailedTree(FVector(-200, -300, 0), SC::WoodOak, SC::PlantGreen, 1.5f);
    // Fountain center
    SpawnDetailedFountain(FVector(0, 0, 0), SC::MarbleWhite, SC::WaterBlue, 1.5f);
    // Benches
    SpawnDetailedBench(FVector(-250, -100, 0), FRotator::ZeroRotator, SC::WoodLight, SC::MetalBlack, 1.2f);
    SpawnDetailedBench(FVector(250, -100, 0), FRotator::ZeroRotator, SC::WoodLight, SC::MetalBlack, 1.2f);
    // Lamp posts (procedural: pole + globe + light)
    SpawnCylinder(FVector(-350, 0, 0), 4, 120, 8, SC::MetalBlack, 0.9f);
    SpawnSphere(FVector(-350, 0, 125), 12, 8, SC::MetalGold);
    SpawnLight(FVector(-350, 0, 130), 8.f, FLinearColor(1.0f, 0.92f, 0.72f), 350.f);
    SpawnCylinder(FVector(350, 0, 0), 4, 120, 8, SC::MetalBlack, 0.9f);
    SpawnSphere(FVector(350, 0, 125), 12, 8, SC::MetalGold);
    SpawnLight(FVector(350, 0, 130), 8.f, FLinearColor(1.0f, 0.92f, 0.72f), 350.f);
    // Path
    for (int32 I = 0; I < 8; I++) {
        SpawnTexturedBox(FVector(-350 + I * 100.f, -200, 1), FVector(30, 25, 2), ETexturePattern::Concrete, SC::FloorConcrete, SC::MarbleVein);
    }
    // Flower beds
    SpawnDetailedPlant(FVector(150, 250, 0), SC::BrickRed, SC::FabricPink, 1.0f);
    SpawnDetailedPlant(FVector(-150, 250, 0), SC::BrickRed, SC::FabricYellow, 1.0f);

    SpawnCharacterMesh(TEXT("Emersyn"), FVector(-50, -150, 0), FRotator(0, 30, 0), 3.0f, FLinearColor(0.92f, 0.75f, 0.60f), SC::FabricGreen);
    SpawnCharacterMesh(TEXT("Cat"), FVector(80, -120, 0), FRotator(0, -60, 0), 1.5f, FLinearColor(0.85f, 0.65f, 0.45f), FLinearColor(0.85f, 0.65f, 0.45f));
    SetupAutoCamera(RS);  // v31: auto-scaling camera
}

void AEmersynGameMode::BuildMall()
{
    // v49: Ultra-short walls (15u), FS=3.0
    FVector RS(550.f, 480.f, 15.f);
    float FS = 3.0f;
    BuildRoomShell(RS, ETexturePattern::Marble, SC::FloorMarble, SC::MarbleVein,
        ETexturePattern::Wallpaper, SC::WallCream, SC::FabricCream, SC::CeilingWhite,
        ELightingPreset::Day, TEXT("Mall"));

    // Escalator (scaled to room)
    SpawnTexturedBox(FVector(0, 0, 30*FS), FVector(40*FS, 120*FS, 5*FS), ETexturePattern::Metal, SC::MetalSilver, SC::MetalBlack);
    SpawnTexturedBox(FVector(-42*FS, 0, 35*FS), FVector(3*FS, 120*FS, 30*FS), ETexturePattern::Metal, SC::MetalBlack, SC::MetalSilver);
    SpawnTexturedBox(FVector(42*FS, 0, 35*FS), FVector(3*FS, 120*FS, 30*FS), ETexturePattern::Metal, SC::MetalBlack, SC::MetalSilver);
    for (int32 I = 0; I < 8; I++) {
        float SY = (-100.f + I * 28.f) * FS;
        float SZ = (20.f + I * 10.f) * FS;
        SpawnTexturedBox(FVector(0, SY, SZ), FVector(38*FS, 10*FS, 2*FS), ETexturePattern::Metal, SC::MetalSilver * 0.9f, SC::MetalChrome);
    }
    SpawnDetailedPlant(FVector(-300, -200, 0), SC::MarbleWhite, SC::PlantGreen, FS);
    SpawnDetailedPlant(FVector(300, -200, 0), SC::MarbleWhite, SC::PlantDark, FS);
    SpawnDetailedPlant(FVector(-300, 200, 0), SC::MarbleWhite, SC::PlantGreen, FS);
    SpawnDetailedPlant(FVector(300, 200, 0), SC::MarbleWhite, SC::PlantDark, FS);
    SpawnDetailedBench(FVector(-200, -50, 0), FRotator::ZeroRotator, SC::WoodMaple, SC::MetalChrome, FS);
    SpawnDetailedBench(FVector(200, -50, 0), FRotator::ZeroRotator, SC::WoodMaple, SC::MetalChrome, FS);
    SpawnDetailedCounter(FVector(-400, 100, 0), SC::MarbleWhite, SC::WoodMaple, FS);
    SpawnDetailedShelf(FVector(-400, 350, RS.Z*0.6f), FRotator::ZeroRotator, SC::WoodMaple, FS);
    SpawnDetailedShelf(FVector(-400, 350, RS.Z*0.8f), FRotator::ZeroRotator, SC::WoodMaple, FS);
    SpawnDetailedLamp(FVector(400, 350, 0), SC::MetalChrome, SC::FabricCream, FS);

    SpawnCharacterMesh(TEXT("Ava"), FVector(100, -150, 0), FRotator(0, -90, 0), FS * 2.0f, FLinearColor(0.88f, 0.70f, 0.52f), SC::FabricPurple);
    SpawnCharacterMesh(TEXT("Mia"), FVector(-100, -100, 0), FRotator(0, 45, 0), FS * 2.0f, FLinearColor(0.88f, 0.70f, 0.52f), SC::FabricTeal);
    SetupAutoCamera(RS);
}

void AEmersynGameMode::BuildArcade()
{
    // v49: Ultra-short walls (15u), FS=3.0
    FVector RS(450.f, 400.f, 15.f);
    float FS = 3.0f;
    BuildRoomShell(RS, ETexturePattern::Concrete, SC::FloorConcrete, SC::MetalBlack,
        ETexturePattern::Brick, SC::MetalBlack, SC::FabricPurple, SC::MetalBlack,
        ELightingPreset::Party, TEXT("Arcade"));

    SpawnDetailedCabinet(FVector(-200, 250, 0), SC::FabricBlue, FLinearColor(0.2f, 0.8f, 0.2f), FS);
    SpawnDetailedCabinet(FVector(0, 250, 0), SC::FabricRed, FLinearColor(0.2f, 0.2f, 0.9f), FS);
    SpawnDetailedCabinet(FVector(200, 250, 0), SC::FabricPurple, FLinearColor(0.9f, 0.9f, 0.1f), FS);
    SpawnTexturedBox(FVector(-300, 0, 40*FS), FVector(30*FS, 25*FS, 40*FS), ETexturePattern::Metal, SC::FabricYellow, SC::FabricGreen);
    SpawnTexturedBox(FVector(-300, 0, 82*FS), FVector(28*FS, 23*FS, 3*FS), ETexturePattern::Metal, SC::FabricYellow * 0.9f, SC::FabricGreen * 0.9f);
    SpawnTexturedBox(FVector(-300, 0, 55*FS), FVector(26*FS, 21*FS, 25*FS), ETexturePattern::Metal, SC::GlassBlue, FLinearColor(0.8f, 0.9f, 1.0f, 0.5f));
    SpawnSphere(FVector(-310, -5, 10*FS), 5*FS, 6, SC::FabricPink);
    SpawnSphere(FVector(-295, 5, 10*FS), 5*FS, 6, SC::FabricBlue);
    SpawnSphere(FVector(-305, 8, 10*FS), 4*FS, 6, SC::FabricYellow);
    SpawnDetailedCounter(FVector(300, 0, 0), SC::MetalBlack, SC::WoodDark, FS);
    SpawnDetailedTable(FVector(0, -150, 0), SC::WoodDark, SC::MetalBlack, FS);
    SpawnDetailedChair(FVector(-60, -150, 0), FRotator(0, 90, 0), SC::FabricRed, SC::MetalBlack, FS);
    SpawnDetailedChair(FVector(60, -150, 0), FRotator(0, -90, 0), SC::FabricBlue, SC::MetalBlack, FS);
    SpawnLight(FVector(-200, 0, RS.Z), 15.f, FLinearColor(1.0f, 0.1f, 0.8f), 400.f);
    SpawnLight(FVector(200, 0, RS.Z), 15.f, FLinearColor(0.1f, 0.8f, 1.0f), 400.f);

    SpawnCharacterMesh(TEXT("Emersyn"), FVector(0, -50, 0), FRotator(0, 0, 0), FS * 2.0f, FLinearColor(0.92f, 0.75f, 0.60f), SC::FabricHotPink);
    SpawnCharacterMesh(TEXT("Leo"), FVector(-150, 100, 0), FRotator(0, 180, 0), FS * 2.0f, FLinearColor(0.65f, 0.45f, 0.30f), SC::FabricNavy);
    SetupAutoCamera(RS);
}

void AEmersynGameMode::BuildAmusementPark()
{
    FVector RS(700.f, 600.f, 15.f);  // v49: ultra-short for dollhouse
    SetLightingPreset(ELightingPreset::Sunset);
    // v44: NO sky dome
    // SpawnSky();
    SetupPostProcessing();
    SpawnSkyLight(10.f);
    SpawnDirectionalLight(FRotator(-45.f, -90.f, 0.f), 28.f, LightKeyColor);
    // v44: neutral background plane
    SpawnTexturedFloor(FVector(0.f, 0.f, -10.f), FVector(RS.X * 3.f, RS.Y * 3.f, 0), ETexturePattern::Concrete, FLinearColor(0.85f, 0.87f, 0.90f), FLinearColor(0.82f, 0.84f, 0.87f), 1.f);

    SpawnTexturedFloor(FVector::ZeroVector, FVector(RS.X, RS.Y, 0), ETexturePattern::Concrete, SC::FloorConcrete, SC::FloorSand, 2.f);
    SpawnRoomLighting(FVector(0, 0, RS.Z * 0.5f), RS);
    SpawnRoomLabel(TEXT("Amusement Park"));

    // Carousel (procedural: base platform + center pole + canopy + horses)
    SpawnCylinder(FVector(-250, 200, 0), 80, 8, 16, SC::FabricPink, 0.95f);
    SpawnCylinder(FVector(-250, 200, 8), 6, 120, 8, SC::MetalGold, 1.0f);
    SpawnCylinder(FVector(-250, 200, 110), 85, 10, 16, SC::FabricPink * 0.9f, 0.9f);
    // Horses (colored cylinders around the edge)
    for (int32 I = 0; I < 6; I++) {
        float Angle = I * 60.f * PI / 180.f;
        FVector HP(-250 + FMath::Cos(Angle) * 55.f, 200 + FMath::Sin(Angle) * 55.f, 35);
        FLinearColor HC = (I % 2 == 0) ? SC::FabricPink : SC::MetalGold;
        SpawnCylinder(HP, 4, 30, 6, HC);
        SpawnTexturedBox(HP + FVector(0, 0, 15), FVector(8, 4, 6), ETexturePattern::Fabric, HC * 1.1f, HC * 0.9f);
    }
    // Ferris wheel (procedural: support struts + hub + gondolas)
    SpawnTexturedBox(FVector(250, 250, 100), FVector(5, 5, 100), ETexturePattern::Metal, SC::FabricRed, SC::MetalSilver);
    SpawnTexturedBox(FVector(230, 250, 100), FVector(5, 5, 100), ETexturePattern::Metal, SC::FabricRed, SC::MetalSilver);
    SpawnSphere(FVector(240, 250, 180), 10, 10, SC::MetalSilver);
    // Gondolas around the wheel
    for (int32 I = 0; I < 8; I++) {
        float Angle = I * 45.f * PI / 180.f;
        FVector GP(240 + FMath::Cos(Angle) * 70.f, 250, 180 + FMath::Sin(Angle) * 70.f);
        FLinearColor GC = (I % 2 == 0) ? SC::FabricRed : SC::FabricYellow;
        SpawnTexturedBox(GP, FVector(8, 6, 10), ETexturePattern::Metal, GC, GC * 0.85f);
    }
    // Food cart (procedural: cart body + wheels + umbrella)
    SpawnTexturedBox(FVector(0, -200, 30), FVector(35, 20, 25), ETexturePattern::Metal, SC::FabricRed, SC::FabricYellow);
    SpawnTexturedBox(FVector(0, -200, 56), FVector(37, 22, 2), ETexturePattern::Metal, SC::FabricRed * 0.95f, SC::FabricYellow);
    SpawnCylinder(FVector(-30, -200, 0), 8, 8, 8, SC::MetalBlack);
    SpawnCylinder(FVector(30, -200, 0), 8, 8, 8, SC::MetalBlack);
    // Umbrella
    SpawnCylinder(FVector(0, -200, 56), 3, 60, 6, SC::MetalChrome);
    SpawnCylinder(FVector(0, -200, 110), 40, 8, 12, SC::FabricRed * 0.9f, 0.95f);
    // Benches
    SpawnDetailedBench(FVector(-350, -150, 0), FRotator::ZeroRotator, SC::WoodLight, SC::MetalBlack, 1.2f);
    SpawnDetailedBench(FVector(350, -150, 0), FRotator::ZeroRotator, SC::WoodLight, SC::MetalBlack, 1.2f);
    // Trees
    SpawnDetailedTree(FVector(-500, -300, 0), SC::WoodMedium, SC::PlantGreen, 1.5f);
    SpawnDetailedTree(FVector(500, -300, 0), SC::WoodDark, SC::PlantDark, 1.5f);
    // Plants
    SpawnDetailedPlant(FVector(-400, 400, 0), SC::BrickRed, SC::FabricPink, 1.2f);
    SpawnDetailedPlant(FVector(400, 400, 0), SC::BrickRed, SC::FabricYellow, 1.2f);
    // Lamp posts (procedural: pole + globe + light)
    SpawnCylinder(FVector(-200, -300, 0), 4, 120, 8, SC::MetalBlack, 0.9f);
    SpawnSphere(FVector(-200, -300, 125), 12, 8, SC::MetalGold);
    SpawnLight(FVector(-200, -300, 130), 8.f, FLinearColor(1.0f, 0.92f, 0.72f), 350.f);
    SpawnCylinder(FVector(200, -300, 0), 4, 120, 8, SC::MetalBlack, 0.9f);
    SpawnSphere(FVector(200, -300, 125), 12, 8, SC::MetalGold);
    SpawnLight(FVector(200, -300, 130), 8.f, FLinearColor(1.0f, 0.92f, 0.72f), 350.f);
    // Colorful lights
    SpawnLight(FVector(-250, 200, 150), 12.f, FLinearColor(1.0f, 0.3f, 0.8f), 500.f);
    SpawnLight(FVector(250, 250, 150), 12.f, FLinearColor(0.3f, 0.8f, 1.0f), 500.f);

    SpawnCharacterMesh(TEXT("Emersyn"), FVector(0, -100, 0), FRotator(0, 15, 0), 3.0f, FLinearColor(0.92f, 0.75f, 0.60f), SC::FabricCoral);
    SpawnCharacterMesh(TEXT("Ava"), FVector(-120, -50, 0), FRotator(0, 45, 0), 3.0f, FLinearColor(0.88f, 0.70f, 0.52f), SC::FabricLavender);
    SpawnCharacterMesh(TEXT("Dog"), FVector(100, -60, 0), FRotator(0, -30, 0), 2.0f, FLinearColor(0.75f, 0.55f, 0.35f), FLinearColor(0.75f, 0.55f, 0.35f));
    SetupAutoCamera(RS);  // v31: auto-scaling camera
}
