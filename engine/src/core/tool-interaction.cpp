#include <algorithm>
#include "core/tool-interaction.h"

int32_t ResolveMiningDamage(const MiningToolStats *tool, const MiningTileProfile &tileProfile)
{
  MiningToolStats defaultHands;
  const MiningToolStats &effectiveTool = tool ? *tool : defaultHands;

  int32_t adjustedPower = effectiveTool.BasePower;
  switch (tileProfile.StrengthClass)
  {
  case TileStrengthClass::Soft:
    adjustedPower = (adjustedPower * effectiveTool.SoftMultiplierPct) / 100;
    break;
  case TileStrengthClass::Strong:
    adjustedPower = (adjustedPower * effectiveTool.StrongMultiplierPct) / 100;
    break;
  case TileStrengthClass::None:
  default:
    break;
  }

  if (tileProfile.PreferredTool != ToolClass::None && effectiveTool.Class == tileProfile.PreferredTool)
  {
    adjustedPower += effectiveTool.PreferredToolBonus;
  }

  return std::max(1, adjustedPower - std::max(0, tileProfile.Resistance));
}
