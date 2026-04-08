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
    auto storage = std::make_unique<Inventory>(float32(500.0), float32(0.0));
    engine.Ctx.GetManager<InventoryComponentManager>()->EquipContainer(
        obj->Id, ContainerSlot::MainStorage, std::move(storage), obj);

    engine.Ctx.GetManager<InteractableComponentManager>()->AddTarget(
        obj->Id, obj, InteractionType::Loot, "Chest",
        std::make_unique<Circle>(position, radius));

    return obj->Id;
  }
};
