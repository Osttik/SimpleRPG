#include "core/crafting/material-processing.h"

namespace
{
const MaterialProcessingDefinition kMaterialDefinitions[] = {
    {
        MaterialId::None,
        "none",
        float32(1),
        0, 0, 0, 0, 0, 0, 0,
        false, false, false, false, false,
        0, 0, 0, 0, 0,
        MaterialId::None, MaterialId::None, MaterialId::None,
    },
    {
        MaterialId::Dirt,
        "dirt",
        float32(1),
        0, 0, 0, 0, 0, 0, 0,
        false, true, false, false, true,
        10, 18, 8, 12, 3,
        MaterialId::None, MaterialId::None, MaterialId::None,
    },
    {
        MaterialId::Stone,
        "stone",
        float32(3),
        0, 0, 200, 0, 0, 900, 2000,
        false, true, true, false, true,
        14, 26, 12, 8, 2,
        MaterialId::None, MaterialId::None, MaterialId::None,
    },
    {
        MaterialId::Iron,
        "iron",
        float32(8),
        0, 0, 650, 900, 1200, 1350, 1530,
        true, true, true, true, true,
        28, 36, 14, 26, 2,
        MaterialId::None, MaterialId::ScrapMetal, MaterialId::Iron,
    },
    {
        MaterialId::Gold,
        "gold",
        float32(10),
        0, 0, 500, 700, 900, 1000, 1064,
        true, true, true, true, true,
        18, 24, 12, 20, 2,
        MaterialId::None, MaterialId::ScrapMetal, MaterialId::Gold,
    },
    {
        MaterialId::Clay,
        "clay",
        float32(2),
        0, 0, 150, 0, 0, 900, 1200,
        false, true, false, false, true,
        12, 18, 8, 10, 3,
        MaterialId::None, MaterialId::None, MaterialId::None,
    },
    {
        MaterialId::Wood,
        "wood",
        float32(1),
        220, 360, 120, 0, 0, 340, 0,
        false, true, true, true, true,
        12, 18, 10, 22, 4,
        MaterialId::Char, MaterialId::Ash, MaterialId::None,
    },
    {
        MaterialId::Char,
        "char",
        float32(1),
        250, 420, 0, 0, 0, 360, 0,
        false, true, false, false, false,
        4, 8, 2, 4, 5,
        MaterialId::None, MaterialId::Ash, MaterialId::None,
    },
    {
        MaterialId::Ash,
        "ash",
        float32(0),
        0, 0, 0, 0, 0, 0, 0,
        false, false, false, false, false,
        1, 1, 1, 1, 0,
        MaterialId::None, MaterialId::Ash, MaterialId::None,
    },
    {
        MaterialId::ScrapMetal,
        "scrap_metal",
        float32(7),
        0, 0, 500, 700, 950, 1200, 1450,
        true, true, true, true, true,
        14, 18, 8, 12, 2,
        MaterialId::None, MaterialId::ScrapMetal, MaterialId::ScrapMetal,
    },
};
}

const MaterialProcessingDefinition &GetMaterialProcessingDefinition(MaterialId materialId)
{
  const size_t index = static_cast<size_t>(materialId);
  if (index >= (sizeof(kMaterialDefinitions) / sizeof(kMaterialDefinitions[0])))
    return kMaterialDefinitions[0];
  return kMaterialDefinitions[index];
}

MaterialId MaterialIdFromString(const std::string &value)
{
  for (const auto &definition : kMaterialDefinitions)
  {
    if (value == definition.Key)
      return definition.Id;
  }
  return MaterialId::None;
}

std::string MaterialIdToString(MaterialId materialId)
{
  return GetMaterialProcessingDefinition(materialId).Key;
}

MaterialHeatOutcome ResolveMaterialHeatOutcome(MaterialId materialId, int32_t temperature)
{
  const auto &definition = GetMaterialProcessingDefinition(materialId);
  if (definition.Id == MaterialId::None)
    return MaterialHeatOutcome::Stable;

  if (definition.BurnOutcome != MaterialId::None && definition.BurnTemperature > 0 && temperature >= definition.BurnTemperature)
  {
    return definition.BurnOutcome == MaterialId::Ash ? MaterialHeatOutcome::Ashed : MaterialHeatOutcome::Scrap;
  }

  if (definition.CharOutcome != MaterialId::None && definition.IgnitionTemperature > 0 && temperature >= definition.IgnitionTemperature)
    return MaterialHeatOutcome::Charred;

  if (definition.Castable && definition.MeltTemperature > 0 && temperature >= definition.MeltTemperature)
    return MaterialHeatOutcome::Melted;

  if (definition.ForgeMinTemperature > 0 && temperature >= definition.ForgeMinTemperature && temperature <= definition.ForgeMaxTemperature)
    return MaterialHeatOutcome::Forgeable;

  if (definition.OverheatTemperature > 0 && temperature >= definition.OverheatTemperature)
    return definition.BurnOutcome != MaterialId::None ? MaterialHeatOutcome::Scrap : MaterialHeatOutcome::Stable;

  return MaterialHeatOutcome::Stable;
}
