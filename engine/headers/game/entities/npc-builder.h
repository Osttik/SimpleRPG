#pragma once
#include <stdint.h>
#include "core/game-world-engine.h"
#include "core/components/move-component.h"

const float32 NPC_RADIUS(18);

class NPCBuilder
{
public:
  static uint32_t BuildNPC(GameWorldEngine &manager, const Point &position)
  {
    auto npc = manager.ObjectManager.Instatiate(position, std::make_unique<Circle>(position, NPC_RADIUS));

    npc->Type   = "npc";
    npc->Radius = NPC_RADIUS;

    manager.ComponentsManagers.Get<MoveComponentManager>()->AddComponentTo(npc);

    return npc->Id;
  }
};
