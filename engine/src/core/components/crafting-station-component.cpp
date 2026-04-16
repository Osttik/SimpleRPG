#include "core/components/crafting-station-component.h"
#include <algorithm>
#include "core/components/inventory-component.h"
#include "core/game-world-engine.h"
#include "core/crafting/material-processing.h"

namespace
{
CraftingStationSlot MakeSlot(const char *slotId, const char *label, const char *role)
{
  CraftingStationSlot slot;
  slot.SlotId = slotId;
  slot.Label = label;
  slot.Role = role;
  return slot;
}

void CaptureStats(CraftingStatSnapshot &snapshot, const Item *item)
{
  snapshot = {};
  if (!item)
    return;

  const auto *workpiece = item->GetFeature<WorkpieceFeature>();
  if (!workpiece)
    return;

  const auto &state = workpiece->State;
  snapshot.Valid = true;
  snapshot.SwingEfficiency = state.SwingEfficiency;
  snapshot.ThrustEfficiency = state.ThrustEfficiency;
  snapshot.DiggingEfficiency = state.DiggingEfficiency;
  snapshot.CuttingEffectiveness = state.CuttingEffectiveness;
  snapshot.PiercingEffectiveness = state.PiercingEffectiveness;
  snapshot.BluntEffectiveness = state.BluntEffectiveness;
  snapshot.Durability = state.Durability;
  snapshot.BreakRisk = state.BreakRisk;
}
}

CraftingStationComponent *CraftingStationComponentManager::Ensure(uint32_t entityId, GameObject *owner)
{
  auto *component = Get(entityId);
  if (component)
    return component;
  return Add(entityId, owner);
}

void CraftingStationComponentManager::ConfigureSlots(CraftingStationComponent &station) const
{
  station.Slots.clear();
  station.MoldSlots.clear();

  switch (station.StationType)
  {
  case CraftingStationType::Smelter:
    station.Slots.push_back(MakeSlot("input_0", "Input 1", "input"));
    station.Slots.push_back(MakeSlot("input_1", "Input 2", "input"));
    station.Slots.push_back(MakeSlot("input_2", "Input 3", "input"));
    station.Slots.push_back(MakeSlot("output", "Result", "output"));
    station.MoldSlots = {
        MoldSilhouette::BladeBlank,
        MoldSilhouette::HammerHeadBlank,
        MoldSilhouette::ShaftBlank,
        MoldSilhouette::ShovelBlank,
        MoldSilhouette::SpikeBlank,
    };
    break;
  case CraftingStationType::Anvil:
    station.Slots.push_back(MakeSlot("primary", "Primary", "primary"));
    station.Slots.push_back(MakeSlot("prep", "Prep / Support", "secondary"));
    break;
  case CraftingStationType::Workbench:
    station.Slots.push_back(MakeSlot("primary", "Primary Part", "primary"));
    station.Slots.push_back(MakeSlot("secondary", "Secondary Part", "secondary"));
    station.Slots.push_back(MakeSlot("handle", "Handle / Shaft", "handle"));
    station.Slots.push_back(MakeSlot("output", "Assembly Result", "output"));
    break;
  case CraftingStationType::Grindstone:
    station.Slots.push_back(MakeSlot("workpiece", "Workpiece", "primary"));
    break;
  default:
    break;
  }
}

CraftingStationComponent *CraftingStationComponentManager::AddStation(uint32_t entityId, GameObject *owner, CraftingStationType stationType)
{
  auto *component = Ensure(entityId, owner);
  component->StationType = stationType;
  component->HeatingActive = false;
  component->HeatingTicks = 0;
  component->HeatRate = stationType == CraftingStationType::Smelter ? 36 : 0;
  component->LastMold = MoldSilhouette::BladeBlank;
  component->MoltenPool = {};
  component->ComparisonBefore = {};
  component->LastError.clear();
  component->Warnings.clear();
  ConfigureSlots(*component);
  return component;
}

CraftingStationSlot *CraftingStationComponentManager::FindSlot(CraftingStationComponent *station, const std::string &slotId) const
{
  if (!station)
    return nullptr;
  for (auto &slot : station->Slots)
  {
    if (slot.SlotId == slotId)
      return &slot;
  }
  return nullptr;
}

const CraftingStationSlot *CraftingStationComponentManager::FindSlot(const CraftingStationComponent *station, const std::string &slotId) const
{
  if (!station)
    return nullptr;
  for (const auto &slot : station->Slots)
  {
    if (slot.SlotId == slotId)
      return &slot;
  }
  return nullptr;
}

