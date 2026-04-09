#pragma once
#include "core/game-object/component.h"
#include "core/game-object/component-manager.h"
#include "core/inventory.h"

struct DroppedItemComponent : public Component
{
  std::unique_ptr<Item> WorldItem;

  DroppedItemComponent(GameObject *owner) : Component(owner) {}
};

class DroppedItemComponentManager : public TypedComponentManager<DroppedItemComponent>
{
public:
  DroppedItemComponent *Ensure(uint32_t entityId, GameObject *owner);
  DroppedItemComponent *SetItem(uint32_t entityId, std::unique_ptr<Item> item, GameObject *owner);
  Item *GetItem(uint32_t entityId);
  const Item *GetItem(uint32_t entityId) const;
  std::unique_ptr<Item> TakeItem(uint32_t entityId);
};
