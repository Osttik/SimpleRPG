#pragma once
#include <stdint.h>
#include "core/game-world-engine.h"
#include "core/components/move-component.h"

const float32 NPC_RADIUS(18);

class NPCBuilder
{
public:
  static uint32_t Build(GameWorldEngine &engine, const Point &position)
  {
    auto npc = engine.ObjectManager.Instantiate(position, std::make_unique<Circle>(position, NPC_RADIUS));

    npc->Type = "npc";
    npc->Radius = NPC_RADIUS;

    engine.Ctx.GetManager<MoveComponentManager>()->Add(npc->Id, npc);

    return npc->Id;
  }
};
