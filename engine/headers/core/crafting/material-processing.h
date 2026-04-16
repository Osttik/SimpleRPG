#pragma once

#include <cstdint>
#include <string>
#include "core/materials.h"
#include "math/number.h"

enum class MaterialHeatOutcome : uint8_t
{
  Stable = 0,
  Forgeable = 1,
  Melted = 2,
  Charred = 3,
  Ashed = 4,
  Scrap = 5,
};

struct MaterialProcessingDefinition
{
  MaterialId Id = MaterialId::None;
  const char *Key = "none";
  float32 Density = float32(1);
  int32_t IgnitionTemperature = 0;
  int32_t BurnTemperature = 0;
  int32_t SoftenStartTemperature = 0;
  int32_t ForgeMinTemperature = 0;
  int32_t ForgeMaxTemperature = 0;
  int32_t OverheatTemperature = 0;
  int32_t MeltTemperature = 0;
  bool Castable = false;
  bool Chippable = false;
  bool Sharpenable = false;
  bool Bendable = false;
  bool Joinable = false;
  int32_t StrainTolerance = 0;
  int32_t LocalFractureThreshold = 0;
  int32_t ThinEdgeTolerance = 0;
  int32_t JoinStrength = 0;
  int32_t HeatLossRate = 0;
  MaterialId CharOutcome = MaterialId::None;
  MaterialId BurnOutcome = MaterialId::None;
  MaterialId MeltOutcome = MaterialId::None;
};

const MaterialProcessingDefinition &GetMaterialProcessingDefinition(MaterialId materialId);
MaterialId MaterialIdFromString(const std::string &value);
std::string MaterialIdToString(MaterialId materialId);
MaterialHeatOutcome ResolveMaterialHeatOutcome(MaterialId materialId, int32_t temperature);
