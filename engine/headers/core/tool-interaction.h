#pragma once
#include <cstdint>

enum class ToolClass : uint8_t
{
  None = 0,
  Pickaxe = 1,
  Shovel = 2,
};

enum class TileStrengthClass : uint8_t
{
  None = 0,
  Soft = 1,
  Strong = 2,
};

struct MiningToolStats
{
  ToolClass Class = ToolClass::None;
  int32_t BasePower = 1;
  int32_t SoftMultiplierPct = 100;
  int32_t StrongMultiplierPct = 100;
  int32_t PreferredToolBonus = 0;
};

struct MiningTileProfile
{
  TileStrengthClass StrengthClass = TileStrengthClass::None;
  ToolClass PreferredTool = ToolClass::None;
  int32_t Resistance = 0;
};

int32_t ResolveMiningDamage(const MiningToolStats *tool, const MiningTileProfile &tileProfile);
