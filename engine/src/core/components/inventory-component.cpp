#include "core/components/inventory-component.h"

InventoryComponent *InventoryComponentManager::Ensure(uint32_t entityId, GameObject *owner)
{
  auto *comp = Get(entityId);
  if (comp)
    return comp;
  return Add(entityId, owner);
}

void InventoryComponentManager::EquipContainer(uint32_t entityId, ContainerSlot slot,
                                               std::unique_ptr<Inventory> inventory, GameObject *owner)
{
  auto *comp = Ensure(entityId, owner);
  if (!comp)
    return;
  comp->Inventories->EquipContainer(slot, std::move(inventory));
}

Inventory *InventoryComponentManager::GetContainer(uint32_t entityId, ContainerSlot slot)
{
  auto *comp = Get(entityId);
  if (!comp)
    return nullptr;
  return comp->Inventories->GetContainer(slot);
}

const Inventory *InventoryComponentManager::GetContainer(uint32_t entityId, ContainerSlot slot) const
{
  auto *comp = Get(entityId);
  if (!comp)
    return nullptr;
  return comp->Inventories->GetContainer(slot);
}

Inventory *InventoryComponentManager::GetBackpack(uint32_t entityId)
{
  return GetContainer(entityId, ContainerSlot::Backpack);
}

Inventory *InventoryComponentManager::GetStorage(uint32_t entityId)
{
  return GetContainer(entityId, ContainerSlot::MainStorage);
}

bool InventoryComponentManager::TransferItem(uint32_t fromEntityId, uint32_t toEntityId,
                                             ContainerSlot fromSlot, ContainerSlot toSlot, size_t itemIndex)
{
  auto *from = GetContainer(fromEntityId, fromSlot);
  auto *to = GetContainer(toEntityId, toSlot);
  if (!from || !to)
    return false;

  return InventoryOperator::TransferTo(*from, *to, itemIndex);
}

bool InventoryComponentManager::AddItem(uint32_t entityId, ContainerSlot slot, std::unique_ptr<Item> item, GameObject *owner)
{
  auto *container = GetContainer(entityId, slot);
  if (!container)
  {
    auto *comp = Ensure(entityId, owner);
    if (!comp)
      return false;

    auto fallback = std::make_unique<Inventory>(float32(500.0), float32(0.0));
    comp->Inventories->EquipContainer(slot, std::move(fallback));
    container = comp->Inventories->GetContainer(slot);
  }

  if (!container)
    return false;

  return container->AddItem(std::move(item));
}

std::unique_ptr<Item> InventoryComponentManager::RemoveItem(uint32_t entityId, ContainerSlot slot, size_t itemIndex)
{
  auto *container = GetContainer(entityId, slot);
  if (!container)
    return nullptr;
  return container->RemoveItem(itemIndex);
}
