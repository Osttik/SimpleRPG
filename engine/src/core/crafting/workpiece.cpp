#include "core/inventory.h"
#include <algorithm>
#include <cstdlib>
#include "core/crafting/material-processing.h"

namespace
{
size_t ProfileIndex(const WorkpieceState &state, int32_t x, int32_t y)
{
  return static_cast<size_t>(y * static_cast<int32_t>(state.ProfileWidth) + x);
}

void ResizeMaps(WorkpieceState &state)
{
  const size_t cellCount = static_cast<size_t>(state.ProfileWidth) * static_cast<size_t>(state.ProfileHeight);
  state.ProfileMask.resize(cellCount, 0);
  state.SharpnessMaskTop.resize(cellCount, 0);
  state.SharpnessMaskBottom.resize(cellCount, 0);
  state.SharpnessMaskLeft.resize(cellCount, 0);
  state.SharpnessMaskRight.resize(cellCount, 0);
  state.StrainMap.resize(cellCount, 0);
  state.DamageMap.resize(cellCount, 0);
  state.WeaknessMap.resize(cellCount, 0);
}

bool IsFilled(const WorkpieceState &state, int32_t x, int32_t y)
{
  if (x < 0 || y < 0 || x >= state.ProfileWidth || y >= state.ProfileHeight)
    return false;
  return state.ProfileMask[ProfileIndex(state, x, y)] != 0;
}

void SetFilled(WorkpieceState &state, int32_t x, int32_t y, bool filled)
{
  if (x < 0 || y < 0 || x >= state.ProfileWidth || y >= state.ProfileHeight)
    return;
  state.ProfileMask[ProfileIndex(state, x, y)] = filled ? 1 : 0;
}

int32_t CountFilled(const WorkpieceState &state)
{
  int32_t count = 0;
  for (uint8_t cell : state.ProfileMask)
  {
    count += cell != 0 ? 1 : 0;
  }
  return count;
}

void UpdateJoinLayout(WorkpieceState &state)
{
  state.JoinPoints.clear();
  state.ConnectionSides.clear();

  if (state.Orientation == PartOrientation::Vertical)
  {
    state.ConnectionSides.push_back(ConnectionSide::Top);
    state.ConnectionSides.push_back(ConnectionSide::Bottom);
    state.JoinPoints.push_back(JoinPointState{
        static_cast<int16_t>(state.ProfileWidth / 2),
        0,
        ConnectionSide::Top,
        PartOrientation::Vertical,
        false,
    });
    state.JoinPoints.push_back(JoinPointState{
        static_cast<int16_t>(state.ProfileWidth / 2),
        static_cast<int16_t>(state.ProfileHeight - 1),
        ConnectionSide::Bottom,
        PartOrientation::Vertical,
        false,
    });
    return;
  }

  state.ConnectionSides.push_back(ConnectionSide::Left);
  state.ConnectionSides.push_back(ConnectionSide::Right);
  state.JoinPoints.push_back(JoinPointState{
      0,
      static_cast<int16_t>(state.ProfileHeight / 2),
      ConnectionSide::Left,
      PartOrientation::Horizontal,
      false,
  });
  state.JoinPoints.push_back(JoinPointState{
      static_cast<int16_t>(state.ProfileWidth - 1),
      static_cast<int16_t>(state.ProfileHeight / 2),
      ConnectionSide::Right,
      PartOrientation::Horizontal,
      false,
  });
}

void MarkInvalid(WorkpieceState &state, WorkpieceInvalidReason reason)
{
  state.InvalidReason = reason;
  state.Fractured = true;
  state.Broken = true;
  state.Stage = WorkpieceStage::BrokenScrap;
}

void ApplyThermalOutcome(WorkpieceState &state)
{
  const MaterialHeatOutcome outcome = ResolveMaterialHeatOutcome(state.Material, state.TemperatureRaw);
  if (outcome == MaterialHeatOutcome::Forgeable)
  {
    if (state.Stage == WorkpieceStage::RawStock)
      state.Stage = WorkpieceStage::HeatedStock;
    return;
  }

  if (outcome == MaterialHeatOutcome::Melted)
  {
    state.Stage = WorkpieceStage::HeatedStock;
    return;
  }

  if (outcome == MaterialHeatOutcome::Charred)
  {
    const auto &definition = GetMaterialProcessingDefinition(state.Material);
    if (definition.CharOutcome != MaterialId::None)
      state.Material = definition.CharOutcome;
    state.Quality = static_cast<uint16_t>((state.Quality * 3) / 4);
    return;
  }

  if (outcome == MaterialHeatOutcome::Ashed)
  {
    state.Material = MaterialId::Ash;
    state.ProfileMask.assign(state.ProfileMask.size(), 0);
    MarkInvalid(state, WorkpieceInvalidReason::ThermalFailure);
    return;
  }

  if (outcome == MaterialHeatOutcome::Scrap)
  {
    const auto &definition = GetMaterialProcessingDefinition(state.Material);
    if (definition.BurnOutcome != MaterialId::None)
      state.Material = definition.BurnOutcome;
    state.Quality = static_cast<uint16_t>((state.Quality * 2) / 5);
    if (state.Quality < 20)
      MarkInvalid(state, WorkpieceInvalidReason::ThermalFailure);
  }
}

int32_t ComputeEdgeExposure(const WorkpieceState &state, const std::vector<uint8_t> &mask)
{
  int32_t total = 0;
  for (size_t i = 0; i < mask.size(); ++i)
  {
    if (state.ProfileMask[i] != 0 && mask[i] != 0)
      total += static_cast<int32_t>(mask[i]);
  }
  return total;
}

void BuildRuntimeRegions(WorkpieceState &state, int32_t minX, int32_t minY, int32_t maxX, int32_t maxY)
{
  state.RuntimeRegions.clear();
  if (maxX < minX || maxY < minY)
    return;

  const int16_t width = static_cast<int16_t>(maxX - minX + 1);
  const int16_t height = static_cast<int16_t>(maxY - minY + 1);
  const bool vertical = state.Orientation == PartOrientation::Vertical;

  if (vertical)
  {
    state.RuntimeRegions.push_back(RuntimeRegion{
        RuntimeRegionType::Shaft,
        static_cast<int16_t>(minX),
        static_cast<int16_t>(minY + (height / 3)),
        static_cast<int16_t>(maxX),
        static_cast<int16_t>(maxY),
    });
    state.RuntimeRegions.push_back(RuntimeRegion{
        RuntimeRegionType::Head,
        static_cast<int16_t>(minX),
        static_cast<int16_t>(minY),
        static_cast<int16_t>(maxX),
        static_cast<int16_t>(minY + (height / 3)),
    });
    state.RuntimeRegions.push_back(RuntimeRegion{
        RuntimeRegionType::Point,
        static_cast<int16_t>(minX),
        static_cast<int16_t>(minY),
        static_cast<int16_t>(maxX),
        static_cast<int16_t>(minY + (height / 6)),
    });
    state.RuntimeRegions.push_back(RuntimeRegion{
        RuntimeRegionType::Edge,
        static_cast<int16_t>(minX),
        static_cast<int16_t>(minY),
        static_cast<int16_t>(maxX),
        static_cast<int16_t>(minY + (height / 2)),
    });
    return;
  }

  state.RuntimeRegions.push_back(RuntimeRegion{
      RuntimeRegionType::Shaft,
      static_cast<int16_t>(minX),
      static_cast<int16_t>(minY),
      static_cast<int16_t>(minX + ((width * 2) / 3)),
      static_cast<int16_t>(maxY),
  });
  state.RuntimeRegions.push_back(RuntimeRegion{
      RuntimeRegionType::Head,
      static_cast<int16_t>(minX + (width / 2)),
      static_cast<int16_t>(minY),
      static_cast<int16_t>(maxX),
      static_cast<int16_t>(maxY),
  });
  state.RuntimeRegions.push_back(RuntimeRegion{
      RuntimeRegionType::Point,
      static_cast<int16_t>(maxX - (width / 6)),
      static_cast<int16_t>(minY),
      static_cast<int16_t>(maxX),
      static_cast<int16_t>(maxY),
  });
  state.RuntimeRegions.push_back(RuntimeRegion{
      RuntimeRegionType::Edge,
      static_cast<int16_t>(minX + (width / 2)),
      static_cast<int16_t>(minY),
      static_cast<int16_t>(maxX),
      static_cast<int16_t>(maxY),
  });
}

void SyncCompatibilityFeatures(Item &item, WorkpieceState &state)
{
  const int32_t peakDamage = (std::max)({state.CuttingEffectiveness, state.PiercingEffectiveness, state.BluntEffectiveness, 1});
  auto *weapon = item.GetFeature<WeaponFeature>();
  if (!weapon)
    weapon = item.AddFeature<WeaponFeature>(1, 2);
  weapon->MinDamage = (std::max)(1, peakDamage / 12);
  weapon->MaxDamage = (std::max)(weapon->MinDamage + 1, peakDamage / 6);

  ToolClass toolClass = ToolClass::None;
  if (state.DiggingEfficiency >= state.PiercingEffectiveness && state.DiggingEfficiency >= state.BluntEffectiveness)
    toolClass = ToolClass::Shovel;
  else if (state.BluntEffectiveness >= state.DiggingEfficiency || state.PiercingEffectiveness >= state.DiggingEfficiency)
    toolClass = ToolClass::Pickaxe;

  auto *tool = item.GetFeature<ToolFeature>();
  if (toolClass == ToolClass::None && tool)
  {
    tool->Mining.Class = ToolClass::None;
    tool->Mining.BasePower = 1;
    return;
  }

  if (!tool)
  {
    tool = item.AddFeature<ToolFeature>(MiningToolStats{});
  }
  tool->Mining.Class = toolClass;
  tool->Mining.BasePower = (std::max)(1, state.DiggingEfficiency / 10);
  tool->Mining.SoftMultiplierPct = toolClass == ToolClass::Shovel ? 150 : 95;
  tool->Mining.StrongMultiplierPct = toolClass == ToolClass::Pickaxe ? 145 : 80;
  tool->Mining.PreferredToolBonus = state.SwingEfficiency / 20;

  auto *durability = item.GetFeature<DurabilityFeature>();
  if (!durability)
    durability = item.AddFeature<DurabilityFeature>(state.Durability, state.Durability);
  durability->Max = (std::max)(1, state.Durability);
  durability->Current = (std::min)(durability->Current == 0 ? durability->Max : durability->Current, durability->Max);

  if (state.Stage == WorkpieceStage::AssembledItem || state.Stage == WorkpieceStage::ShapedPart)
  {
    auto *equippable = item.GetFeature<EquippableFeature>();
    if (!equippable)
      item.AddFeature<EquippableFeature>(std::vector<EquipSlot>{EquipSlot::HandPrimary, EquipSlot::HandSecondary});
  }

  if (state.Broken || state.Fractured)
  {
    item.Name = "Broken Scrap";
    item.SpriteKey = "stone";
    return;
  }

  if (state.PiercingEffectiveness > state.BluntEffectiveness && state.EffectiveReachRaw > 8 * 65536)
  {
    item.Name = "Crafted Spear";
    item.SpriteKey = "sword";
  }
  else if (state.BluntEffectiveness > state.CuttingEffectiveness && state.SwingEfficiency > state.ThrustEfficiency)
  {
    item.Name = "Crafted Hammer";
    item.SpriteKey = "pickaxe";
  }
  else if (state.DiggingEfficiency >= state.CuttingEffectiveness)
  {
    item.Name = "Crafted Shovel";
    item.SpriteKey = "pickaxe";
  }
  else if (state.CuttingEffectiveness >= state.PiercingEffectiveness)
  {
    item.Name = "Crafted Knife";
    item.SpriteKey = "sword";
  }
  else
  {
    item.Name = "Crafted Part";
    item.SpriteKey = "stone";
  }
}
}

