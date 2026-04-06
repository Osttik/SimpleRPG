#pragma once
#include <stdint.h>
#include "core/game-world-engine.h"
#include "core/components/move-component.h"
#include "core/components/inventory-component.h"

const float32 PLAYER_RADIUS(20);

class PlayerBuilder
{
public:
  static uint32_t Build(GameWorldEngine &engine, const Point &position)
  {
    auto player = engine.ObjectManager.Instantiate(position, std::make_unique<Circle>(position, PLAYER_RADIUS));

    player->Type = "player";
    player->Radius = PLAYER_RADIUS;

    engine.Ctx.GetManager<MoveComponentManager>()->Add(player->Id, player);

    auto *inv = engine.Ctx.GetManager<InventoryComponentManager>()->Add(player->Id, player);
    auto backpack = std::make_unique<Inventory>(float32(50.0), float32(0.0));
    inv->Inventories->EquipContainer(ContainerSlot::Backpack, std::move(backpack));

    return player->Id;
  }
};
