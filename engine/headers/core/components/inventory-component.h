#pragma once
#include "core/game-object/component.h"
#include "core/game-object/component-manager.h"
#include "core/inventory.h"

struct InventoryComponent : public Component
{
  std::unique_ptr<InventoryManager> Inventories = std::make_unique<InventoryManager>();

  InventoryComponent(GameObject *owner) : Component(owner) {}
};

class InventoryComponentManager : public TypedComponentManager<InventoryComponent>
{
public:
  InventoryComponent *Ensure(uint32_t entityId, GameObject *owner);
  void EquipContainer(uint32_t entityId, ContainerSlot slot, std::unique_ptr<Inventory> inventory, GameObject *owner = nullptr);
  Inventory *GetContainer(uint32_t entityId, ContainerSlot slot);
  const Inventory *GetContainer(uint32_t entityId, ContainerSlot slot) const;
  Inventory *GetBackpack(uint32_t entityId);
  Inventory *GetStorage(uint32_t entityId);
  bool TransferItem(uint32_t fromEntityId, uint32_t toEntityId,
                    ContainerSlot fromSlot, ContainerSlot toSlot, size_t itemIndex);
  bool AddItem(uint32_t entityId, ContainerSlot slot, std::unique_ptr<Item> item, GameObject *owner = nullptr);
};
