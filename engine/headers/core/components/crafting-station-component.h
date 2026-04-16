#pragma once

#include <cstdint>
#include <memory>
#include <string>
#include <vector>
#include "core/crafting/workpiece-data.h"
#include "core/game-object/component.h"
#include "core/game-object/component-manager.h"
#include "core/inventory.h"

class InventoryComponentManager;
class GameWorldEngine;

enum class CraftingStationType : uint8_t
{
  None = 0,
  Smelter = 1,
  Anvil = 2,
  Workbench = 3,
  Grindstone = 4,
};

struct CraftingStatSnapshot
{
  bool Valid = false;
  int32_t SwingEfficiency = 0;
  int32_t ThrustEfficiency = 0;
  int32_t DiggingEfficiency = 0;
  int32_t CuttingEffectiveness = 0;
  int32_t PiercingEffectiveness = 0;
  int32_t BluntEffectiveness = 0;
  int32_t Durability = 0;
  int32_t BreakRisk = 0;
};

struct CraftingStationSlot
{
  std::string SlotId;
  std::string Label;
  std::string Role;
  std::unique_ptr<Item> ItemRef;
};

struct MoltenPoolState
{
  MaterialId Material = MaterialId::None;
  int32_t AmountUnits = 0;
  int32_t TemperatureRaw = 0;
  uint16_t Quality = 0;
  uint16_t SourceCount = 0;
  bool Active = false;
};

struct CraftingStationComponent : public Component
{
  CraftingStationType StationType = CraftingStationType::None;
  bool HeatingActive = false;
  int32_t HeatRate = 16;
  uint32_t HeatingTicks = 0;
  MoldSilhouette LastMold = MoldSilhouette::BladeBlank;
  std::vector<CraftingStationSlot> Slots;
  std::vector<MoldSilhouette> MoldSlots;
  MoltenPoolState MoltenPool;
  CraftingStatSnapshot ComparisonBefore;
  std::string LastError;
  std::vector<std::string> Warnings;

  CraftingStationComponent(GameObject *owner) : Component(owner) {}
};

class CraftingStationComponentManager : public TypedComponentManager<CraftingStationComponent>
{
public:
  CraftingStationComponent *Ensure(uint32_t entityId, GameObject *owner);
  CraftingStationComponent *AddStation(uint32_t entityId, GameObject *owner, CraftingStationType stationType);
  void Tick(GameWorldEngine &engine, InventoryComponentManager *inventoryMgr);

  CraftingStationSlot *FindSlot(CraftingStationComponent *station, const std::string &slotId) const;
  const CraftingStationSlot *FindSlot(const CraftingStationComponent *station, const std::string &slotId) const;
  CraftingStationSlot *FindFirstOpenSlot(CraftingStationComponent *station) const;
  void ConfigureSlots(CraftingStationComponent &station) const;
  void SetError(CraftingStationComponent *station, std::string message) const;
  void ClearTransientState(CraftingStationComponent *station) const;
};
