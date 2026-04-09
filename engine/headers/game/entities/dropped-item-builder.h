#pragma once
#include "core/game-world-engine.h"
#include "core/gameplay-constants.h"
#include "core/components/dropped-item-component.h"
#include "core/components/interactable-component.h"

class DroppedItemBuilder
{
public:
  static uint32_t Build(GameWorldEngine &engine, const Point &position, std::unique_ptr<Item> item)
  {
    auto shape = std::make_unique<Circle>(position, float32(0.0));
    auto *obj = engine.ObjectManager.Instantiate(position, std::move(shape));
    obj->Type = "item_drop";
    obj->IsStaticProp = true;
    obj->Radius = DROPPED_ITEM_RENDER_RADIUS;

    auto *droppedMgr = engine.Ctx.GetManager<DroppedItemComponentManager>();
    auto *interactMgr = engine.Ctx.GetManager<InteractableComponentManager>();
    if (!droppedMgr || !interactMgr || !item)
      return obj->Id;

    const std::string label = item->Name;
    droppedMgr->SetItem(obj->Id, std::move(item), obj);
    interactMgr->AddTarget(
        obj->Id, obj, InteractionType::Pickup, label,
        std::make_unique<Circle>(position, DROPPED_ITEM_INTERACTION_RADIUS));

    return obj->Id;
  }
};
