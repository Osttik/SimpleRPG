#include "core/components/inventory-component.h"

Inventory *InventoryComponentManager::GetBackpack(uint32_t entityId)
{
  auto *comp = Get(entityId);
  if (!comp)
    return nullptr;
  return comp->Inventories->GetContainer(ContainerSlot::Backpack);
}

Inventory *InventoryComponentManager::GetStorage(uint32_t entityId)
{
  auto *comp = Get(entityId);
  if (!comp)
    return nullptr;
  return comp->Inventories->GetContainer(ContainerSlot::MainStorage);
}
