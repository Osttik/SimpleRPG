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
  Inventory *GetBackpack(uint32_t entityId);
  Inventory *GetStorage(uint32_t entityId);
};
