#pragma once

#include <stdint.h>
#include "core/game-world-engine.h"
#include "core/components/crafting-station-component.h"
#include "core/components/interactable-component.h"
#include "core/components/inventory-component.h"

class StationBuilder
{
public:
  static uint32_t Build(
      GameWorldEngine &engine,
      const Point &position,
      std::unique_ptr<Shape> shape,
      float32 radius,
      int32_t chunkZ,
      CraftingStationType stationType,
      const std::string &typeName,
      const std::string &label)
  {
    auto *obj = engine.ObjectManager.Instantiate(position, std::move(shape));
    obj->Type = typeName;
    obj->IsStaticProp = true;
    obj->Radius = radius;
    obj->Transform.SetZPosition(chunkZ);

    auto storage = std::make_unique<Inventory>(CRAFTING_STATION_STORAGE_MAX_VOLUME, float32(0.0));
    engine.Ctx.GetManager<InventoryComponentManager>()->EquipContainer(
        obj->Id, ContainerSlot::MainStorage, std::move(storage), obj);
    engine.Ctx.GetManager<CraftingStationComponentManager>()->AddStation(obj->Id, obj, stationType);
    engine.Ctx.GetManager<InteractableComponentManager>()->AddTarget(
        obj->Id, obj, InteractionType::Station, label, std::make_unique<Circle>(Point(position.X, position.Y, chunkZ), radius));
    return obj->Id;
  }
};
