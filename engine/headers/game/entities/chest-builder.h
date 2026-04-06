#pragma once
#include <stdint.h>
#include "core/game-world-engine.h"
#include "core/components/interactable-component.h"
#include "core/components/inventory-component.h"

class ChestBuilder
{
public:
  static uint32_t Build(GameWorldEngine &engine, const Point &position,
                        std::unique_ptr<Shape> shape, float32 radius, int32_t chunkZ)
  {
    auto *obj = engine.ObjectManager.Instantiate(position, std::move(shape));
    obj->Type = "chest";
    obj->IsStaticProp = true;
    obj->Radius = radius;
    obj->Transform.SetZPosition(chunkZ);

    // Add inventory with MainStorage
    auto *inv = engine.Ctx.GetManager<InventoryComponentManager>()->Add(obj->Id, obj);
    auto storage = std::make_unique<Inventory>(float32(500.0), float32(0.0));
    inv->Inventories->EquipContainer(ContainerSlot::MainStorage, std::move(storage));

    // Add interactable
    engine.Ctx.GetManager<InteractableComponentManager>()->Add(
        obj->Id, obj, InteractionType::Loot, "Chest");

    return obj->Id;
  }
};