CraftingStationSlot *CraftingStationComponentManager::FindFirstOpenSlot(CraftingStationComponent *station) const
{
  if (!station)
    return nullptr;
  for (auto &slot : station->Slots)
  {
    if (!slot.ItemRef && slot.Role != "output")
      return &slot;
  }
  return nullptr;
}

void CraftingStationComponentManager::SetError(CraftingStationComponent *station, std::string message) const
{
  if (!station)
    return;
  station->LastError = std::move(message);
}

void CraftingStationComponentManager::ClearTransientState(CraftingStationComponent *station) const
{
  if (!station)
    return;
  station->LastError.clear();
  station->Warnings.clear();
}

void CraftingStationComponentManager::Tick(GameWorldEngine &, InventoryComponentManager *)
{
  for (uint32_t entityId = 1; entityId < _pool.size(); ++entityId)
  {
    auto *station = Get(entityId);
    if (!station)
      continue;

    station->Warnings.clear();

    if (station->StationType != CraftingStationType::Smelter || !station->HeatingActive)
      continue;

    bool anyInput = false;
    for (auto &slot : station->Slots)
    {
      if (slot.Role != "input" || !slot.ItemRef)
        continue;

      anyInput = true;
      CaptureStats(station->ComparisonBefore, slot.ItemRef.get());
      if (!Crafting::ApplyHeat(*slot.ItemRef, station->HeatRate))
        continue;

      auto *workpiece = slot.ItemRef->GetFeature<WorkpieceFeature>();
      if (!workpiece)
        continue;

      const auto &material = GetMaterialProcessingDefinition(workpiece->State.Material);
      const auto heatOutcome = ResolveMaterialHeatOutcome(workpiece->State.Material, workpiece->State.TemperatureRaw);
      if (heatOutcome == MaterialHeatOutcome::Charred)
      {
        station->Warnings.push_back(slot.Label + std::string(" is charring."));
      }
      else if (heatOutcome == MaterialHeatOutcome::Ashed)
      {
        station->Warnings.push_back(slot.Label + std::string(" burned down to ash."));
      }
      else if (heatOutcome == MaterialHeatOutcome::Scrap)
      {
        station->Warnings.push_back(slot.Label + std::string(" overheated into scrap."));
      }

      if (material.Castable && heatOutcome == MaterialHeatOutcome::Melted)
      {
        const int32_t occupiedCells = static_cast<int32_t>(std::count(workpiece->State.ProfileMask.begin(), workpiece->State.ProfileMask.end(), uint8_t{1}));
        if (!station->MoltenPool.Active)
        {
          station->MoltenPool.Active = true;
          station->MoltenPool.Material = workpiece->State.Material;
          station->MoltenPool.Quality = workpiece->State.Quality;
          station->MoltenPool.AmountUnits = occupiedCells * (std::max)(1, workpiece->State.ThicknessRaw / 65536);
          station->MoltenPool.TemperatureRaw = workpiece->State.TemperatureRaw;
          station->MoltenPool.SourceCount = 1;
          slot.ItemRef.reset();
          continue;
        }

        if (station->MoltenPool.Material == workpiece->State.Material)
        {
          const int32_t incomingAmount = occupiedCells * (std::max)(1, workpiece->State.ThicknessRaw / 65536);
          station->MoltenPool.AmountUnits += incomingAmount;
          station->MoltenPool.Quality = static_cast<uint16_t>((station->MoltenPool.Quality + workpiece->State.Quality) / 2);
          station->MoltenPool.TemperatureRaw = (std::max)(station->MoltenPool.TemperatureRaw, workpiece->State.TemperatureRaw);
          station->MoltenPool.SourceCount = static_cast<uint16_t>(station->MoltenPool.SourceCount + 1);
          slot.ItemRef.reset();
        }
        else
        {
          station->Warnings.push_back(slot.Label + std::string(" melted but does not match the current molten pool."));
        }
      }
    }

    if (!anyInput)
    {
      station->HeatingActive = false;
      station->HeatingTicks = 0;
      continue;
    }

    if (station->MoltenPool.Active)
    {
      station->MoltenPool.TemperatureRaw = (std::max)(0, station->MoltenPool.TemperatureRaw - 4);
      if (station->MoltenPool.AmountUnits <= 0)
      {
        station->MoltenPool = {};
      }
    }

    station->HeatingTicks++;
  }
}