namespace Crafting
{
WorkpieceState MakeStockWorkpiece(MaterialId materialId, int32_t width, int32_t height, int32_t thicknessRaw, PartOrientation orientation)
{
  WorkpieceState state;
  state.Material = materialId;
  state.ProfileWidth = static_cast<uint16_t>((std::max)(1, width));
  state.ProfileHeight = static_cast<uint16_t>((std::max)(1, height));
  state.ThicknessRaw = thicknessRaw;
  state.Orientation = orientation;
  ResizeMaps(state);
  std::fill(state.ProfileMask.begin(), state.ProfileMask.end(), 1);
  UpdateJoinLayout(state);
  return state;
}

bool IsCraftingCapableItem(const Item &item)
{
  return item.GetFeature<WorkpieceFeature>() != nullptr;
}

void RecalculateDerivedState(Item &item)
{
  auto *feature = item.GetFeature<WorkpieceFeature>();
  if (!feature)
    return;

  WorkpieceState &state = feature->State;
  const auto &material = GetMaterialProcessingDefinition(state.Material);
  const int32_t occupiedCount = CountFilled(state);
  if (occupiedCount <= 0)
  {
    MarkInvalid(state, WorkpieceInvalidReason::Undersized);
    SyncCompatibilityFeatures(item, state);
    return;
  }

  int32_t minX = state.ProfileWidth;
  int32_t minY = state.ProfileHeight;
  int32_t maxX = -1;
  int32_t maxY = -1;
  int64_t weightedX = 0;
  int64_t weightedY = 0;
  int32_t totalWeakness = 0;
  int32_t totalStrain = 0;
  int32_t totalDamage = 0;

  for (int32_t y = 0; y < state.ProfileHeight; ++y)
  {
    for (int32_t x = 0; x < state.ProfileWidth; ++x)
    {
      const size_t index = ProfileIndex(state, x, y);
      if (state.ProfileMask[index] == 0)
        continue;
      minX = (std::min)(minX, x);
      minY = (std::min)(minY, y);
      maxX = (std::max)(maxX, x);
      maxY = (std::max)(maxY, y);
      weightedX += x;
      weightedY += y;
      totalWeakness += state.WeaknessMap[index];
      totalStrain += state.StrainMap[index];
      totalDamage += state.DamageMap[index];
    }
  }

  const int32_t occupiedWidth = (std::max)(1, maxX - minX + 1);
  const int32_t occupiedHeight = (std::max)(1, maxY - minY + 1);
  BuildRuntimeRegions(state, minX, minY, maxX, maxY);
  const int32_t edgeExposure = ComputeEdgeExposure(state, state.SharpnessMaskTop) +
                               ComputeEdgeExposure(state, state.SharpnessMaskBottom) +
                               ComputeEdgeExposure(state, state.SharpnessMaskLeft) +
                               ComputeEdgeExposure(state, state.SharpnessMaskRight);
  const int32_t pointScore = static_cast<int32_t>(state.RuntimeRegions.size()) + (state.Orientation == PartOrientation::Vertical ? occupiedWidth : occupiedHeight);
  const int32_t reachCells = state.Orientation == PartOrientation::Vertical ? occupiedHeight : occupiedWidth;
  const int32_t headBias = state.Orientation == PartOrientation::Vertical
                               ? (occupiedCount > 0 ? static_cast<int32_t>((weightedY / occupiedCount) - minY) : 0)
                               : (occupiedCount > 0 ? static_cast<int32_t>(maxX - (weightedX / occupiedCount)) : 0);
  const int32_t thicknessCells = (std::max)(1, state.ThicknessRaw / 65536);
  const int32_t joinQualityPenalty = state.JoinedParts.empty() ? 0 : (std::max)(0, 100 - static_cast<int32_t>(state.JoinQuality));
  const int32_t prepBonus = state.JoinPreparationQuality / 2;
  const int32_t edgeRegionCount = static_cast<int32_t>(std::count_if(state.RuntimeRegions.begin(), state.RuntimeRegions.end(), [](const RuntimeRegion &region) {
    return region.Type == RuntimeRegionType::Edge;
  }));
  const int32_t pointRegionCount = static_cast<int32_t>(std::count_if(state.RuntimeRegions.begin(), state.RuntimeRegions.end(), [](const RuntimeRegion &region) {
    return region.Type == RuntimeRegionType::Point;
  }));
  const int32_t headRegionCount = static_cast<int32_t>(std::count_if(state.RuntimeRegions.begin(), state.RuntimeRegions.end(), [](const RuntimeRegion &region) {
    return region.Type == RuntimeRegionType::Head;
  }));

  state.MassRaw = occupiedCount * thicknessCells * material.Density.raw_value();
  state.CenterOfMassXRaw = static_cast<int32_t>((weightedX * 65536LL) / occupiedCount);
  state.CenterOfMassYRaw = static_cast<int32_t>((weightedY * 65536LL) / occupiedCount);
  state.EffectiveReachRaw = reachCells * 65536;
  state.CuttingEffectiveness = ((edgeExposure * state.Quality) / 100) + (occupiedWidth * 2) + (edgeRegionCount * 16) + prepBonus;
  state.PiercingEffectiveness = (((pointScore * 3) + edgeExposure) * state.Quality) / 200 + (pointRegionCount * 20) + (state.Orientation == PartOrientation::Vertical ? 18 : 8);
  state.BluntEffectiveness = ((state.MassRaw / 65536) / 2) + (headBias * 8) + occupiedHeight + (headRegionCount * 14);
  state.DiggingEfficiency = ((occupiedWidth * occupiedHeight) / 2) + (state.CuttingEffectiveness / 4) + (state.BluntEffectiveness / 2) + (occupiedWidth * 3);
  state.SwingEfficiency = (state.BluntEffectiveness + headBias * 6 + occupiedCount + (headRegionCount * 12)) / 2;
  state.ThrustEfficiency = state.PiercingEffectiveness + (reachCells * 4) + (pointRegionCount * 10);
  state.StopOnHit = (std::max)(1, state.PiercingEffectiveness - (state.CuttingEffectiveness / 4) + thicknessCells + joinQualityPenalty / 4);
  state.Durability = (std::max)(1, material.StrainTolerance * 6 + prepBonus - totalDamage - (totalWeakness * 2) - joinQualityPenalty);
  state.BreakRisk = (std::max)(0, totalStrain + (totalWeakness * 3) + (100 - state.Quality) + joinQualityPenalty + state.JoinWeaknessPenalty);

  if (state.BreakRisk >= material.LocalFractureThreshold * 8 || occupiedCount < 4)
    MarkInvalid(state, WorkpieceInvalidReason::Fractured);
  else if (edgeExposure > 0 && totalWeakness > material.ThinEdgeTolerance * 8)
    MarkInvalid(state, WorkpieceInvalidReason::Oversharpened);
  else if (occupiedCount < (reachCells * thicknessCells) / 3)
    MarkInvalid(state, WorkpieceInvalidReason::Undersized);

  SyncCompatibilityFeatures(item, state);
}

bool ApplyHeat(Item &item, int32_t deltaTemperature)
{
  auto *feature = item.GetFeature<WorkpieceFeature>();
  if (!feature)
    return false;

  WorkpieceState &state = feature->State;
  const auto &material = GetMaterialProcessingDefinition(state.Material);
  state.TemperatureRaw = (std::max)(0, state.TemperatureRaw + deltaTemperature - material.HeatLossRate);
  ApplyThermalOutcome(state);
  RecalculateDerivedState(item);
  return true;
}

bool Cast(Item &item, MoldSilhouette silhouette, int32_t width, int32_t length, int32_t thicknessRaw)
{
  auto *feature = item.GetFeature<WorkpieceFeature>();
  if (!feature)
    return false;

  WorkpieceState &state = feature->State;
  const auto &material = GetMaterialProcessingDefinition(state.Material);
  if (!material.Castable || ResolveMaterialHeatOutcome(state.Material, state.TemperatureRaw) != MaterialHeatOutcome::Melted)
    return false;

  state.ProfileWidth = static_cast<uint16_t>((std::max)(2, width));
  state.ProfileHeight = static_cast<uint16_t>((std::max)(2, length));
  state.ThicknessRaw = thicknessRaw;
  state.Orientation = silhouette == MoldSilhouette::ShaftBlank ? PartOrientation::Vertical : PartOrientation::Horizontal;
  ResizeMaps(state);
  std::fill(state.ProfileMask.begin(), state.ProfileMask.end(), 0);

  for (int32_t y = 0; y < state.ProfileHeight; ++y)
  {
    for (int32_t x = 0; x < state.ProfileWidth; ++x)
    {
      bool fill = true;
      if (silhouette == MoldSilhouette::BladeBlank || silhouette == MoldSilhouette::SpikeBlank)
      {
        fill = x <= state.ProfileWidth - 1 - (y / 2);
      }
      else if (silhouette == MoldSilhouette::HammerHeadBlank)
      {
        fill = y > 0 && y < state.ProfileHeight - 1;
      }
      else if (silhouette == MoldSilhouette::ShovelBlank)
      {
        fill = y >= state.ProfileHeight / 3 || x < state.ProfileWidth - 1 - (y / 2);
      }

      if (fill)
        SetFilled(state, x, y, true);
    }
  }

  state.Stage = WorkpieceStage::CastBlank;
  state.Quality = static_cast<uint16_t>((std::max)(20, static_cast<int32_t>(state.Quality) - (state.TemperatureRaw > material.OverheatTemperature ? 15 : 5)));
  state.TemperatureRaw = material.ForgeMaxTemperature;
  UpdateJoinLayout(state);
  RecalculateDerivedState(item);
  return true;
}

bool Bend(Item &item, BendZone zone, int32_t displacement)
{
  auto *feature = item.GetFeature<WorkpieceFeature>();
  if (!feature)
    return false;

  WorkpieceState &state = feature->State;
  const auto &material = GetMaterialProcessingDefinition(state.Material);
  if (!material.Bendable)
    return false;

  const int32_t startRow = zone == BendZone::Top ? 0 : zone == BendZone::Center ? state.ProfileHeight / 3 : (state.ProfileHeight * 2) / 3;
  const int32_t endRow = zone == BendZone::Top ? state.ProfileHeight / 3 : zone == BendZone::Center ? (state.ProfileHeight * 2) / 3 : state.ProfileHeight;
  std::vector<uint8_t> nextMask(state.ProfileMask.size(), 0);

  for (int32_t y = 0; y < state.ProfileHeight; ++y)
  {
    for (int32_t x = 0; x < state.ProfileWidth; ++x)
    {
      if (!IsFilled(state, x, y))
        continue;
      const bool bendRow = y >= startRow && y < endRow;
      const int32_t nextX = bendRow ? x + displacement : x;
      if (nextX >= 0 && nextX < state.ProfileWidth)
      {
        nextMask[ProfileIndex(state, nextX, y)] = 1;
      }
      const size_t srcIndex = ProfileIndex(state, x, y);
      if (bendRow)
      {
        state.StrainMap[srcIndex] = static_cast<uint16_t>(state.StrainMap[srcIndex] + (std::abs(displacement) * 6));
        state.WeaknessMap[srcIndex] = static_cast<uint8_t>((std::min)(255, state.WeaknessMap[srcIndex] + std::abs(displacement) * 2));
      }
    }
  }

  state.ProfileMask = std::move(nextMask);
  state.Stage = WorkpieceStage::ShapedPart;
  if (std::abs(displacement) > material.StrainTolerance / 2)
  {
    state.Quality = static_cast<uint16_t>((std::max)(1, static_cast<int32_t>(state.Quality) - std::abs(displacement) * 2));
  }
  RecalculateDerivedState(item);
  return true;
}

bool Forge(Item &item, ForgeZone zone, int32_t intensity)
{
  auto *feature = item.GetFeature<WorkpieceFeature>();
  if (!feature)
    return false;

  WorkpieceState &state = feature->State;
  const auto &material = GetMaterialProcessingDefinition(state.Material);
  if (material.ForgeMinTemperature <= 0 || !material.Bendable)
    return false;

  const int32_t startRow = zone == ForgeZone::Top ? 0 : zone == ForgeZone::Center ? state.ProfileHeight / 3 : (state.ProfileHeight * 2) / 3;
  const int32_t endRow = zone == ForgeZone::Top ? state.ProfileHeight / 3 : zone == ForgeZone::Center ? (state.ProfileHeight * 2) / 3 : state.ProfileHeight;
  const bool inForgeWindow = state.TemperatureRaw >= material.ForgeMinTemperature && state.TemperatureRaw <= material.ForgeMaxTemperature;
  const bool overheated = state.TemperatureRaw > material.ForgeMaxTemperature;
  const int32_t magnitude = (std::max)(1, std::abs(intensity));

  for (int32_t y = startRow; y < endRow; ++y)
  {
    int32_t left = state.ProfileWidth;
    int32_t right = -1;
    for (int32_t x = 0; x < state.ProfileWidth; ++x)
    {
      if (!IsFilled(state, x, y))
        continue;
      left = (std::min)(left, x);
      right = (std::max)(right, x);
    }

    if (right < left)
      continue;

    if (inForgeWindow)
    {
      const int32_t center = (left + right) / 2;
      if (left > 0)
        SetFilled(state, left - 1, y, true);
      if (right + 1 < state.ProfileWidth && (y == startRow || y == endRow - 1))
        SetFilled(state, right + 1, y, true);
      if (center >= 0 && center < state.ProfileWidth)
      {
        const size_t index = ProfileIndex(state, center, y);
        state.StrainMap[index] = static_cast<uint16_t>((std::max)(0, static_cast<int32_t>(state.StrainMap[index]) - magnitude * 2));
        state.WeaknessMap[index] = static_cast<uint8_t>((std::max)(0, static_cast<int32_t>(state.WeaknessMap[index]) - magnitude));
      }
    }
    else
    {
      for (int32_t x = left; x <= right; ++x)
      {
        const size_t index = ProfileIndex(state, x, y);
        state.StrainMap[index] = static_cast<uint16_t>(state.StrainMap[index] + magnitude * (overheated ? 6 : 3));
        state.WeaknessMap[index] = static_cast<uint8_t>((std::min)(255, state.WeaknessMap[index] + magnitude * (overheated ? 4 : 2)));
      }
    }
  }

  if (inForgeWindow)
  {
    state.Quality = static_cast<uint16_t>((std::min)(150, static_cast<int32_t>(state.Quality) + magnitude * 3));
    state.JoinPreparationQuality = static_cast<uint16_t>((std::min)(100, static_cast<int32_t>(state.JoinPreparationQuality) + magnitude * 5));
  }
  else if (overheated)
  {
    state.Quality = static_cast<uint16_t>((std::max)(1, static_cast<int32_t>(state.Quality) - magnitude * 6));
    state.JoinPreparationQuality = static_cast<uint16_t>((std::max)(0, static_cast<int32_t>(state.JoinPreparationQuality) - magnitude * 4));
  }
  else
  {
    state.Quality = static_cast<uint16_t>((std::max)(1, static_cast<int32_t>(state.Quality) - magnitude * 2));
  }

  state.Stage = WorkpieceStage::ShapedPart;
  RecalculateDerivedState(item);
  return true;
}

bool Chip(Item &item, int32_t startX, int32_t startY, int32_t width, int32_t height)
{
  auto *feature = item.GetFeature<WorkpieceFeature>();
  if (!feature)
    return false;

  WorkpieceState &state = feature->State;
  const auto &material = GetMaterialProcessingDefinition(state.Material);
  if (!material.Chippable)
    return false;

  for (int32_t y = startY; y < startY + height; ++y)
  {
    for (int32_t x = startX; x < startX + width; ++x)
    {
      if (!IsFilled(state, x, y))
        continue;
      const size_t index = ProfileIndex(state, x, y);
      state.ProfileMask[index] = 0;
      state.DamageMap[index] = static_cast<uint16_t>(state.DamageMap[index] + 4);
      if (x > 0)
        state.WeaknessMap[ProfileIndex(state, x - 1, y)] = static_cast<uint8_t>((std::min)(255, state.WeaknessMap[ProfileIndex(state, x - 1, y)] + 6));
      if (x + 1 < state.ProfileWidth)
        state.WeaknessMap[ProfileIndex(state, x + 1, y)] = static_cast<uint8_t>((std::min)(255, state.WeaknessMap[ProfileIndex(state, x + 1, y)] + 6));
    }
  }

  state.Stage = WorkpieceStage::ShapedPart;
  RecalculateDerivedState(item);
  return true;
}

bool Sharpen(Item &item, SharpenSide side, int32_t amount)
{
  auto *feature = item.GetFeature<WorkpieceFeature>();
  if (!feature)
    return false;

  WorkpieceState &state = feature->State;
  const auto &material = GetMaterialProcessingDefinition(state.Material);
  if (!material.Sharpenable)
    return false;

  auto applyMask = [&](std::vector<uint8_t> &mask, int32_t x, int32_t y) {
    const size_t index = ProfileIndex(state, x, y);
    mask[index] = static_cast<uint8_t>((std::min)(255, mask[index] + amount));
    state.WeaknessMap[index] = static_cast<uint8_t>((std::min)(255, state.WeaknessMap[index] + amount * 2));
    state.StrainMap[index] = static_cast<uint16_t>(state.StrainMap[index] + amount);
  };

  for (int32_t y = 0; y < state.ProfileHeight; ++y)
  {
    for (int32_t x = 0; x < state.ProfileWidth; ++x)
    {
      if (!IsFilled(state, x, y))
        continue;
      const bool topEdge = !IsFilled(state, x, y - 1);
      const bool bottomEdge = !IsFilled(state, x, y + 1);
      const bool leftEdge = !IsFilled(state, x - 1, y);
      const bool rightEdge = !IsFilled(state, x + 1, y);
      if (side == SharpenSide::Top && topEdge)
        applyMask(state.SharpnessMaskTop, x, y);
      if (side == SharpenSide::Bottom && bottomEdge)
        applyMask(state.SharpnessMaskBottom, x, y);
      if (side == SharpenSide::Left && leftEdge)
        applyMask(state.SharpnessMaskLeft, x, y);
      if (side == SharpenSide::Right && rightEdge)
        applyMask(state.SharpnessMaskRight, x, y);
    }
  }

  state.Stage = WorkpieceStage::ShapedPart;
  state.Quality = static_cast<uint16_t>((std::max)(1, static_cast<int32_t>(state.Quality) - amount));
  RecalculateDerivedState(item);
  return true;
}

bool Join(Item &baseItem, Item &attachment)
{
  auto *baseFeature = baseItem.GetFeature<WorkpieceFeature>();
  auto *attachmentFeature = attachment.GetFeature<WorkpieceFeature>();
  if (!baseFeature || !attachmentFeature)
    return false;

  WorkpieceState &baseState = baseFeature->State;
  WorkpieceState &attachmentState = attachmentFeature->State;
  const auto &baseMaterial = GetMaterialProcessingDefinition(baseState.Material);
  const auto &attachmentMaterial = GetMaterialProcessingDefinition(attachmentState.Material);
  if (!baseMaterial.Joinable || !attachmentMaterial.Joinable)
    return false;

  const bool orientationCompatible = baseState.Orientation != attachmentState.Orientation;
  const bool hasCompatibleSides = !baseState.ConnectionSides.empty() && !attachmentState.ConnectionSides.empty();
  if (!hasCompatibleSides)
    return false;

  const bool vertical = baseState.Orientation == PartOrientation::Vertical || attachmentState.Orientation == PartOrientation::Vertical;
  const int32_t gap = 1;
  const int32_t newWidth = vertical
                               ? (std::max)(baseState.ProfileWidth, attachmentState.ProfileWidth)
                               : baseState.ProfileWidth + attachmentState.ProfileWidth + gap;
  const int32_t newHeight = vertical
                                ? baseState.ProfileHeight + attachmentState.ProfileHeight + gap
                                : (std::max)(baseState.ProfileHeight, attachmentState.ProfileHeight);

  WorkpieceState combined = MakeStockWorkpiece(baseState.Material, newWidth, newHeight, (std::max)(baseState.ThicknessRaw, attachmentState.ThicknessRaw), vertical ? PartOrientation::Vertical : PartOrientation::Horizontal);
  std::fill(combined.ProfileMask.begin(), combined.ProfileMask.end(), 0);

  for (int32_t y = 0; y < baseState.ProfileHeight; ++y)
  {
    for (int32_t x = 0; x < baseState.ProfileWidth; ++x)
    {
      if (!IsFilled(baseState, x, y))
        continue;
      SetFilled(combined, x, vertical ? y + attachmentState.ProfileHeight + gap : y, true);
    }
  }

  for (int32_t y = 0; y < attachmentState.ProfileHeight; ++y)
  {
    for (int32_t x = 0; x < attachmentState.ProfileWidth; ++x)
    {
      if (!IsFilled(attachmentState, x, y))
        continue;
      const int32_t targetX = vertical ? x : x + baseState.ProfileWidth + gap;
      const int32_t targetY = vertical ? y : y;
      SetFilled(combined, targetX, targetY, true);
    }
  }

  combined.Stage = WorkpieceStage::AssembledItem;
  combined.Material = baseState.Material;
  const int32_t fitScore = (std::max)(0, 100 - std::abs(baseState.ProfileWidth - attachmentState.ProfileWidth) * 12 - std::abs(baseState.ProfileHeight - attachmentState.ProfileHeight) * 4);
  const int32_t materialScore = baseState.Material == attachmentState.Material
      ? 100
      : (baseMaterial.JoinStrength + attachmentMaterial.JoinStrength) * 2;
  const int32_t weaknessPenalty = (baseState.BreakRisk + attachmentState.BreakRisk) / 6 +
      ((100 - baseState.JoinPreparationQuality) + (100 - attachmentState.JoinPreparationQuality)) / 4 +
      (orientationCompatible ? 0 : 24);
  const int32_t joinQuality = (std::max)(5, ((fitScore + materialScore) / 2) - weaknessPenalty);
  combined.JoinPreparationQuality = static_cast<uint16_t>((baseState.JoinPreparationQuality + attachmentState.JoinPreparationQuality) / 2);
  combined.JoinedFitScore = static_cast<uint16_t>((std::max)(0, fitScore));
  combined.JoinMaterialScore = static_cast<uint16_t>((std::max)(0, materialScore));
  combined.JoinWeaknessPenalty = static_cast<uint16_t>((std::max)(0, weaknessPenalty));
  combined.JoinQuality = static_cast<uint16_t>((std::min)(100, joinQuality));
  combined.Quality = static_cast<uint16_t>((std::max)(5, (baseState.Quality + attachmentState.Quality + joinQuality + baseMaterial.JoinStrength + attachmentMaterial.JoinStrength) / 5));
  if (!orientationCompatible)
    combined.InvalidReason = WorkpieceInvalidReason::JoinMismatch;
  combined.JoinedParts = baseState.JoinedParts;
  combined.JoinedParts.push_back(JoinedPartDescriptor{
      attachment.DefinitionId,
      attachmentState.Material,
      attachmentState.ConnectionSides.empty() ? ConnectionSide::None : attachmentState.ConnectionSides.front(),
      attachmentState.Orientation,
      attachmentState.ProfileWidth,
      attachmentState.ProfileHeight,
  });
  combined.JoinedParts.push_back(JoinedPartDescriptor{
      baseItem.DefinitionId,
      baseState.Material,
      baseState.ConnectionSides.empty() ? ConnectionSide::None : baseState.ConnectionSides.front(),
      baseState.Orientation,
      baseState.ProfileWidth,
      baseState.ProfileHeight,
  });
  baseState = std::move(combined);
  RecalculateDerivedState(baseItem);
  return !baseState.Broken;
}
}
