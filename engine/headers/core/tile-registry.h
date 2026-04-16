#pragma once
#include <string>
#include <unordered_map>
#include <cstdint>

#include <vector>
#include "core/materials.h"
#include "core/tool-interaction.h"

enum class TileConnectorType : uint8_t
{
    None = 0,
    Ladder = 1,
    Stairs = 2,
    Hatch = 3,
    Drop = 4
};

enum TileDirectionMask : uint8_t
{
    TileDirectionNorth = 1 << 0,
    TileDirectionSouth = 1 << 1,
    TileDirectionWest = 1 << 2,
    TileDirectionEast = 1 << 3,
    TileDirectionAny = TileDirectionNorth | TileDirectionSouth | TileDirectionWest | TileDirectionEast
};

struct TileConnectorDef
{
    TileConnectorType Type = TileConnectorType::None;
    int8_t DeltaZ = 0;
    uint8_t AllowedEnterDirectionMask = TileDirectionAny;
    uint8_t AllowedMovementDirectionMask = TileDirectionAny;
    bool AutoTrigger = false;
    bool RequireDestinationSupport = true;
    bool RequireDestinationNotBlocked = true;
    int16_t TriggerMinX = 10;
    int16_t TriggerMinY = 10;
    int16_t TriggerMaxX = 30;
    int16_t TriggerMaxY = 30;
    uint8_t CooldownTicks = 8;
    bool OneWay = false;
    bool Bidirectional = false;
};

struct TileStageLootDef
{
    std::string ItemDefinitionId;
    uint16_t Quantity = 0;
};

struct TileDestructionStageDef
{
    int32_t Threshold = 0;
    std::vector<TileStageLootDef> Loot;
};

struct TileDestructionDef
{
    bool Destructible = false;
    int32_t MaxIntegrity = 0;
    int32_t MiningResistance = 0;
    TileStrengthClass StrengthClass = TileStrengthClass::None;
    ToolClass PreferredTool = ToolClass::None;
    std::vector<TileDestructionStageDef> Stages;
    std::vector<uint16_t> StageVisualTileIds;
    uint16_t DestroyedTileId = 0;
    std::vector<MaterialPart> MaterialYieldHints;
};

struct TileGameplayDef
{
    bool Collide = false;
    bool Support = false;
    bool FallThrough = true;
    bool Roof = false;
    bool Occludes = false;
    uint8_t DamageVisualStage = 0;
    TileConnectorDef Connector;
    TileDestructionDef Destruction;
};

class TileRegistry
{
public:
    static void RegisterTile(uint16_t id, const std::string &name, bool collide);
    static void RegisterTile(uint16_t id, const std::string &name, const TileGameplayDef &gameplay);
    static std::string GetTileName(uint16_t id);
    static bool GetTileCollide(uint16_t id);
    static bool GetTileSupport(uint16_t id);
    static bool GetTileFallThrough(uint16_t id);
    static bool GetTileRoof(uint16_t id);
    static bool GetTileOccludes(uint16_t id);
    static uint8_t GetTileDamageVisualStage(uint16_t id);
    static const TileConnectorDef *GetTileConnector(uint16_t id);
    static const TileDestructionDef *GetTileDestruction(uint16_t id);
    static TileGameplayDef GetTileGameplay(uint16_t id);
    static std::unordered_map<uint16_t, std::string> GetAllTiles();

private:
    static std::unordered_map<uint16_t, std::string> tiles_;
    static std::vector<TileGameplayDef> gameplayMap_;
};
