#pragma once
#include <stdint.h>
#include "core/game-world-engine.h"
#include "core/components/move-component.h"
#include "core/components/inventory-component.h"

const float32 PLAYER_RADIUS(20);

class PlayerBuilder
{
public:
  static uint32_t BuildPlayer(GameWorldEngine &manager, const Point &position)
  {
    auto player = manager.ObjectManager.Instatiate(position, std::make_unique<Circle>(position, PLAYER_RADIUS));

    player->Type   = "player";
    player->Radius = PLAYER_RADIUS;

    manager.ComponentsManagers.Get<MoveComponentManager>()->AddComponentTo(player);
    manager.ComponentsManagers.Get<InventoryComponentManager>()->AddComponentTo(player);

    return player->Id;
  }
};
