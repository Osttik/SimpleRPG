#pragma once
#include <stdint.h>
#include "core/game-world-engine.h"
#include "core/components/equipment-component.h"
#include "core/components/move-component.h"
#include "core/components/inventory-component.h"
#include "core/components/interactable-component.h"

const float32 PLAYER_RADIUS(20);
const float32 PLAYER_INTERACTION_RADIUS(80);

class PlayerBuilder
{
public:
  static uint32_t Build(GameWorldEngine &engine, const Point &position)
  {
    auto player = engine.ObjectManager.Instantiate(position, std::make_unique<Circle>(position, PLAYER_RADIUS));

    player->Type = "player";
    player->Radius = PLAYER_RADIUS;

    engine.Ctx.GetManager<MoveComponentManager>()->Add(player->Id, player);

    auto backpack = std::make_unique<Inventory>(float32(50.0), float32(0.0));
    engine.Ctx.GetManager<InventoryComponentManager>()->EquipContainer(
        player->Id, ContainerSlot::Backpack, std::move(backpack), player);
    engine.Ctx.GetManager<EquipmentComponentManager>()->Ensure(
        player->Id, player, engine.Ctx.GetManager<InventoryComponentManager>());

    engine.Ctx.GetManager<InteractableComponentManager>()->AddSensor(
        player->Id, player, std::make_unique<Circle>(position, PLAYER_INTERACTION_RADIUS));

    return player->Id;
  }
};
