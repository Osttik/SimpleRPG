#include "core/components/dropped-item-component.h"

DroppedItemComponent *DroppedItemComponentManager::Ensure(uint32_t entityId, GameObject *owner)
{
  auto *comp = Get(entityId);
  if (comp)
    return comp;
  return Add(entityId, owner);
}

DroppedItemComponent *DroppedItemComponentManager::SetItem(uint32_t entityId, std::unique_ptr<Item> item, GameObject *owner)
{
  auto *comp = Ensure(entityId, owner);
  if (!comp)
    return nullptr;
  comp->WorldItem = std::move(item);
  return comp;
}

Item *DroppedItemComponentManager::GetItem(uint32_t entityId)
{
  auto *comp = Get(entityId);
  return comp ? comp->WorldItem.get() : nullptr;
}

const Item *DroppedItemComponentManager::GetItem(uint32_t entityId) const
{
  auto *comp = Get(entityId);
  return comp ? comp->WorldItem.get() : nullptr;
}

std::unique_ptr<Item> DroppedItemComponentManager::TakeItem(uint32_t entityId)
{
  auto *comp = Get(entityId);
  if (!comp)
    return nullptr;
  return std::move(comp->WorldItem);
}
