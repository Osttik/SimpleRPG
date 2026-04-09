#pragma once
#include <array>
#include <stdexcept>
#include <string>
#include "core/game-object/component.h"
#include "core/game-object/component-manager.h"
#include "core/components/inventory-component.h"

struct EquipmentSlotState
{
  const Item *ItemRef = nullptr;
};

struct EquipmentComponent : public Component, public InventoryListener
{
  Inventory *ObservedInventory = nullptr;
  std::array<EquipmentSlotState, 8> Slots{};

  EquipmentComponent(GameObject *owner) : Component(owner) {}
  ~EquipmentComponent() override;

  void AttachInventory(Inventory *inventory);
  void DetachInventory();
  void OnItemRemoved(Inventory &inventory, const Item &item) override;
};

class EquipmentComponentManager : public TypedComponentManager<EquipmentComponent>
{
public:
  EquipmentComponent *Ensure(uint32_t entityId, GameObject *owner, InventoryComponentManager *inventoryMgr);
  void RemoveComponent(uint32_t entityId) override;
  bool ToggleEquip(uint32_t entityId, size_t itemIndex, InventoryComponentManager *inventoryMgr, GameObject *owner = nullptr);
  const Item *GetEquippedItem(uint32_t entityId, EquipSlot slot) const;
  EquipSlot GetEquippedSlotFor(uint32_t entityId, const Item *item) const;
  bool IsEquipped(uint32_t entityId, const Item *item) const;
  static std::string SlotName(EquipSlot slot);
};
